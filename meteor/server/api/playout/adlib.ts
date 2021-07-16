import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { SourceLayerType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import {
	getCurrentTime,
	literal,
	protectString,
	unprotectString,
	getRandomId,
	assertNever,
	getRank,
} from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Piece, PieceId, Pieces } from '../../../lib/collections/Pieces'
import { Part } from '../../../lib/collections/Parts'
import { prefixAllObjectIds, setNextPart, selectNextPart } from './lib'
import {
	convertAdLibToPieceInstance,
	getResolvedPieces,
	convertPieceToAdLibPiece,
	setupPieceInstanceInfiniteProperties,
} from './pieces'
import { updateTimeline } from './timeline'
import { updatePartInstanceRanks } from '../rundown'

import {
	PieceInstances,
	PieceInstance,
	PieceInstanceId,
	rewrapPieceToInstance,
} from '../../../lib/collections/PieceInstances'
import { PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { BucketAdLib, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { MongoQuery } from '../../../lib/typings/meteor'
import { fetchPiecesThatMayBeActiveForPart, syncPlayheadInfinitesForNextPartInstance } from './infinites'
import { RundownAPI } from '../../../lib/api/rundown'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { profiler } from '../profiler'
import { getPieceInstancesForPart } from './infinites'
import { PlayoutLockFunctionPriority, runPlayoutOperationWithCache } from './lockFunction'
import {
	CacheForPlayout,
	getOrderedSegmentsAndPartsFromPlayoutCache,
	getRundownIDsFromCache,
	getSelectedPartInstancesFromCache,
} from './cache'
import { ReadonlyDeep } from 'type-fest'
import { VerifiedRundownPlaylistContentAccess } from '../lib'

export namespace ServerPlayoutAdLibAPI {
	export function innerFindLastPieceOnLayer(
		cache: CacheForPlayout,
		sourceLayerId: string[],
		originalOnly: boolean,
		customQuery?: MongoQuery<PieceInstance>
	) {
		const span = profiler.startSpan('innerFindLastPieceOnLayer')
		const rundownIds = getRundownIDsFromCache(cache)

		const query = {
			...customQuery,
			playlistActivationId: cache.Playlist.doc.activationId,
			rundownId: { $in: rundownIds },
			'piece.sourceLayerId': { $in: sourceLayerId },
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

		if (span) span.end()

		// Note: This does not want to use the cache, as we want to search as far back as we can
		// TODO - will this cause problems?
		return PieceInstances.findOne(query, {
			sort: {
				startedPlayback: -1,
			},
		})
	}

	export function innerFindLastScriptedPieceOnLayer(
		cache: CacheForPlayout,
		sourceLayerId: string[],
		customQuery?: MongoQuery<Piece>
	) {
		const span = profiler.startSpan('innerFindLastScriptedPieceOnLayer')

		const playlist = cache.Playlist.doc
		const rundownIds = getRundownIDsFromCache(cache)

		if (!playlist.currentPartInstanceId || !playlist.activationId) {
			return
		}

		const currentPartInstance = cache.PartInstances.findOne(playlist.currentPartInstanceId)

		if (!currentPartInstance) {
			return
		}

		const query = {
			...customQuery,
			startRundownId: { $in: rundownIds },
			sourceLayerId: { $in: sourceLayerId },
		}

		const pieces = Pieces.find(query, { fields: { _id: 1, startPartId: 1, enable: 1 } }).fetch()

		const part = cache.Parts.findOne(
			{ _id: { $in: pieces.map((p) => p.startPartId) }, _rank: { $lte: currentPartInstance.part._rank } },
			{ sort: { _rank: -1 } }
		)

		if (!part) {
			return
		}

		const partStarted = currentPartInstance.timings?.startedPlayback
		const nowInPart = partStarted ? getCurrentTime() - partStarted : 0

		const piece = pieces
			.filter((p) => p.startPartId === part._id && (p.enable.start === 'now' || p.enable.start <= nowInPart))
			.sort((a, b) => {
				if (a.enable.start === 'now' && b.enable.start === 'now') return 0
				if (a.enable.start === 'now') return -1
				if (b.enable.start === 'now') return 1

				return b.enable.start - a.enable.start
			})[0]

		if (span) span.end()

		return piece
	}

	export async function innerStartQueuedAdLib(
		cache: CacheForPlayout,
		rundown: Rundown,
		currentPartInstance: PartInstance,
		newPartInstance: PartInstance,
		newPieceInstances: PieceInstance[]
	) {
		const span = profiler.startSpan('innerStartQueuedAdLib')
		logger.info('adlibQueueInsertPartInstance')

		// Ensure it is labelled as dynamic
		newPartInstance.orphaned = 'adlib-part'

		const followingPart = selectNextPart(
			cache.Playlist.doc,
			currentPartInstance,
			getOrderedSegmentsAndPartsFromPlayoutCache(cache),
			true
		)
		newPartInstance.part._rank = getRank(
			currentPartInstance.part,
			followingPart?.part?.segmentId === newPartInstance.segmentId ? followingPart?.part : undefined
		)

		cache.PartInstances.insert(newPartInstance)

		newPieceInstances.forEach((pieceInstance) => {
			// Ensure it is labelled as dynamic
			pieceInstance.dynamicallyInserted = getCurrentTime()
			pieceInstance.partInstanceId = newPartInstance._id
			pieceInstance.piece.startPartId = newPartInstance.part._id

			setupPieceInstanceInfiniteProperties(pieceInstance)

			cache.PieceInstances.insert(pieceInstance)
		})

		updatePartInstanceRanks(cache, [{ segmentId: newPartInstance.part.segmentId, oldPartIdsAndRanks: null }])

		// Find and insert any rundown defined infinites that we should inherit
		newPartInstance = cache.PartInstances.findOne(newPartInstance._id)!
		const possiblePieces = await fetchPiecesThatMayBeActiveForPart(cache, undefined, newPartInstance.part)
		const infinitePieceInstances = getPieceInstancesForPart(
			cache,
			currentPartInstance,
			rundown,
			newPartInstance.part,
			possiblePieces,
			newPartInstance._id,
			false
		)
		for (const pieceInstance of infinitePieceInstances) {
			cache.PieceInstances.insert(pieceInstance)
		}

		await setNextPart(cache, newPartInstance)

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

		setupPieceInstanceInfiniteProperties(newPieceInstance)

		// exclusiveGroup is handled at runtime by processAndPrunePieceInstanceTimings

		cache.PieceInstances.insert(newPieceInstance)
		if (span) span.end()
	}

	export function innerStopPieces(
		cache: CacheForPlayout,
		showStyleBase: ReadonlyDeep<ShowStyleBase>,
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
			if (
				!pieceInstance.userDuration &&
				!pieceInstance.piece.virtual &&
				filter(pieceInstance) &&
				pieceInstance.resolvedStart !== undefined &&
				pieceInstance.resolvedStart <= relativeStopAt &&
				!pieceInstance.stoppedPlayback
			) {
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
					case PieceLifespan.OutOnRundownEnd:
					case PieceLifespan.OutOnShowStyleEnd: {
						logger.info(
							`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt} with a virtual`
						)

						const pieceId: PieceId = getRandomId()
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
									content: {
										timelineObjects: [],
									},
								},
								currentPartInstance.playlistActivationId,
								currentPartInstance.rundownId,
								currentPartInstance._id
							),
							dynamicallyInserted: getCurrentTime(),
							infinite: {
								infiniteInstanceId: getRandomId(),
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
}
