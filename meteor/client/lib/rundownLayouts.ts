import _ from 'underscore'
import { PartInstanceId } from '../../lib/collections/PartInstances'
import { PieceInstance, PieceInstances } from '../../lib/collections/PieceInstances'
import { RequiresActiveLayers } from '../../lib/collections/RundownLayouts'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { getCurrentTime } from '../../lib/lib'
import { invalidateAt } from './invalidatingTime'

/**
 * If the conditions of the filter are met, activePieceInstance will include the first piece instance found that matches the filter, otherwise it will be undefined.
 */
export function getIsFilterActive(
	playlist: RundownPlaylist,
	panel: RequiresActiveLayers
): { active: boolean; activePieceInstance: PieceInstance | undefined } {
	const unfinishedPieces = getUnfinishedPieceInstancesReactive(playlist.currentPartInstanceId, true)
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

export function getUnfinishedPieceInstancesReactive(
	currentPartInstanceId: PartInstanceId | null,
	includeNonAdLibPieces?: boolean
) {
	let prospectivePieces: PieceInstance[] = []
	const now = getCurrentTime()
	if (currentPartInstanceId) {
		prospectivePieces = PieceInstances.find({
			startedPlayback: {
				$exists: true,
			},
			$and: [
				{
					$or: [
						{
							stoppedPlayback: {
								$eq: 0,
							},
						},
						{
							stoppedPlayback: {
								$exists: false,
							},
						},
					],
				},
				!includeNonAdLibPieces
					? {
							$or: [
								{
									adLibSourceId: {
										$exists: true,
									},
								},
								{
									'piece.tags': {
										$exists: true,
									},
								},
							],
					  }
					: {},
				{
					$or: [
						{
							userDuration: {
								$exists: false,
							},
						},
						{
							'userDuration.end': {
								$exists: false,
							},
						},
					],
				},
			],
		}).fetch()

		let nearestEnd = Number.POSITIVE_INFINITY
		prospectivePieces = prospectivePieces.filter((pieceInstance) => {
			const piece = pieceInstance.piece
			const end: number | undefined =
				pieceInstance.userDuration && typeof pieceInstance.userDuration.end === 'number'
					? pieceInstance.userDuration.end
					: typeof piece.enable.duration === 'number'
					? piece.enable.duration + pieceInstance.startedPlayback!
					: undefined

			if (end !== undefined) {
				if (end > now) {
					nearestEnd = nearestEnd > end ? end : nearestEnd
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
}
