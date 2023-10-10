import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { assertNever, getRandomId, getRank } from '@sofie-automation/corelib/dist/lib'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { PlayoutModel } from './model/PlayoutModel'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { convertAdLibToPieceInstance } from './pieces'
import { getResolvedPiecesForCurrentPartInstance } from './resolvedPieces'
import { updateTimeline } from './timeline/generate'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { updatePartInstanceRanksAfterAdlib } from '../rundown'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { calculateNowOffsetLatency } from './timeline/multi-gateway'
import { logger } from '../logging'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutRundownModel } from './model/PlayoutRundownModel'

export async function innerStartOrQueueAdLibPiece(
	context: JobContext,
	playoutModel: PlayoutModel,
	rundown: PlayoutRundownModel,
	queue: boolean,
	currentPartInstance: PlayoutPartInstanceModel,
	adLibPiece: AdLibPiece | BucketAdLib
): Promise<PartInstanceId | undefined> {
	const span = context.startSpan('innerStartOrQueueAdLibPiece')
	let queuedPartInstanceId: PartInstanceId | undefined
	if (queue || adLibPiece.toBeQueued) {
		const newPartInstance = playoutModel.insertAdlibbedPartInstance({
			_id: getRandomId(),
			_rank: 99999, // Corrected in innerStartQueuedAdLib
			externalId: '',
			title: adLibPiece.name,
			expectedDuration: adLibPiece.expectedDuration,
			expectedDurationWithPreroll: adLibPiece.expectedDuration, // Filled in later
		})

		convertAdLibToPieceInstance(context, adLibPiece, newPartInstance, queue)

		newPartInstance.recalculateExpectedDurationWithPreroll()

		await innerStartQueuedAdLib(context, playoutModel, rundown, currentPartInstance, newPartInstance)
		queuedPartInstanceId = newPartInstance.PartInstance._id

		// syncPlayheadInfinitesForNextPartInstance is handled by setNextPart
	} else {
		convertAdLibToPieceInstance(context, adLibPiece, currentPartInstance, queue)

		await syncPlayheadInfinitesForNextPartInstance(
			context,
			playoutModel,
			currentPartInstance,
			playoutModel.NextPartInstance
		)
	}

	await updateTimeline(context, playoutModel)

	if (span) span.end()
	return queuedPartInstanceId
}

export async function innerFindLastPieceOnLayer(
	context: JobContext,
	playoutModel: PlayoutModel,
	sourceLayerId: string[],
	originalOnly: boolean,
	customQuery?: MongoQuery<PieceInstance>
): Promise<PieceInstance | undefined> {
	const span = context.startSpan('innerFindLastPieceOnLayer')
	const rundownIds = playoutModel.getRundownIds()

	const query: MongoQuery<PieceInstance> = {
		...customQuery,
		playlistActivationId: playoutModel.Playlist.activationId,
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
	cache: PlayoutModel,
	sourceLayerId: string[],
	customQuery?: MongoQuery<Piece>
): Promise<Piece | undefined> {
	const span = context.startSpan('innerFindLastScriptedPieceOnLayer')

	const playlist = cache.Playlist
	const rundownIds = cache.getRundownIds()

	// TODO - this should throw instead of return more?

	if (!playlist.currentPartInfo || !playlist.activationId) {
		return
	}

	const currentPartInstance = cache.CurrentPartInstance?.PartInstance

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
	const part = cache
		.getAllOrderedParts()
		.filter((p) => pieceIdSet.has(p._id) && p._rank <= currentPartInstance.part._rank)
		.reverse()[0]

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
	cache: PlayoutModel,
	rundown: PlayoutRundownModel,
	currentPartInstance: PlayoutPartInstanceModel,
	newPartInstance: PlayoutPartInstanceModel
): Promise<void> {
	const span = context.startSpan('innerStartQueuedAdLib')

	// Find the following part, so we can pick a good rank
	const followingPart = selectNextPart(
		context,
		cache.Playlist,
		currentPartInstance.PartInstance,
		null,
		cache.getAllOrderedSegments(),
		cache.getAllOrderedParts(),
		false // We want to insert it before any trailing invalid piece
	)
	newPartInstance.setRank(
		getRank(
			currentPartInstance.PartInstance.part,
			followingPart?.part?.segmentId === newPartInstance.PartInstance.segmentId ? followingPart?.part : undefined
		)
	)

	updatePartInstanceRanksAfterAdlib(cache, newPartInstance.PartInstance.segmentId)

	// Find and insert any rundown defined infinites that we should inherit
	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(
		context,
		cache,
		undefined,
		newPartInstance.PartInstance.part
	)
	const infinitePieceInstances = getPieceInstancesForPart(
		context,
		cache,
		currentPartInstance,
		rundown,
		newPartInstance.PartInstance.part,
		possiblePieces,
		newPartInstance.PartInstance._id
	)
	newPartInstance.insertInfinitePieces(infinitePieceInstances)

	await setNextPart(context, cache, newPartInstance, false)

	if (span) span.end()
}

export function innerStopPieces(
	context: JobContext,
	cache: PlayoutModel,
	sourceLayers: SourceLayers,
	currentPartInstance: PlayoutPartInstanceModel,
	filter: (pieceInstance: ReadonlyDeep<PieceInstance>) => boolean,
	timeOffset: number | undefined
): Array<PieceInstanceId> {
	const span = context.startSpan('innerStopPieces')
	const stoppedInstances: PieceInstanceId[] = []

	const lastStartedPlayback = currentPartInstance.PartInstance.timings?.plannedStartedPlayback
	if (lastStartedPlayback === undefined) {
		throw new Error('Cannot stop pieceInstances when partInstance hasnt started playback')
	}

	const resolvedPieces = getResolvedPiecesForCurrentPartInstance(context, sourceLayers, currentPartInstance)
	const offsetRelativeToNow = (timeOffset || 0) + (calculateNowOffsetLatency(context, cache, undefined) || 0)
	const stopAt = getCurrentTime() + offsetRelativeToNow
	const relativeStopAt = stopAt - lastStartedPlayback

	for (const resolvedPieceInstance of resolvedPieces) {
		const pieceInstance = resolvedPieceInstance.instance
		if (
			!pieceInstance.userDuration &&
			!pieceInstance.piece.virtual &&
			filter(pieceInstance) &&
			resolvedPieceInstance.resolvedStart !== undefined &&
			resolvedPieceInstance.resolvedStart <= relativeStopAt &&
			!pieceInstance.plannedStoppedPlayback
		) {
			switch (pieceInstance.piece.lifespan) {
				case PieceLifespan.WithinPart:
				case PieceLifespan.OutOnSegmentChange:
				case PieceLifespan.OutOnRundownChange: {
					logger.info(`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt}`)

					const newDuration: Required<PieceInstance>['userDuration'] = cache.isMultiGatewayMode
						? {
								endRelativeToNow: offsetRelativeToNow,
						  }
						: {
								endRelativeToPart: relativeStopAt,
						  }

					currentPartInstance.setPieceInstanceDuration(pieceInstance._id, newDuration)

					stoppedInstances.push(pieceInstance._id)
					break
				}
				case PieceLifespan.OutOnSegmentEnd:
				case PieceLifespan.OutOnRundownEnd:
				case PieceLifespan.OutOnShowStyleEnd: {
					logger.info(
						`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt} with a virtual`
					)

					currentPartInstance.insertVirtualPiece(
						relativeStopAt,
						pieceInstance.piece.lifespan,
						pieceInstance.piece.sourceLayerId,
						pieceInstance.piece.outputLayerId
					)

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
