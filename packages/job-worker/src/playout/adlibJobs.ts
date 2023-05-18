import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'
import { ProcessedShowStyleBase, JobContext } from '../jobs'
import {
	AdlibPieceStartProps,
	DisableNextPieceProps,
	StartStickyPieceOnSourceLayerProps,
	StopPiecesOnSourceLayersProps,
	TakePieceAsAdlibNowProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { CacheForPlayout, getRundownIDsFromCache, getSelectedPartInstancesFromCache } from './cache'
import { runJobWithPlayoutCache } from './lock'
import { updateTimeline } from './timeline/generate'
import { getCurrentTime } from '../lib'
import {
	convertAdLibToPieceInstance,
	convertPieceToAdLibPiece,
	getResolvedPieces,
	sortPieceInstancesByStart,
} from './pieces'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { PieceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IBlueprintDirectPlayType, IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { innerFindLastPieceOnLayer, innerStartOrQueueAdLibPiece, innerStopPieces } from './adlibUtils'
import _ = require('underscore')
import { executeActionInner } from './adlibAction'

/**
 * Play an existing Piece in the Rundown as an AdLib
 */
export async function handleTakePieceAsAdlibNow(context: JobContext, data: TakePieceAsAdlibNowProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (playlist.currentPartInfo?.partInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (cache) => {
			const rundownIds = getRundownIDsFromCache(cache)

			const pieceInstanceToCopy = cache.PieceInstances.findOne(
				data.pieceInstanceIdOrPieceIdToCopy as PieceInstanceId
			)

			const pieceToCopy = pieceInstanceToCopy
				? pieceInstanceToCopy.piece
				: ((await context.directCollections.Pieces.findOne({
						_id: data.pieceInstanceIdOrPieceIdToCopy as PieceId,
						startRundownId: { $in: rundownIds },
				  })) as Piece)
			if (!pieceToCopy) {
				throw UserError.from(
					new Error(`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" not found!`),
					UserErrorMessage.PieceAsAdlibNotFound
				)
			}

			const partInstance = cache.PartInstances.findOne(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)
			if (!pieceToCopy.allowDirectPlay) {
				throw UserError.from(
					new Error(
						`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" cannot be direct played!`
					),
					UserErrorMessage.PieceAsAdlibNotDirectPlayable
				)
			} else {
				switch (pieceToCopy.allowDirectPlay.type) {
					case IBlueprintDirectPlayType.AdLibPiece:
						await pieceTakeNowAsAdlib(
							context,
							cache,
							showStyleBase,
							partInstance,
							pieceToCopy,
							pieceInstanceToCopy
						)
						break
					case IBlueprintDirectPlayType.AdLibAction: {
						const executeProps = pieceToCopy.allowDirectPlay
						const showStyle = await context.getShowStyleCompound(
							rundown.showStyleVariantId,
							rundown.showStyleBaseId
						)
						const blueprint = await context.getShowStyleBlueprint(showStyle._id)
						const watchedPackages = WatchedPackagesHelper.empty(context) // TODO: should this be able to retrieve any watched packages?

						await executeActionInner(context, cache, rundown, showStyle, blueprint, watchedPackages, {
							...executeProps,
							triggerMode: undefined,
						})
						break
					}
					default:
						assertNever(pieceToCopy.allowDirectPlay)
						throw UserError.from(
							new Error(
								`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" cannot be direct played!`
							),
							UserErrorMessage.PieceAsAdlibNotDirectPlayable
						)
				}
			}
		}
	)
}
async function pieceTakeNowAsAdlib(
	context: JobContext,
	cache: CacheForPlayout,
	showStyleBase: ReadonlyDeep<ProcessedShowStyleBase>,
	partInstance: DBPartInstance,
	pieceToCopy: PieceInstancePiece,
	pieceInstanceToCopy: PieceInstance | undefined
): Promise<void> {
	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

	const newPieceInstance = convertAdLibToPieceInstance(
		context,
		playlist.activationId,
		pieceToCopy,
		partInstance,
		false
	)

	// Disable the original piece if from the same Part
	if (pieceInstanceToCopy && pieceInstanceToCopy.partInstanceId === partInstance._id) {
		// Ensure the piece being copied isnt currently live
		if (
			pieceInstanceToCopy.plannedStartedPlayback &&
			pieceInstanceToCopy.plannedStartedPlayback <= getCurrentTime()
		) {
			const resolvedPieces = getResolvedPieces(context, cache, showStyleBase.sourceLayers, partInstance)
			const resolvedPieceBeingCopied = resolvedPieces.find((p) => p._id === pieceInstanceToCopy._id)

			if (
				resolvedPieceBeingCopied &&
				resolvedPieceBeingCopied.resolvedDuration !== undefined &&
				(resolvedPieceBeingCopied.infinite ||
					resolvedPieceBeingCopied.resolvedStart + resolvedPieceBeingCopied.resolvedDuration >=
						getCurrentTime())
			) {
				// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
				throw UserError.from(
					new Error(
						`PieceInstance "${pieceInstanceToCopy._id}" is currently live and cannot be used as an ad-lib`
					),
					UserErrorMessage.PieceAsAdlibCurrentlyLive
				)
			}
		}

		cache.PieceInstances.remove(pieceInstanceToCopy._id)
	}

	cache.PieceInstances.insert(newPieceInstance)

	await syncPlayheadInfinitesForNextPartInstance(context, cache)

	await updateTimeline(context, cache)
}

/**
 * Play an AdLib piece by its id
 */
export async function handleAdLibPieceStart(context: JobContext, data: AdlibPieceStartProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (!data.queue && playlist.currentPartInfo?.partInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (cache) => {
			const partInstance = cache.PartInstances.findOne(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

			// Rundows that share the same showstyle variant as the current rundown, so adlibs from these rundowns are safe to play
			const safeRundownIds = cache.Rundowns.findAll(
				(rd) => rd.showStyleVariantId === rundown.showStyleVariantId
			).map((r) => r._id)

			let adLibPiece: AdLibPiece | BucketAdLib | undefined
			if (data.pieceType === 'baseline') {
				adLibPiece = await context.directCollections.RundownBaselineAdLibPieces.findOne({
					_id: data.adLibPieceId,
					rundownId: { $in: safeRundownIds },
				})
			} else if (data.pieceType === 'normal') {
				adLibPiece = await context.directCollections.AdLibPieces.findOne({
					_id: data.adLibPieceId,
					rundownId: { $in: safeRundownIds },
				})
			} else if (data.pieceType === 'bucket') {
				const bucketAdlib = await context.directCollections.BucketAdLibPieces.findOne({
					_id: data.adLibPieceId,
					studioId: context.studioId,
				})

				if (bucketAdlib && bucketAdlib.showStyleVariantId !== rundown.showStyleVariantId) {
					throw UserError.from(
						new Error(
							`Bucket AdLib "${data.adLibPieceId}" is not compatible with rundown "${rundown._id}"!`
						),
						UserErrorMessage.BucketAdlibIncompatible
					)
				}

				adLibPiece = bucketAdlib
			}

			if (!adLibPiece)
				throw UserError.from(
					new Error(`AdLib Piece "${data.adLibPieceId}" ("${data.pieceType}") not found!`),
					UserErrorMessage.AdlibNotFound
				)
			if (adLibPiece.invalid)
				throw UserError.from(
					new Error(`Cannot take invalid AdLib Piece "${data.adLibPieceId}"!`),
					UserErrorMessage.AdlibUnplayable
				)
			if (adLibPiece.floated)
				throw UserError.from(
					new Error(`Cannot take floated AdLib Piece "${data.adLibPieceId}"!`),
					UserErrorMessage.AdlibUnplayable
				)

			await innerStartOrQueueAdLibPiece(context, cache, rundown, !!data.queue, partInstance, adLibPiece)
		}
	)
}

/**
 * Find and play a sticky Piece on a SourceLayer
 */
export async function handleStartStickyPieceOnSourceLayer(
	context: JobContext,
	data: StartStickyPieceOnSourceLayerProps
): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
			if (!currentPartInstance) throw UserError.create(UserErrorMessage.NoCurrentPart)

			const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)
			const sourceLayer = showStyleBase.sourceLayers[data.sourceLayerId]
			if (!sourceLayer) throw new Error(`Source layer "${data.sourceLayerId}" not found!`)

			if (!sourceLayer.isSticky)
				throw UserError.from(
					new Error(`Only sticky layers can be restarted. "${data.sourceLayerId}" is not sticky.`),
					UserErrorMessage.SourceLayerNotSticky
				)

			const lastPieceInstance = await innerFindLastPieceOnLayer(
				context,
				cache,
				[sourceLayer._id],
				sourceLayer.stickyOriginalOnly || false
			)
			if (!lastPieceInstance) {
				throw UserError.create(UserErrorMessage.SourceLayerStickyNothingFound)
			}

			const lastPiece = convertPieceToAdLibPiece(context, lastPieceInstance.piece)
			await innerStartOrQueueAdLibPiece(context, cache, rundown, false, currentPartInstance, lastPiece)
		}
	)
}

/**
 * Stop any playing Pieces on some SourceLayers
 */
export async function handleStopPiecesOnSourceLayers(
	context: JobContext,
	data: StopPiecesOnSourceLayersProps
): Promise<void> {
	if (data.sourceLayerIds.length === 0) return
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const partInstance = cache.PartInstances.findOne(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const lastStartedPlayback = partInstance.timings?.plannedStartedPlayback
			if (!lastStartedPlayback) throw new Error(`Part "${data.partInstanceId}" has yet to start playback!`)

			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)
			const sourceLayerIds = new Set(data.sourceLayerIds)
			const changedIds = innerStopPieces(
				context,
				cache,
				showStyleBase.sourceLayers,
				partInstance,
				(pieceInstance) => sourceLayerIds.has(pieceInstance.piece.sourceLayerId),
				undefined
			)

			if (changedIds.length) {
				await syncPlayheadInfinitesForNextPartInstance(context, cache)

				await updateTimeline(context, cache)
			}
		}
	)
}

/**
 * Disable the next Piece which allows being disabled
 */
export async function handleDisableNextPiece(context: JobContext, data: DisableNextPieceProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const playlist = cache.Playlist.doc

			const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
			if (!currentPartInstance)
				throw new Error(`PartInstance "${playlist.currentPartInfo?.partInstanceId}" not found!`)

			const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.rundownId}" not found!`)
			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)

			// logger.info(o)
			// logger.info(JSON.stringify(o, '', 2))

			const allowedSourceLayers = showStyleBase.sourceLayers

			const getNextPiece = (partInstance: DBPartInstance, ignoreStartedPlayback: boolean) => {
				// Find next piece to disable

				let nowInPart = 0
				if (!ignoreStartedPlayback && partInstance.timings?.plannedStartedPlayback) {
					nowInPart = getCurrentTime() - partInstance.timings?.plannedStartedPlayback
				}

				const pieceInstances = cache.PieceInstances.findAll((p) => p.partInstanceId === partInstance._id)

				const filteredPieces = pieceInstances.filter((piece: PieceInstance) => {
					const sourceLayer = allowedSourceLayers[piece.piece.sourceLayerId]
					if (
						sourceLayer &&
						sourceLayer.allowDisable &&
						!piece.piece.virtual &&
						piece.piece.pieceType === IBlueprintPieceType.Normal
					)
						return true
					return false
				})

				const sortedPieces: PieceInstance[] = sortPieceInstancesByStart(
					_.sortBy(filteredPieces, (piece: PieceInstance) => {
						const sourceLayer = allowedSourceLayers[piece.piece.sourceLayerId]
						return sourceLayer?._rank || -9999
					}),
					nowInPart
				)

				const findLast = !!data.undo

				if (findLast) sortedPieces.reverse()

				return sortedPieces.find((piece) => {
					return (
						piece.piece.enable.start >= nowInPart &&
						((!data.undo && !piece.disabled) || (data.undo && piece.disabled))
					)
				})
			}

			const partInstances: Array<[DBPartInstance | undefined, boolean]> = [
				[currentPartInstance, false],
				[nextPartInstance, true], // If not found in currently playing part, let's look in the next one:
			]
			if (data.undo) partInstances.reverse()

			let nextPieceInstance: PieceInstance | undefined

			for (const [partInstance, ignoreStartedPlayback] of partInstances) {
				if (partInstance) {
					nextPieceInstance = getNextPiece(partInstance, ignoreStartedPlayback)
					if (nextPieceInstance) break
				}
			}

			if (nextPieceInstance) {
				logger.debug((data.undo ? 'Disabling' : 'Enabling') + ' next PieceInstance ' + nextPieceInstance._id)
				cache.PieceInstances.updateOne(nextPieceInstance._id, (p) => {
					p.disabled = !data.undo
					return p
				})

				await updateTimeline(context, cache)
			} else {
				cache.assertNoChanges()

				throw UserError.create(UserErrorMessage.DisableNoPieceFound)
			}
		}
	)
}
