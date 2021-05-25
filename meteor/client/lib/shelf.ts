import { ISourceLayer, IOutputLayer } from '@sofie-automation/blueprints-integration'
import { AdLibAction } from '../../lib/collections/AdLibActions'
import { AdLibPiece } from '../../lib/collections/AdLibPieces'
import { PartInstanceId } from '../../lib/collections/PartInstances'
import { PieceInstance, PieceInstances } from '../../lib/collections/PieceInstances'
import { PieceId } from '../../lib/collections/Pieces'
import { RundownBaselineAdLibAction } from '../../lib/collections/RundownBaselineAdLibActions'
import { SegmentId } from '../../lib/collections/Segments'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { getCurrentTime } from '../../lib/lib'
import { processAndPrunePieceInstanceTimings } from '../../lib/rundown/infinites'
import { invalidateAt } from './invalidatingTime'

export interface AdLibPieceUi extends AdLibPiece {
	hotkey?: string
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	isGlobal?: boolean
	isHidden?: boolean
	isSticky?: boolean
	isAction?: boolean
	isClearSourceLayer?: boolean
	adlibAction?: AdLibAction | RundownBaselineAdLibAction
	contentMetaData?: any
	message?: string | null
	uniquenessId?: string
	segmentId?: SegmentId
}

export function isAdLibOnAir(unfinishedAdLibIds: PieceId[], unfinishedTags: string[], adLib: AdLibPieceUi) {
	if (
		unfinishedAdLibIds.includes(adLib._id) ||
		(adLib.currentPieceTags && adLib.currentPieceTags.every((tag) => unfinishedTags.includes(tag)))
	) {
		return true
	}
	return false
}

export function isAdLibNext(
	nextAdLibIds: PieceId[],
	unfinishedTags: string[],
	nextTags: string[],
	adLib: AdLibPieceUi
) {
	if (
		nextAdLibIds.includes(adLib._id) ||
		(adLib.nextPieceTags && adLib.nextPieceTags.every((tag) => unfinishedTags.includes(tag))) ||
		(adLib.nextPieceTags && adLib.nextPieceTags.every((tag) => nextTags.includes(tag)))
	) {
		return true
	}
	return false
}

export function getNextPiecesReactive(
	showStyleBase: ShowStyleBase,
	nextPartInstanceId: PartInstanceId | null
): PieceInstance[] {
	let prospectivePieceInstances: PieceInstance[] = []
	if (nextPartInstanceId) {
		prospectivePieceInstances = PieceInstances.find({
			partInstanceId: nextPartInstanceId,
			$and: [
				{
					piece: {
						$exists: true,
					},
				},
				{
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
				},
			],
		}).fetch()

		prospectivePieceInstances = processAndPrunePieceInstanceTimings(showStyleBase, prospectivePieceInstances, 0)
	}

	return prospectivePieceInstances
}

export function getNextPieceInstancesGrouped(
	showStyleBase: ShowStyleBase,
	nextPartInstanceId: PartInstanceId | null
): { nextAdLibIds: PieceId[]; nextTags: string[]; nextPieceInstances: PieceInstance[] } {
	const nextPieceInstances = getNextPiecesReactive(showStyleBase, nextPartInstanceId)

	const nextAdLibIds: PieceId[] = nextPieceInstances
		.filter((piece) => !!piece.adLibSourceId)
		.map((piece) => piece.adLibSourceId!)
	const nextTags: string[] = nextPieceInstances
		.filter((piece) => !!piece.piece.tags)
		.map((piece) => piece.piece.tags!)
		.reduce((a, b) => a.concat(b), [])

	return { nextAdLibIds, nextTags, nextPieceInstances }
}

export function getUnfinishedPieceInstancesGrouped(
	currentPartInstanceId: PartInstanceId | null
): {
	unfinishedAdLibIds: PieceId[]
	unfinishedTags: string[]
	unfinishedPieceInstances: PieceInstance[]
} {
	const unfinishedPieceInstances = getUnfinishedPieceInstancesReactive(currentPartInstanceId)

	const unfinishedAdLibIds: PieceId[] = unfinishedPieceInstances
		.filter((piece) => !!piece.adLibSourceId)
		.map((piece) => piece.adLibSourceId!)
	const unfinishedTags: string[] = unfinishedPieceInstances
		.filter((piece) => !!piece.piece.tags)
		.map((piece) => piece.piece.tags!)
		.reduce((a, b) => a.concat(b), [])

	return {
		unfinishedAdLibIds,
		unfinishedTags,
		unfinishedPieceInstances,
	}
}

export function getUnfinishedPieceInstancesReactive(
	currentPartInstanceId: PartInstanceId | null,
	adlib: boolean = true
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
				{
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
				},
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
			let end: number | undefined =
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
