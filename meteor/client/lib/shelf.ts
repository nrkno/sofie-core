import { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import _ from 'underscore'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { PartInstance } from '../../lib/collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { getUnfinishedPieceInstancesReactive } from './rundownLayouts'
import { UIShowStyleBase } from '../../lib/api/showStyles'
import { PieceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstances } from '../collections'
import { ReadonlyDeep } from 'type-fest'

export interface ShelfDisplayOptions {
	enableBuckets: boolean
	enableLayout: boolean
	enableInspector: boolean
}

export interface AdLibPieceUi extends Omit<AdLibPiece, 'timelineObjectsString'> {
	hotkey?: string
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	isGlobal?: boolean
	isHidden?: boolean
	isSticky?: boolean
	isAction?: boolean
	isClearSourceLayer?: boolean
	disabled?: boolean
	adlibAction?: AdLibAction | RundownBaselineAdLibAction
	segmentId?: SegmentId
}

export interface AdlibSegmentUi extends DBSegment {
	/** Pieces belonging to this part */
	parts: Array<PartInstance>
	pieces: Array<AdLibPieceUi>
	isLive: boolean
	isNext: boolean
	isCompatibleShowStyle: boolean
}

export function getNextPiecesReactive(
	playlist: DBRundownPlaylist,
	showsStyleBase: UIShowStyleBase
): ReadonlyDeep<PieceInstance>[] {
	let prospectivePieceInstances: ReadonlyDeep<PieceInstance>[] = []
	if (playlist.activationId && playlist.nextPartInfo) {
		prospectivePieceInstances = PieceInstances.find({
			playlistActivationId: playlist.activationId,
			partInstanceId: playlist.nextPartInfo.partInstanceId,
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
	}

	prospectivePieceInstances = processAndPrunePieceInstanceTimings(
		showsStyleBase.sourceLayers,
		prospectivePieceInstances,
		0
	)

	return prospectivePieceInstances
}

export function getUnfinishedPieceInstancesGrouped(
	playlist: DBRundownPlaylist,
	showStyleBase: UIShowStyleBase
): {
	unfinishedPieceInstances: ReadonlyDeep<PieceInstance>[]
	unfinishedAdLibIds: PieceId[]
	unfinishedTags: readonly string[]
} {
	const unfinishedPieceInstances = getUnfinishedPieceInstancesReactive(playlist, showStyleBase)

	const unfinishedAdLibIds: PieceId[] = unfinishedPieceInstances
		.filter((piece) => !!piece.adLibSourceId)
		.map((piece) => piece.adLibSourceId!)
	const unfinishedTags: string[] = _.uniq(
		unfinishedPieceInstances
			.filter((piece) => !!piece.piece.tags)
			.map((piece) => piece.piece.tags!)
			.reduce((a, b) => a.concat(b), [])
	)

	return {
		unfinishedPieceInstances,
		unfinishedAdLibIds,
		unfinishedTags,
	}
}

export function getNextPieceInstancesGrouped(
	playlist: DBRundownPlaylist,
	showsStyleBase: UIShowStyleBase
): { nextAdLibIds: PieceId[]; nextTags: readonly string[]; nextPieceInstances: ReadonlyDeep<PieceInstance>[] } {
	const nextPieceInstances = getNextPiecesReactive(playlist, showsStyleBase)

	const nextAdLibIds: PieceId[] = nextPieceInstances
		.filter((piece) => !!piece.adLibSourceId)
		.map((piece) => piece.adLibSourceId!)
	const nextTags = nextPieceInstances
		.filter((piece) => !!piece.piece.tags)
		.map((piece) => piece.piece.tags!)
		.reduce((a, b) => a.concat(b), [])

	return { nextAdLibIds, nextTags, nextPieceInstances }
}

export function isAdLibOnAir(
	unfinishedAdLibIds: PieceId[],
	unfinishedTags: readonly string[],
	adLib: AdLibPieceUi
): boolean {
	if (
		unfinishedAdLibIds.includes(adLib._id) ||
		(adLib.currentPieceTags &&
			adLib.currentPieceTags.length > 0 &&
			adLib.currentPieceTags.every((tag) => unfinishedTags.includes(tag)))
	) {
		return true
	}
	return false
}

export function isAdLibNext(nextAdLibIds: PieceId[], nextTags: readonly string[], adLib: AdLibPieceUi): boolean {
	if (
		nextAdLibIds.includes(adLib._id) ||
		(adLib.nextPieceTags &&
			adLib.nextPieceTags.length > 0 &&
			adLib.nextPieceTags.every((tag) => nextTags.includes(tag)))
	) {
		return true
	}
	return false
}

export function isAdLibDisplayedAsOnAir(
	unfinishedAdLibIds: PieceId[],
	unfinishedTags: readonly string[],
	adLib: AdLibPieceUi
): boolean {
	const isOnAir = isAdLibOnAir(unfinishedAdLibIds, unfinishedTags, adLib)
	return adLib.invertOnAirState ? !isOnAir : isOnAir
}
