import { PartInstanceId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/infinites'
import _ from 'underscore'
import { UIShowStyleBase } from '../../lib/api/showStyles'
import { PartInstances } from '../../lib/collections/PartInstances'
import { PieceInstance, PieceInstances } from '../../lib/collections/PieceInstances'
import { RequiresActiveLayers } from '../../lib/collections/RundownLayouts'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { getCurrentTime } from '../../lib/lib'
import { invalidateAt } from './../../lib/invalidatingTime'
import { memoizedIsolatedAutorun } from '../../lib/memoizedIsolatedAutorun'

/**
 * If the conditions of the filter are met, activePieceInstance will include the first piece instance found that matches the filter, otherwise it will be undefined.
 */
export function getIsFilterActive(
	playlist: RundownPlaylist,
	showStyleBase: UIShowStyleBase,
	panel: RequiresActiveLayers
): { active: boolean; activePieceInstance: PieceInstance | undefined } {
	const unfinishedPieces = getUnfinishedPieceInstancesReactive(playlist, showStyleBase)
	let activePieceInstance: PieceInstance | undefined
	const activeLayers = unfinishedPieces.map((p) => p.piece.sourceLayerId)
	const containsEveryRequiredLayer = panel.requireAllAdditionalSourcelayers
		? panel.additionalLayers?.length && panel.additionalLayers.every((s) => activeLayers.includes(s))
		: false
	const containsRequiredLayer = containsEveryRequiredLayer
		? true
		: panel.additionalLayers && panel.additionalLayers.length
		? panel.additionalLayers.some((s) => activeLayers.includes(s))
		: false

	if (
		(!panel.requireAllAdditionalSourcelayers || containsEveryRequiredLayer) &&
		(!panel.additionalLayers?.length || containsRequiredLayer)
	) {
		activePieceInstance =
			panel.requiredLayerIds && panel.requiredLayerIds.length
				? _.flatten(Object.values(unfinishedPieces)).find((piece: PieceInstance) => {
						return (
							(panel.requiredLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
							piece.partInstanceId === playlist.currentPartInstanceId
						)
				  })
				: undefined
	}
	return {
		active:
			activePieceInstance !== undefined || (!panel.requiredLayerIds?.length && !panel.additionalLayers?.length),
		activePieceInstance,
	}
}

export function getUnfinishedPieceInstancesReactive(playlist: RundownPlaylist, showStyleBase: UIShowStyleBase) {
	if (playlist.activationId && playlist.currentPartInstanceId) {
		return memoizedIsolatedAutorun(
			(
				playlistActivationId: RundownPlaylistActivationId,
				currentPartInstanceId: PartInstanceId,
				showStyleBase: UIShowStyleBase
			) => {
				const now = getCurrentTime()
				let prospectivePieces: PieceInstance[] = []

				const partInstance = PartInstances.findOne(currentPartInstanceId)

				if (partInstance) {
					prospectivePieces = PieceInstances.find({
						partInstanceId: currentPartInstanceId,
						playlistActivationId: playlistActivationId,
					}).fetch()

					const nowInPart = partInstance.timings?.plannedStartedPlayback
						? now - partInstance.timings.plannedStartedPlayback
						: 0
					prospectivePieces = processAndPrunePieceInstanceTimings(
						showStyleBase.sourceLayers,
						prospectivePieces,
						nowInPart
					)

					let nearestEnd = Number.POSITIVE_INFINITY
					prospectivePieces = prospectivePieces.filter((pieceInstance) => {
						const piece = pieceInstance.piece

						if (!pieceInstance.adLibSourceId && !piece.tags) {
							// No effect on the data, so ignore
							return false
						}

						let end: number | undefined
						if (pieceInstance.plannedStoppedPlayback) {
							end = pieceInstance.plannedStoppedPlayback
						} else if (
							pieceInstance.userDuration &&
							'endRelativeToPart' in pieceInstance.userDuration &&
							typeof pieceInstance.userDuration.endRelativeToPart === 'number'
						) {
							end = pieceInstance.userDuration.endRelativeToPart
						} else if (
							pieceInstance.userDuration &&
							'endRelativeToNow' in pieceInstance.userDuration &&
							typeof pieceInstance.userDuration.endRelativeToNow === 'number'
						) {
							end = pieceInstance.userDuration.endRelativeToNow + now
						} else if (typeof piece.enable.duration === 'number' && pieceInstance.plannedStartedPlayback) {
							end = piece.enable.duration + pieceInstance.plannedStartedPlayback
						}

						if (end !== undefined) {
							if (end > now) {
								nearestEnd = Math.min(nearestEnd, end)
								return true
							} else {
								return false
							}
						}
						return true
					})

					if (Number.isFinite(nearestEnd)) invalidateAt(nearestEnd)
				}

				return prospectivePieces
			},
			'getUnfinishedPieceInstancesReactive',
			playlist.activationId,
			playlist.currentPartInstanceId,
			showStyleBase
		)
	}

	return []
}
