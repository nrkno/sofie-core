import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { PartInstanceId, PieceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { EmptyPieceTimelineObjectsBlob, Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, rewrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { assertNever, getRandomId, getRank } from '@sofie-automation/corelib/dist/lib'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { calculatePartExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getRundownIDsFromCache } from './cache'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { convertAdLibToPieceInstance, getResolvedPieces, setupPieceInstanceInfiniteProperties } from './pieces'
import { updateTimeline } from './timeline/generate'
import { PieceLifespan, IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { updatePartInstanceRanksAfterAdlib } from '../rundown'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { calculateNowOffsetLatency } from './timeline/multi-gateway'
import { logger } from '../logging'

export async function innerStartOrQueueAdLibPiece(
	context: JobContext,
	cache: CacheForPlayout,
	rundown: DBRundown,
	queue: boolean,
	currentPartInstance: DBPartInstance,
	adLibPiece: AdLibPiece | BucketAdLib
): Promise<PartInstanceId | undefined> {
	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw new Error('RundownPlaylist is not active')

	const span = context.startSpan('innerStartOrQueueAdLibPiece')
	let queuedPartInstanceId: PartInstanceId | undefined
	if (queue || adLibPiece.toBeQueued) {
		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: rundown._id,
			segmentId: currentPartInstance.segmentId,
			playlistActivationId: playlist.activationId,
			segmentPlayoutId: currentPartInstance.segmentPlayoutId,
			takeCount: currentPartInstance.takeCount + 1,
			rehearsal: !!playlist.rehearsal,
			orphaned: 'adlib-part',
			part: {
				_id: getRandomId(),
				_rank: 99999, // Corrected in innerStartQueuedAdLib
				externalId: '',
				segmentId: currentPartInstance.segmentId,
				rundownId: rundown._id,
				title: adLibPiece.name,
				expectedDuration: adLibPiece.expectedDuration,
				expectedDurationWithPreroll: adLibPiece.expectedDuration, // Filled in later
			},
		}
		const newPieceInstance = convertAdLibToPieceInstance(
			context,
			playlist.activationId,
			adLibPiece,
			newPartInstance,
			queue
		)

		newPartInstance.part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(
			newPartInstance.part,
			[newPieceInstance.piece]
		)

		await innerStartQueuedAdLib(context, cache, rundown, currentPartInstance, newPartInstance, [newPieceInstance])
		queuedPartInstanceId = newPartInstance._id

		// syncPlayheadInfinitesForNextPartInstance is handled by setNextPart
	} else {
		const newPieceInstance = convertAdLibToPieceInstance(
			context,
			playlist.activationId,
			adLibPiece,
			currentPartInstance,
			queue
		)
		innerStartAdLibPiece(context, cache, rundown, currentPartInstance, newPieceInstance)

		await syncPlayheadInfinitesForNextPartInstance(context, cache)
	}

	await updateTimeline(context, cache)

	if (span) span.end()
	return queuedPartInstanceId
}

export async function innerFindLastPieceOnLayer(
	context: JobContext,
	cache: CacheForPlayout,
	sourceLayerId: string[],
	originalOnly: boolean,
	customQuery?: MongoQuery<PieceInstance>
): Promise<PieceInstance | undefined> {
	const span = context.startSpan('innerFindLastPieceOnLayer')
	const rundownIds = getRundownIDsFromCache(cache)

	const query: MongoQuery<PieceInstance> = {
		...customQuery,
		playlistActivationId: cache.Playlist.doc.activationId,
		rundownId: { $in: rundownIds },
		'piece.sourceLayerId': { $in: sourceLayerId },
		plannedStartedPlayback: {
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
	return context.directCollections.PieceInstances.findOne(query, {
		sort: {
			plannedStartedPlayback: -1,
		},
	})
}

export async function innerFindLastScriptedPieceOnLayer(
	context: JobContext,
	cache: CacheForPlayout,
	sourceLayerId: string[],
	customQuery?: MongoQuery<Piece>
): Promise<Piece | undefined> {
	const span = context.startSpan('innerFindLastScriptedPieceOnLayer')

	const playlist = cache.Playlist.doc
	const rundownIds = getRundownIDsFromCache(cache)

	// TODO - this should throw instead of return more?

	if (!playlist.currentPartInfo || !playlist.activationId) {
		return
	}

	const currentPartInstance = cache.PartInstances.findOne(playlist.currentPartInfo.partInstanceId)

	if (!currentPartInstance) {
		return
	}

	const query = {
		...customQuery,
		startRundownId: { $in: rundownIds },
		sourceLayerId: { $in: sourceLayerId },
	}

	const pieces: Array<Pick<Piece, '_id' | 'startPartId' | 'enable'>> =
		await context.directCollections.Pieces.findFetch(query, {
			projection: { _id: 1, startPartId: 1, enable: 1 },
		})

	const pieceIdSet = new Set(pieces.map((p) => p.startPartId))
	const part = cache.Parts.findOne((p) => pieceIdSet.has(p._id) && p._rank <= currentPartInstance.part._rank, {
		sort: { _rank: -1 },
	})

	if (!part) {
		return
	}

	const partStarted = currentPartInstance.timings?.plannedStartedPlayback
	const nowInPart = partStarted ? getCurrentTime() - partStarted : 0

	const piecesSortedAsc = pieces
		.filter((p) => p.startPartId === part._id && (p.enable.start === 'now' || p.enable.start <= nowInPart))
		.sort((a, b) => {
			if (a.enable.start === 'now' && b.enable.start === 'now') return 0
			if (a.enable.start === 'now') return -1
			if (b.enable.start === 'now') return 1

			return b.enable.start - a.enable.start
		})

	const piece = piecesSortedAsc.shift()
	if (!piece) {
		return
	}

	const fullPiece = await context.directCollections.Pieces.findOne(piece._id)
	if (!fullPiece) return

	if (span) span.end()
	return fullPiece
}

export async function innerStartQueuedAdLib(
	context: JobContext,
	cache: CacheForPlayout,
	rundown: DBRundown,
	currentPartInstance: DBPartInstance,
	newPartInstance: DBPartInstance,
	newPieceInstances: PieceInstance[]
): Promise<void> {
	const span = context.startSpan('innerStartQueuedAdLib')

	// Ensure it is labelled as dynamic
	newPartInstance.orphaned = 'adlib-part'

	// Find the following part, so we can pick a good rank
	const followingPart = selectNextPart(
		context,
		cache.Playlist.doc,
		currentPartInstance,
		null,
		getOrderedSegmentsAndPartsFromPlayoutCache(cache),
		false // We want to insert it before any trailing invalid piece
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

	updatePartInstanceRanksAfterAdlib(cache, newPartInstance.part.segmentId)

	// Find and insert any rundown defined infinites that we should inherit
	newPartInstance = cache.PartInstances.findOne(newPartInstance._id) as DBPartInstance
	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, cache, undefined, newPartInstance.part)
	const infinitePieceInstances = getPieceInstancesForPart(
		context,
		cache,
		currentPartInstance,
		rundown,
		newPartInstance.part,
		possiblePieces,
		newPartInstance._id
	)
	for (const pieceInstance of infinitePieceInstances) {
		cache.PieceInstances.insert(pieceInstance)
	}

	await setNextPart(context, cache, newPartInstance, false)

	if (span) span.end()
}

export function innerStartAdLibPiece(
	context: JobContext,
	cache: CacheForPlayout,
	_rundown: DBRundown,
	existingPartInstance: DBPartInstance,
	newPieceInstance: PieceInstance
): void {
	const span = context.startSpan('innerStartAdLibPiece')
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
	context: JobContext,
	cache: CacheForPlayout,
	sourceLayers: SourceLayers,
	currentPartInstance: DBPartInstance,
	filter: (pieceInstance: PieceInstance) => boolean,
	timeOffset: number | undefined
): Array<PieceInstanceId> {
	const span = context.startSpan('innerStopPieces')
	const stoppedInstances: PieceInstanceId[] = []

	const lastStartedPlayback = currentPartInstance.timings?.plannedStartedPlayback
	if (lastStartedPlayback === undefined) {
		throw new Error('Cannot stop pieceInstances when partInstance hasnt started playback')
	}

	const resolvedPieces = getResolvedPieces(context, cache, sourceLayers, currentPartInstance)
	const offsetRelativeToNow = (timeOffset || 0) + (calculateNowOffsetLatency(context, cache, undefined) || 0)
	const stopAt = getCurrentTime() + offsetRelativeToNow
	const relativeStopAt = stopAt - lastStartedPlayback

	for (const pieceInstance of resolvedPieces) {
		if (
			!pieceInstance.userDuration &&
			!pieceInstance.piece.virtual &&
			filter(pieceInstance) &&
			pieceInstance.resolvedStart !== undefined &&
			pieceInstance.resolvedStart <= relativeStopAt &&
			!pieceInstance.plannedStoppedPlayback
		) {
			switch (pieceInstance.piece.lifespan) {
				case PieceLifespan.WithinPart:
				case PieceLifespan.OutOnSegmentChange:
				case PieceLifespan.OutOnRundownChange: {
					logger.info(`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt}`)

					cache.PieceInstances.updateOne(pieceInstance._id, (p) => {
						if (cache.isMultiGatewayMode) {
							p.userDuration = {
								endRelativeToNow: offsetRelativeToNow,
							}
						} else {
							p.userDuration = {
								endRelativeToPart: relativeStopAt,
							}
						}
						return p
					})

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
								status: PieceStatusCode.UNKNOWN,
								pieceType: IBlueprintPieceType.Normal,
								virtual: true,
								content: {},
								timelineObjectsString: EmptyPieceTimelineObjectsBlob,
							},
							currentPartInstance.playlistActivationId,
							currentPartInstance.rundownId,
							currentPartInstance._id
						),
						dynamicallyInserted: getCurrentTime(),
						infinite: {
							infiniteInstanceId: getRandomId(),
							infiniteInstanceIndex: 0,
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
