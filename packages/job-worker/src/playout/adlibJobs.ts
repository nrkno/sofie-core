import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'
import { JobContext, ProcessedShowStyleCompound } from '../jobs'
import {
	AdlibPieceStartProps,
	DisableNextPieceProps,
	StartStickyPieceOnSourceLayerProps,
	StopPiecesOnSourceLayersProps,
	TakePieceAsAdlibNowProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { PlayoutModel } from './model/PlayoutModel'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel'
import { runJobWithPlayoutCache } from './lock'
import { updateTimeline } from './timeline/generate'
import { getCurrentTime } from '../lib'
import { convertAdLibToPieceInstance, convertPieceToAdLibPiece, sortPieceInstancesByStart } from './pieces'
import { getResolvedPiecesForCurrentPartInstance } from './resolvedPieces'
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
			const playlist = cache.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (playlist.currentPartInfo?.partInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (cache) => {
			const currentPartInstance = cache.CurrentPartInstance
			if (!currentPartInstance) throw UserError.create(UserErrorMessage.InactiveRundown)
			const currentRundown = cache.getRundown(currentPartInstance.PartInstance.rundownId)
			if (!currentRundown)
				throw new Error(`Missing Rundown for PartInstance: ${currentPartInstance.PartInstance._id}`)

			const rundownIds = cache.getRundownIds()

			const pieceInstanceToCopy = cache.findPieceInstance(data.pieceInstanceIdOrPieceIdToCopy as PieceInstanceId)

			const pieceToCopy = pieceInstanceToCopy
				? clone<PieceInstancePiece>(pieceInstanceToCopy.pieceInstance.piece)
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

			const showStyleCompound = await context.getShowStyleCompound(
				currentRundown.Rundown.showStyleVariantId,
				currentRundown.Rundown.showStyleBaseId
			)
			if (!pieceToCopy.allowDirectPlay) {
				throw UserError.from(
					new Error(
						`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" cannot be direct played!`
					),
					UserErrorMessage.PieceAsAdlibNotDirectPlayable
				)
			}

			switch (pieceToCopy.allowDirectPlay.type) {
				case IBlueprintDirectPlayType.AdLibPiece:
					await pieceTakeNowAsAdlib(
						context,
						cache,
						showStyleCompound,
						currentPartInstance,
						pieceToCopy,
						pieceInstanceToCopy
					)
					break
				case IBlueprintDirectPlayType.AdLibAction: {
					const executeProps = pieceToCopy.allowDirectPlay

					const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)
					const watchedPackages = WatchedPackagesHelper.empty(context) // TODO: should this be able to retrieve any watched packages?

					await executeActionInner(
						context,
						cache,
						currentRundown,
						showStyleCompound,
						blueprint,
						watchedPackages,
						{
							...executeProps,
							triggerMode: undefined,
						}
					)
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
	)
}
async function pieceTakeNowAsAdlib(
	context: JobContext,
	cache: PlayoutModel,
	showStyleBase: ReadonlyDeep<ProcessedShowStyleCompound>,
	currentPartInstance: PlayoutPartInstanceModel,
	pieceToCopy: PieceInstancePiece,
	pieceInstanceToCopy:
		| { partInstance: PlayoutPartInstanceModel; pieceInstance: ReadonlyDeep<PieceInstance> }
		| undefined
): Promise<void> {
	/*const newPieceInstance = */ convertAdLibToPieceInstance(context, pieceToCopy, currentPartInstance, false)

	// Disable the original piece if from the same Part
	if (
		pieceInstanceToCopy &&
		pieceInstanceToCopy.pieceInstance.partInstanceId === currentPartInstance.PartInstance._id
	) {
		// Ensure the piece being copied isnt currently live
		if (
			pieceInstanceToCopy.pieceInstance.plannedStartedPlayback &&
			pieceInstanceToCopy.pieceInstance.plannedStartedPlayback <= getCurrentTime()
		) {
			const resolvedPieces = getResolvedPiecesForCurrentPartInstance(
				context,
				showStyleBase.sourceLayers,
				currentPartInstance
			)
			const resolvedPieceBeingCopied = resolvedPieces.find(
				(p) => p.instance._id === pieceInstanceToCopy.pieceInstance._id
			)

			if (
				resolvedPieceBeingCopied?.resolvedDuration !== undefined &&
				(resolvedPieceBeingCopied.instance.infinite ||
					resolvedPieceBeingCopied.resolvedStart + resolvedPieceBeingCopied.resolvedDuration >=
						getCurrentTime())
			) {
				// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
				throw UserError.from(
					new Error(
						`PieceInstance "${pieceInstanceToCopy.pieceInstance._id}" is currently live and cannot be used as an ad-lib`
					),
					UserErrorMessage.PieceAsAdlibCurrentlyLive
				)
			}
		}

		// TODO: is this ok?
		currentPartInstance.setPieceInstanceDisabled(pieceInstanceToCopy.pieceInstance._id, true)
	}

	await syncPlayheadInfinitesForNextPartInstance(context, cache, cache.CurrentPartInstance, cache.NextPartInstance)

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
			const playlist = cache.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (!data.queue && playlist.currentPartInfo?.partInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (cache) => {
			const partInstance = cache.getPartInstance(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const rundown = cache.getRundown(partInstance.PartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.PartInstance.rundownId}" not found!`)

			// Rundows that share the same showstyle variant as the current rundown, so adlibs from these rundowns are safe to play
			const safeRundownIds = cache.Rundowns.filter(
				(rd) => rd.Rundown.showStyleVariantId === rundown.Rundown.showStyleVariantId
			).map((r) => r.Rundown._id)

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

				if (bucketAdlib && bucketAdlib.showStyleVariantId !== rundown.Rundown.showStyleVariantId) {
					throw UserError.from(
						new Error(
							`Bucket AdLib "${data.adLibPieceId}" is not compatible with rundown "${rundown.Rundown._id}"!`
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
			const playlist = cache.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const currentPartInstance = cache.CurrentPartInstance
			if (!currentPartInstance) throw UserError.create(UserErrorMessage.NoCurrentPart)

			const rundown = cache.getRundown(currentPartInstance.PartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.PartInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.Rundown.showStyleBaseId)
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
			const playlist = cache.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const partInstance = cache.getPartInstance(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const lastStartedPlayback = partInstance.PartInstance.timings?.plannedStartedPlayback
			if (!lastStartedPlayback) throw new Error(`Part "${data.partInstanceId}" has yet to start playback!`)

			const rundown = cache.getRundown(partInstance.PartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.PartInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.Rundown.showStyleBaseId)
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
				await syncPlayheadInfinitesForNextPartInstance(
					context,
					cache,
					cache.CurrentPartInstance,
					cache.NextPartInstance
				)

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
			const playlist = cache.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const playlist = cache.Playlist

			const currentPartInstance = cache.CurrentPartInstance
			const nextPartInstance = cache.NextPartInstance
			if (!currentPartInstance)
				throw new Error(`PartInstance "${playlist.currentPartInfo?.partInstanceId}" not found!`)

			const rundown = cache.getRundown(currentPartInstance.PartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.PartInstance.rundownId}" not found!`)
			const showStyleBase = await context.getShowStyleBase(rundown.Rundown.showStyleBaseId)

			// logger.info(o)
			// logger.info(JSON.stringify(o, '', 2))

			const allowedSourceLayers = showStyleBase.sourceLayers

			const getNextPiece = (partInstance: PlayoutPartInstanceModel, ignoreStartedPlayback: boolean) => {
				// Find next piece to disable

				let nowInPart = 0
				if (!ignoreStartedPlayback && partInstance.PartInstance.timings?.plannedStartedPlayback) {
					nowInPart = getCurrentTime() - partInstance.PartInstance.timings?.plannedStartedPlayback
				}

				const filteredPieces = partInstance.PieceInstances.filter((piece) => {
					const sourceLayer = allowedSourceLayers[piece.piece.sourceLayerId]
					if (
						sourceLayer?.allowDisable &&
						!piece.piece.virtual &&
						piece.piece.pieceType === IBlueprintPieceType.Normal
					)
						return true
					return false
				})

				const sortedPieces: ReadonlyDeep<PieceInstance>[] = sortPieceInstancesByStart(
					_.sortBy(filteredPieces, (piece) => {
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

			const partInstances: Array<[PlayoutPartInstanceModel | null, boolean]> = [
				[currentPartInstance, false],
				[nextPartInstance, true], // If not found in currently playing part, let's look in the next one:
			]
			if (data.undo) partInstances.reverse()

			let disabledPiece = false

			for (const [partInstance, ignoreStartedPlayback] of partInstances) {
				if (partInstance && !disabledPiece) {
					const candidatePieceInstance = getNextPiece(partInstance, ignoreStartedPlayback)
					if (candidatePieceInstance) {
						logger.debug(
							(data.undo ? 'Disabling' : 'Enabling') + ' next PieceInstance ' + candidatePieceInstance._id
						)
						partInstance.setPieceInstanceDisabled(candidatePieceInstance._id, !data.undo)
						disabledPiece = true

						break
					}
				}
			}

			if (disabledPiece) {
				await updateTimeline(context, cache)
			} else {
				cache.assertNoChanges()

				throw UserError.create(UserErrorMessage.DisableNoPieceFound)
			}
		}
	)
}
