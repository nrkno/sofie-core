import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import {
	getCurrentTime,
	literal,
	protectString,
	unprotectString,
	getRandomId,
	waitForPromise,
	MeteorPromiseCall,
} from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { Rundowns, RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { TimelineObjGeneric, TimelineObjType } from '../../../lib/collections/Timeline'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Pieces, Piece, PieceId } from '../../../lib/collections/Pieces'
import { Parts, Part, DBPart } from '../../../lib/collections/Parts'
import { prefixAllObjectIds, setNextPart, getPartBeforeSegment, getPreviousPart } from './lib'
import { cropInfinitesOnLayer, stopInfinitesRunningOnLayer, updateSourceLayerInfinitesAfterPart } from './infinites'
import { convertAdLibToPieceInstance, getResolvedPieces, convertPieceToAdLibPiece } from './pieces'
import { updateTimeline } from './timeline'
import { updatePartRanks, afterRemoveParts } from '../rundown'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'

import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { initCacheForRundownPlaylist, CacheForRundownPlaylist } from '../../DatabaseCaches'
import { BucketAdLib, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'

export namespace ServerPlayoutAdLibAPI {
	export function pieceTakeNow(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active)
				throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.currentPartInstanceId !== partInstanceId)
				throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a current part!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(rundownPlaylist))

			const pieceInstanceToCopy = cache.PieceInstances.findOne(pieceInstanceIdOrPieceIdToCopy)
			const pieceToCopy = pieceInstanceToCopy
				? pieceInstanceToCopy.piece
				: (cache.Pieces.findOne(pieceInstanceIdOrPieceIdToCopy) as Piece)
			if (!pieceToCopy) {
				throw new Meteor.Error(404, `PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" not found!`)
			}

			const partInstance = cache.PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

			const showStyleBase = rundown.getShowStyleBase() // todo: database
			const sourceL = showStyleBase.sourceLayers.find((i) => i._id === pieceToCopy.sourceLayerId)
			if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS)
				throw new Meteor.Error(
					403,
					`PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" is not a GRAPHICS item!`
				)

			const newPieceInstance = convertAdLibToPieceInstance(pieceToCopy, partInstance, false)
			if (newPieceInstance.piece.content && newPieceInstance.piece.content.timelineObjects) {
				newPieceInstance.piece.content.timelineObjects = prefixAllObjectIds(
					_.compact(
						_.map(newPieceInstance.piece.content.timelineObjects, (obj) => {
							return literal<TimelineObjGeneric>({
								...obj,
								// @ts-ignore _id
								_id: obj.id || obj._id,
								studioId: protectString(''), // set later
								objectType: TimelineObjType.RUNDOWN,
							})
						})
					),
					unprotectString(newPieceInstance._id)
				)
			}

			// Disable the original piece if from the same Part
			if (pieceInstanceToCopy && pieceInstanceToCopy.partInstanceId === partInstance._id) {
				const pieces = getResolvedPieces(cache, partInstance)
				const resolvedPieceBeingCopied = pieces.find((p) => p._id === pieceInstanceToCopy._id)

				// Ensure the piece being copied isnt currently live
				if (
					pieceInstanceToCopy.piece.startedPlayback &&
					pieceInstanceToCopy.piece.startedPlayback <= getCurrentTime()
				) {
					if (
						resolvedPieceBeingCopied &&
						resolvedPieceBeingCopied.piece.playoutDuration !== undefined &&
						(pieceInstanceToCopy.piece.infiniteMode ||
							pieceInstanceToCopy.piece.startedPlayback +
								resolvedPieceBeingCopied.piece.playoutDuration >=
								getCurrentTime())
					) {
						// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
						throw new Meteor.Error(
							409,
							`PieceInstance "${pieceInstanceToCopy._id}" is currently live and cannot be used as an ad-lib`
						)
					}
				}

				cache.PieceInstances.update(pieceInstanceToCopy._id, {
					$set: {
						'piece.disabled': true,
						'piece.hidden': true,
					},
				})
				// TODO-PartInstance - pending new data flow
				cache.Pieces.update(pieceInstanceToCopy.piece._id, {
					$set: {
						disabled: true,
						hidden: true,
					},
				})
			}

			cache.PieceInstances.insert(newPieceInstance)
			// TODO-PartInstance - pending new data flow
			cache.Pieces.insert(newPieceInstance.piece)

			cropInfinitesOnLayer(cache, rundown, partInstance, newPieceInstance) // todo: this one uses showStyleBase
			stopInfinitesRunningOnLayer(
				cache,
				rundownPlaylist,
				rundown,
				partInstance,
				newPieceInstance.piece.sourceLayerId
			)
			updateTimeline(cache, rundown.studioId)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	export function segmentAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adLibPieceId: PieceId,
		queue: boolean
	) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active)
				throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (
				rundownPlaylist.holdState === RundownHoldState.ACTIVE ||
				rundownPlaylist.holdState === RundownHoldState.PENDING
			) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}
			const cache = waitForPromise(initCacheForRundownPlaylist(rundownPlaylist))

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)
			if (rundown.playlistId !== rundownPlaylistId)
				throw new Meteor.Error(
					406,
					`Rundown "${rundown._id}" not a part of RundownPlaylist "${rundownPlaylistId}!"`
				)

			const adLibPiece = AdLibPieces.findOne({
				_id: adLibPieceId,
				rundownId: partInstance.rundownId,
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Part Ad Lib Item "${adLibPieceId}" not found!`)
			if (adLibPiece.invalid)
				throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${adLibPieceId}"!`)
			if (adLibPiece.floated)
				throw new Meteor.Error(404, `Cannot take floated Part Ad Lib Item "${adLibPieceId}"!`)

			if (!queue && rundownPlaylist.currentPartInstanceId !== partInstanceId)
				throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(cache, rundownPlaylist, rundown, queue, partInstanceId, adLibPiece)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	export function rundownBaselineAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		baselineAdLibPieceId: PieceId,
		queue: boolean
	) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			logger.debug('rundownBaselineAdLibPieceStart')

			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active)
				throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in an active rundown!`)
			if (
				rundownPlaylist.holdState === RundownHoldState.ACTIVE ||
				rundownPlaylist.holdState === RundownHoldState.PENDING
			) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}
			const cache = waitForPromise(initCacheForRundownPlaylist(rundownPlaylist))

			const partInstance = cache.PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)
			if (rundown.playlistId !== rundownPlaylistId)
				throw new Meteor.Error(
					406,
					`Rundown "${rundown._id}" not a part of RundownPlaylist "${rundownPlaylistId}!"`
				)

			const adLibPiece = cache.RundownBaselineAdLibPieces.findOne({
				_id: baselineAdLibPieceId,
				rundownId: partInstance.rundownId,
			})
			if (!adLibPiece)
				throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${baselineAdLibPieceId}" not found!`)
			if (!queue && rundownPlaylist.currentPartInstanceId !== partInstanceId)
				throw new Meteor.Error(
					403,
					`Rundown Baseline AdLib-pieces can be only placed in a currently playing part!`
				)

			innerStartAdLibPiece(cache, rundownPlaylist, rundown, queue, partInstanceId, adLibPiece)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	function innerStartAdLibPiece(
		cache: CacheForRundownPlaylist,
		rundownPlaylist: RundownPlaylist,
		rundown: Rundown,
		queue: boolean,
		partInstanceId0: PartInstanceId,
		adLibPiece: AdLibPiece | BucketAdLib
	) {
		if (adLibPiece.toBeQueued) {
			// Allow adlib to request to always be queued
			queue = true
		}

		let partInstanceId = partInstanceId0
		let previousPartInstance: PartInstance | undefined

		if (queue) {
			previousPartInstance = cache.PartInstances.findOne(partInstanceId0)
			if (!previousPartInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId0}" not found!`)

			// insert a NEW, adlibbed part after this part
			partInstanceId = adlibQueueInsertPartInstance(
				cache,
				rundownPlaylist,
				rundown,
				previousPartInstance,
				adLibPiece
			)
		}
		let partInstance = cache.PartInstances.findOne({
			_id: partInstanceId,
			rundownId: rundown._id,
		})
		if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

		const newPieceInstance = convertAdLibToPieceInstance(adLibPiece, partInstance, queue)

		cache.PieceInstances.insert(newPieceInstance)
		// TODO-PartInstance - pending new data flow
		cache.Pieces.insert(newPieceInstance.piece)

		if (queue) {
			// Update any infinites
			updateSourceLayerInfinitesAfterPart(cache, rundown, previousPartInstance!.part)

			// Copy across adlib-preroll and other properties needed on the part
			cache.PartInstances.update(partInstance._id, {
				$set: {
					prerollDuration: adLibPiece.adlibPreroll,
					autoNext: adLibPiece.adlibAutoNext,
					autoNextOverlap: adLibPiece.adlibAutoNextOverlap,
					disableOutTransition: adLibPiece.adlibDisableOutTransition,
					expectedDuration: adLibPiece.expectedDuration,
				},
			})

			setNextPart(cache, rundownPlaylist, partInstance)
		} else {
			cropInfinitesOnLayer(cache, rundown, partInstance, newPieceInstance)
			stopInfinitesRunningOnLayer(
				cache,
				rundownPlaylist,
				rundown,
				partInstance,
				newPieceInstance.piece.sourceLayerId
			)
		}
		updateTimeline(cache, rundownPlaylist.studioId)
	}
	function adlibQueueInsertPartInstance(
		cache: CacheForRundownPlaylist,
		rundownPlaylist: RundownPlaylist,
		rundown: Rundown,
		afterPartInstance: PartInstance,
		adLibPiece: AdLibPiece | BucketAdLib
	): PartInstanceId {
		logger.info('adlibQueueInsertPartInstance')

		// check if there's already a queued part after this:
		const afterPartId = afterPartInstance.part.afterPart || afterPartInstance.part._id
		const alreadyQueuedPartInstance = cache.PartInstances.findOne(
			{
				rundownId: rundown._id,
				segmentId: afterPartInstance.segmentId,
				'part.afterPart': afterPartId,
				'part._rank': { $gt: afterPartInstance.part._rank },
			},
			{
				sort: { _rank: -1, _id: -1 },
			}
		)
		if (alreadyQueuedPartInstance) {
			if (rundownPlaylist.currentPartInstanceId !== alreadyQueuedPartInstance._id) {
				cache.Parts.remove(alreadyQueuedPartInstance.part._id)
				cache.PartInstances.remove(alreadyQueuedPartInstance._id)
				afterRemoveParts(cache, rundown._id, [alreadyQueuedPartInstance.part])
			}
		}

		const newPartInstanceId = protectString<PartInstanceId>(Random.id())
		const newPart = literal<DBPart>({
			_id: getRandomId(),
			_rank: 99999, // something high, so it will be placed after current part. The rank will be updated later to its correct value
			externalId: '',
			segmentId: afterPartInstance.segmentId,
			rundownId: rundown._id,
			title: adLibPiece.name,
			dynamicallyInserted: true,
			afterPart: afterPartInstance.part.afterPart || afterPartInstance.part._id,
			typeVariant: 'adlib',
			prerollDuration: adLibPiece.adlibPreroll,
			expectedDuration: adLibPiece.expectedDuration,
		})
		cache.PartInstances.insert({
			_id: newPartInstanceId,
			rundownId: newPart.rundownId,
			segmentId: newPart.segmentId,
			takeCount: afterPartInstance.takeCount + 1,
			part: new Part(newPart),
		})

		// TODO-PartInstance - pending new data flow
		cache.Parts.insert(newPart)

		updatePartRanks(cache, rundown) // place in order

		return newPartInstanceId
	}
	export function sourceLayerStickyPieceStart(rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
			if (!playlist.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			if (!playlist.currentPartInstanceId)
				throw new Meteor.Error(400, `A part needs to be active to place a sticky item`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			const currentPartInstance = cache.PartInstances.findOne(playlist.currentPartInstanceId)
			if (!currentPartInstance)
				throw new Meteor.Error(
					501,
					`Current PartInstance "${playlist.currentPartInstanceId}" could not be found.`
				)

			const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown)
				throw new Meteor.Error(501, `Current Rundown "${currentPartInstance.rundownId}" could not be found`)

			let showStyleBase = rundown.getShowStyleBase() // todo: database again

			const sourceLayer = showStyleBase.sourceLayers.find((i) => i._id === sourceLayerId)
			if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
			if (!sourceLayer.isSticky)
				throw new Meteor.Error(400, `Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`)

			const query = {
				rundownId: rundown._id,
				'piece.sourceLayerId': sourceLayer._id,
				'piece.startedPlayback': {
					$exists: true,
				},
			}

			if (sourceLayer.stickyOriginalOnly) {
				// Ignore adlibs if using original only
				query['pieces.adLibSourceId'] = {
					$exists: false,
				}
			}

			const lastPieceInstances = cache.PieceInstances.findFetch(query, {
				sort: {
					'piece.startedPlayback': -1,
				},
				limit: 1,
			})

			if (lastPieceInstances.length > 0) {
				const lastPiece = convertPieceToAdLibPiece(lastPieceInstances[0].piece)
				innerStartAdLibPiece(cache, playlist, rundown, false, playlist.currentPartInstanceId, lastPiece)
			}

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	export function startBucketAdlibPiece(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: PieceId,
		queue: boolean
	) {
		const bucketAdlib = BucketAdLibs.findOne(bucketAdlibId)
		if (!bucketAdlib) throw new Meteor.Error(404, `Bucket Adlib "${bucketAdlibId}" not found!`)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active)
				throw new Meteor.Error(403, `Bucket AdLib-pieces can be only placed in an active rundown!`)
			if (!rundownPlaylist.currentPartInstanceId)
				throw new Meteor.Error(400, `A part needs to be active to use a bucket adlib`)
			if (
				rundownPlaylist.holdState === RundownHoldState.ACTIVE ||
				rundownPlaylist.holdState === RundownHoldState.PENDING
			) {
				throw new Meteor.Error(403, `Buckete AdLib-pieces can not be used in combination with hold!`)
			}

			if (!queue && rundownPlaylist.currentPartInstanceId !== partInstanceId)
				throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(rundownPlaylist))

			const currentPartInstance = cache.PartInstances.findOne(rundownPlaylist.currentPartInstanceId)
			if (!currentPartInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${currentPartInstance.rundownId}" not found!`)
			if (rundown.playlistId !== rundownPlaylistId)
				throw new Meteor.Error(
					406,
					`Rundown "${rundown._id}" not a part of RundownPlaylist "${rundownPlaylistId}!"`
				)

			if (
				bucketAdlib.showStyleVariantId !== rundown.showStyleVariantId ||
				bucketAdlib.studioId !== rundown.studioId
			) {
				throw new Meteor.Error(
					404,
					`Bucket AdLib "${bucketAdlibId}" is not compatible with rundown "${rundown._id}"!`
				)
			}

			innerStartAdLibPiece(cache, rundownPlaylist, rundown, queue, partInstanceId, bucketAdlib)
		})
	}
}
