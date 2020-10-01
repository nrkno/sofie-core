import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { SourceLayerType, PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import {
	getCurrentTime,
	literal,
	protectString,
	unprotectString,
	getRandomId,
	waitForPromise,
	unprotectStringArray,
	sleep,
	assertNever,
} from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { Rundowns, RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { TimelineObjGeneric, TimelineObjType } from '../../../lib/collections/Timeline'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Piece, PieceId, Pieces } from '../../../lib/collections/Pieces'
import { Part } from '../../../lib/collections/Parts'
import {
	prefixAllObjectIds,
	setNextPart,
	getRundownIDsFromCache,
	getSelectedPartInstancesFromCache,
	removeDynamicallyInsertedPartsAfter,
	getAllOrderedPartsFromPlayoutCache,
} from './lib'
import { convertAdLibToPieceInstance, getResolvedPieces, convertPieceToAdLibPiece } from './pieces'
import { updateTimeline } from './timeline'
import { updatePartRanks } from '../rundown'
import {
	PieceInstances,
	PieceInstance,
	PieceInstanceId,
	rewrapPieceToInstance,
} from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { CacheForPlayout } from '../../cache/DatabaseCaches'
import { BucketAdLib, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { MongoQuery } from '../../../lib/typings/meteor'
import { syncPlayheadInfinitesForNextPartInstance, fetchPiecesThatMayBeActiveForPart } from './infinites'
import { RundownAPI } from '../../../lib/api/rundown'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { profiler } from '../profiler'
import { getPieceInstancesForPart } from './infinites'
import { MethodContext } from '../../../lib/api/methods'
import { rundownPlaylistPlayoutSyncFunction } from './playout'

export namespace ServerPlayoutAdLibAPI {
	export function pieceTakeNow(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return rundownPlaylistPlayoutSyncFunction(
			context,
			'pieceTakeNow',
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.active)
					throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
				if (playlist.currentPartInstanceId !== partInstanceId)
					throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a current part!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc
				const rundownIds = getRundownIDsFromCache(cache)

				// Note: Bypass the cache, as it could be from a far back instance
				const pieceInstanceToCopy = PieceInstances.findOne({
					_id: pieceInstanceIdOrPieceIdToCopy as PieceInstanceId,
					rundownId: { $in: rundownIds },
					reset: { $ne: true },
				})
				const pieceToCopy = pieceInstanceToCopy
					? pieceInstanceToCopy.piece
					: (Pieces.findOne({
							_id: pieceInstanceIdOrPieceIdToCopy as PieceId,
							startRundownId: { $in: rundownIds },
					  }) as Piece)
				if (!pieceToCopy) {
					throw new Meteor.Error(404, `PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" not found!`)
				}

				const partInstance = cache.PartInstances.findOne(partInstanceId)
				if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

				const rundown = cache.Rundowns.findOne(partInstance.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

				const showStyleBase = waitForPromise(cache.activationCache.getShowStyleBase(rundown))
				const sourceLayer = showStyleBase.sourceLayers.find((i) => i._id === pieceToCopy.sourceLayerId)
				if (sourceLayer && sourceLayer.type !== SourceLayerType.GRAPHICS)
					throw new Meteor.Error(
						403,
						`PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" is not a GRAPHICS item!`
					)

				const newPieceInstance = convertAdLibToPieceInstance(pieceToCopy, partInstance, false)
				if (newPieceInstance.piece.content && newPieceInstance.piece.content.timelineObjects) {
					newPieceInstance.piece.content.timelineObjects = prefixAllObjectIds(
						_.map(newPieceInstance.piece.content.timelineObjects, (obj) => {
							return literal<TimelineObjGeneric>({
								...obj,
								// @ts-ignore _id
								_id: obj.id || obj._id,
								studioId: protectString(''), // set later
								objectType: TimelineObjType.RUNDOWN,
							})
						}),
						unprotectString(newPieceInstance._id)
					)
				}

				// Disable the original piece if from the same Part
				if (pieceInstanceToCopy && pieceInstanceToCopy.partInstanceId === partInstance._id) {
					// Ensure the piece being copied isnt currently live
					if (
						pieceInstanceToCopy.startedPlayback &&
						pieceInstanceToCopy.startedPlayback <= getCurrentTime()
					) {
						const resolvedPieces = getResolvedPieces(cache, showStyleBase, partInstance)
						const resolvedPieceBeingCopied = resolvedPieces.find((p) => p._id === pieceInstanceToCopy._id)

						if (
							resolvedPieceBeingCopied &&
							resolvedPieceBeingCopied.resolvedDuration !== undefined &&
							(resolvedPieceBeingCopied.infinite ||
								resolvedPieceBeingCopied.resolvedStart + resolvedPieceBeingCopied.resolvedDuration >=
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
							disabled: true,
							hidden: true,
						},
					})
				}

				cache.PieceInstances.insert(newPieceInstance)

				syncPlayheadInfinitesForNextPartInstance(cache)

				updateTimeline(cache)
			}
		)
	}
	export function segmentAdLibPieceStart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adLibPieceId: PieceId,
		queue: boolean
	) {
		return rundownPlaylistPlayoutSyncFunction(
			context,
			'segmentAdLibPieceStart',
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.active)
					throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
				if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
					throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
				}

				if (!queue && playlist.currentPartInstanceId !== partInstanceId)
					throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)
			},
			(cache) => {
				const partInstance = cache.PartInstances.findOne(partInstanceId)
				if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
				const rundown = cache.Rundowns.findOne(partInstance.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

				const adLibPiece = AdLibPieces.findOne({
					_id: adLibPieceId,
					rundownId: partInstance.rundownId,
				})
				if (!adLibPiece) throw new Meteor.Error(404, `Part Ad Lib Item "${adLibPieceId}" not found!`)
				if (adLibPiece.invalid)
					throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${adLibPieceId}"!`)
				if (adLibPiece.floated)
					throw new Meteor.Error(404, `Cannot take floated Part Ad Lib Item "${adLibPieceId}"!`)

				innerStartOrQueueAdLibPiece(cache, rundown, queue, partInstance, adLibPiece)
			}
		)
	}
	export function rundownBaselineAdLibPieceStart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		baselineAdLibPieceId: PieceId,
		queue: boolean
	) {
		return rundownPlaylistPlayoutSyncFunction(
			context,
			'rundownBaselineAdLibPieceStart',
			rundownPlaylistId,
			(cache) => {
				logger.debug('rundownBaselineAdLibPieceStart')

				const playlist = cache.Playlist.doc
				if (!playlist.active)
					throw new Meteor.Error(
						403,
						`Rundown Baseline AdLib-pieces can be only placed in an active rundown!`
					)
				if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
					throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
				}

				if (!queue && playlist.currentPartInstanceId !== partInstanceId)
					throw new Meteor.Error(
						403,
						`Rundown Baseline AdLib-pieces can be only placed in a currently playing part!`
					)
			},
			(cache) => {
				const partInstance = cache.PartInstances.findOne(partInstanceId)
				if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
				const rundown = cache.Rundowns.findOne(partInstance.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

				const adLibPiece = waitForPromise(cache.activationCache.getRundownBaselineAdLibPieces(rundown)).find(
					(adlib) => adlib._id === baselineAdLibPieceId
				)
				if (!adLibPiece)
					throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${baselineAdLibPieceId}" not found!`)

				innerStartOrQueueAdLibPiece(cache, rundown, queue, partInstance, adLibPiece)
			}
		)
	}
	function innerStartOrQueueAdLibPiece(
		cache: CacheForPlayout,
		rundown: Rundown,
		queue: boolean,
		currentPartInstance: PartInstance,
		adLibPiece: AdLibPiece | BucketAdLib
	) {
		const playlist = cache.Playlist.doc

		const span = profiler.startSpan('innerStartOrQueueAdLibPiece')
		if (queue || adLibPiece.toBeQueued) {
			const newPartInstance = new PartInstance({
				_id: getRandomId(),
				rundownId: rundown._id,
				segmentId: currentPartInstance.segmentId,
				takeCount: currentPartInstance.takeCount + 1,
				rehearsal: !!playlist.rehearsal,
				part: new Part({
					_id: getRandomId(),
					_rank: 99999, // something high, so it will be placed after current part. The rank will be updated later to its correct value
					externalId: '',
					segmentId: currentPartInstance.segmentId,
					rundownId: rundown._id,
					title: adLibPiece.name,
					dynamicallyInsertedAfterPartId:
						currentPartInstance.part.dynamicallyInsertedAfterPartId ?? currentPartInstance.part._id,
					prerollDuration: adLibPiece.adlibPreroll,
					expectedDuration: adLibPiece.expectedDuration,
				}),
			})
			const newPieceInstance = convertAdLibToPieceInstance(adLibPiece, newPartInstance, queue)
			innerStartQueuedAdLib(cache, rundown, currentPartInstance, newPartInstance, [newPieceInstance])

			// syncPlayheadInfinitesForNextPartInstance is handled by setNextPart
		} else {
			const newPieceInstance = convertAdLibToPieceInstance(adLibPiece, currentPartInstance, queue)
			innerStartAdLibPiece(cache, rundown, currentPartInstance, newPieceInstance)

			syncPlayheadInfinitesForNextPartInstance(cache)
		}

		updateTimeline(cache)

		if (span) span.end()
	}

	export function sourceLayerStickyPieceStart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	) {
		return rundownPlaylistPlayoutSyncFunction(
			context,
			'sourceLayerStickyPieceStart',
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
				if (!playlist.active)
					throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
				if (!playlist.currentPartInstanceId)
					throw new Meteor.Error(400, `A part needs to be active to place a sticky item`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc

				const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (!currentPartInstance)
					throw new Meteor.Error(
						501,
						`Current PartInstance "${playlist.currentPartInstanceId}" could not be found.`
					)

				const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
				if (!rundown)
					throw new Meteor.Error(501, `Current Rundown "${currentPartInstance.rundownId}" could not be found`)

				const showStyleBase = waitForPromise(cache.activationCache.getShowStyleBase(rundown))

				const sourceLayer = showStyleBase.sourceLayers.find((i) => i._id === sourceLayerId)
				if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
				if (!sourceLayer.isSticky)
					throw new Meteor.Error(
						400,
						`Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`
					)

				const lastPieceInstance = innerFindLastPieceOnLayer(
					cache,
					sourceLayer._id,
					sourceLayer.stickyOriginalOnly || false
				)

				if (lastPieceInstance) {
					const lastPiece = convertPieceToAdLibPiece(lastPieceInstance.piece)
					innerStartOrQueueAdLibPiece(cache, rundown, false, currentPartInstance, lastPiece)
				}
			}
		)
	}

	export function innerFindLastPieceOnLayer(
		cache: CacheForPlayout,
		sourceLayerId: string,
		originalOnly: boolean,
		customQuery?: MongoQuery<PieceInstance>
	) {
		const span = profiler.startSpan('innerFindLastPieceOnLayer')
		const rundownIds = getRundownIDsFromCache(cache)

		const query = {
			...customQuery,
			rundownId: { $in: rundownIds },
			'piece.sourceLayerId': sourceLayerId,
			startedPlayback: {
				$exists: true,
			},
		}

		if (originalOnly) {
			// Ignore adlibs if using original only
			query.dynamicallyInserted = {
				$exists: false,
			}
		}

		// Note: This does not want to use the cache, as we want to search as far back as we can
		// TODO - will this cause problems? should we search the cache first in case of changes to the current/previous?
		const res = PieceInstances.findOne(query, {
			sort: {
				startedPlayback: -1,
			},
		})

		if (span) span.end()
		return res
	}

	export function innerStartQueuedAdLib(
		cache: CacheForPlayout,
		rundown: Rundown,
		currentPartInstance: PartInstance,
		newPartInstance: PartInstance,
		newPieceInstances: PieceInstance[]
	) {
		const span = profiler.startSpan('innerStartQueuedAdLib')
		logger.info('adlibQueueInsertPartInstance')

		// check if there's already a queued part after this:
		const { nextPartInstance } = getSelectedPartInstancesFromCache(cache)
		if (nextPartInstance && nextPartInstance.part.dynamicallyInsertedAfterPartId) {
			// TODO-PartInstance - pending new data flow - the call to setNextPart will prune the partInstance, so this will not be needed
			cache.Parts.remove(nextPartInstance.part._id)
			cache.PartInstances.remove(nextPartInstance._id)
			cache.PieceInstances.remove({ partInstanceId: nextPartInstance._id })
			removeDynamicallyInsertedPartsAfter(cache, [nextPartInstance.part._id])
		}

		// Ensure it is labelled as dynamic
		newPartInstance.part.dynamicallyInsertedAfterPartId = currentPartInstance.part._id

		cache.PartInstances.insert(newPartInstance)
		// TODO-PartInstance - pending new data flow
		cache.Parts.insert(newPartInstance.part)

		newPieceInstances.forEach((pieceInstance) => {
			// Ensure it is labelled as dynamic
			pieceInstance.partInstanceId = newPartInstance._id
			pieceInstance.piece.startPartId = newPartInstance.part._id

			cache.PieceInstances.insert(pieceInstance)
		})

		updatePartRanks(cache.Parts, cache.PartInstances, [newPartInstance.part.segmentId])

		setNextPart(cache, newPartInstance)

		// Find and insert any rundown defined infinites that we should inherit
		const part = cache.Parts.findOne(newPartInstance.part._id)
		const possiblePieces = waitForPromise(fetchPiecesThatMayBeActiveForPart(cache, part!))
		const infinitePieceInstances = getPieceInstancesForPart(
			cache,
			currentPartInstance,
			newPartInstance.part,
			possiblePieces,
			newPartInstance._id,
			false
		)
		for (const pieceInstance of infinitePieceInstances) {
			cache.PieceInstances.insert(pieceInstance)
		}

		if (span) span.end()
	}

	export function innerStartAdLibPiece(
		cache: CacheForPlayout,
		rundown: Rundown,
		existingPartInstance: PartInstance,
		newPieceInstance: PieceInstance
	) {
		const span = profiler.startSpan('innerStartAdLibPiece')
		// Ensure it is labelled as dynamic
		newPieceInstance.partInstanceId = existingPartInstance._id
		newPieceInstance.piece.startPartId = existingPartInstance.part._id
		newPieceInstance.dynamicallyInserted = getCurrentTime()

		// exclusiveGroup is handled at runtime by processAndPrunePieceInstanceTimings

		cache.PieceInstances.insert(newPieceInstance)
		if (span) span.end()
	}

	export function innerStopPieces(
		cache: CacheForPlayout,
		showStyleBase: ShowStyleBase,
		currentPartInstance: PartInstance,
		filter: (pieceInstance: PieceInstance) => boolean,
		timeOffset: number | undefined
	) {
		const span = profiler.startSpan('innerStopPieces')
		const stoppedInstances: PieceInstanceId[] = []

		const lastStartedPlayback = currentPartInstance.timings?.startedPlayback
		if (lastStartedPlayback === undefined) {
			throw new Error('Cannot stop pieceInstances when partInstance hasnt started playback')
		}

		const resolvedPieces = getResolvedPieces(cache, showStyleBase, currentPartInstance)
		const stopAt = getCurrentTime() + (timeOffset || 0)
		const relativeStopAt = stopAt - lastStartedPlayback

		const stoppedInfiniteIds = new Set<PieceId>()

		for (const pieceInstance of resolvedPieces) {
			if (!pieceInstance.userDuration && !pieceInstance.piece.virtual && filter(pieceInstance)) {
				switch (pieceInstance.piece.lifespan) {
					case PieceLifespan.WithinPart:
					case PieceLifespan.OutOnSegmentChange:
					case PieceLifespan.OutOnRundownChange: {
						logger.info(`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt}`)
						const up: Partial<PieceInstance> = {
							userDuration: {
								end: relativeStopAt,
							},
						}
						if (pieceInstance.infinite) {
							// Mark where this ends
							up['infinite.lastPartInstanceId'] = currentPartInstance._id
							stoppedInfiniteIds.add(pieceInstance.infinite.infinitePieceId)
						}

						cache.PieceInstances.update(
							{
								_id: pieceInstance._id,
							},
							{
								$set: up,
							}
						)

						stoppedInstances.push(pieceInstance._id)
						break
					}
					case PieceLifespan.OutOnSegmentEnd:
					case PieceLifespan.OutOnRundownEnd: {
						logger.info(
							`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt} with a virtual`
						)

						const pieceId: PieceId = protectString(Random.id())
						cache.PieceInstances.insert({
							...rewrapPieceToInstance(
								{
									_id: pieceId,
									externalId: '-',
									enable: { start: relativeStopAt },
									lifespan: pieceInstance.piece.lifespan,
									sourceLayerId: pieceInstance.piece.sourceLayerId,
									outputLayerId: pieceInstance.piece.outputLayerId,
									invalid: false,
									name: '',
									startPartId: currentPartInstance.part._id,
									status: RundownAPI.PieceStatusCode.UNKNOWN,
									virtual: true,
								},
								currentPartInstance.rundownId,
								currentPartInstance._id
							),
							dynamicallyInserted: getCurrentTime(),
							infinite: {
								infinitePieceId: pieceId,
								fromPreviousPart: false,
							},
						})

						stoppedInstances.push(pieceInstance._id)
						break
					}
					default:
						assertNever(pieceInstance.piece.lifespan)
				}
			}
		}

		if (span) span.end()
		return stoppedInstances
	}
	export function startBucketAdlibPiece(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: PieceId,
		queue: boolean
	) {
		const bucketAdlib = BucketAdLibs.findOne(bucketAdlibId)
		if (!bucketAdlib) throw new Meteor.Error(404, `Bucket Adlib "${bucketAdlibId}" not found!`)

		return rundownPlaylistPlayoutSyncFunction(
			context,
			'startBucketAdlibPiece',
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
				if (!playlist.active)
					throw new Meteor.Error(403, `Bucket AdLib-pieces can be only placed in an active rundown!`)
				if (!playlist.currentPartInstanceId)
					throw new Meteor.Error(400, `A part needs to be active to use a bucket adlib`)
				if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
					throw new Meteor.Error(403, `Buckete AdLib-pieces can not be used in combination with hold!`)
				}
				if (!queue && playlist.currentPartInstanceId !== partInstanceId)
					throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)
			},
			(cache) => {
				const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (!currentPartInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
				const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${currentPartInstance.rundownId}" not found!`)

				if (
					bucketAdlib.showStyleVariantId !== rundown.showStyleVariantId ||
					bucketAdlib.studioId !== rundown.studioId
				) {
					throw new Meteor.Error(
						404,
						`Bucket AdLib "${bucketAdlibId}" is not compatible with rundown "${rundown._id}"!`
					)
				}

				const newPieceInstance = convertAdLibToPieceInstance(bucketAdlib, currentPartInstance, queue)
				innerStartAdLibPiece(cache, rundown, currentPartInstance, newPieceInstance)
			}
		)
	}
}
