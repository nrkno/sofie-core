import { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import _ from 'underscore'
import { AdLibAction } from '../../lib/collections/AdLibActions'
import { AdLibPiece } from '../../lib/collections/AdLibPieces'
import { PartInstance } from '../../lib/collections/PartInstances'
import { PieceInstance } from '../../lib/collections/PieceInstances'
import { RundownBaselineAdLibAction } from '../../lib/collections/RundownBaselineAdLibActions'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { DBSegment } from '../../lib/collections/Segments'
import { ScanInfoForPackages } from '../../lib/mediaObjects'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/infinites'
import { getUnfinishedPieceInstancesReactive } from './rundownLayouts'
import { UIShowStyleBase } from '../../lib/api/showStyles'
import { PieceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { PieceInstances } from '../collections'

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
	contentMetaData?: any
	contentPackageInfos?: ScanInfoForPackages
	messages?: ITranslatableMessage[]
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

export function getNextPiecesReactive(playlist: RundownPlaylist, showsStyleBase: UIShowStyleBase): PieceInstance[] {
	let prospectivePieceInstances: PieceInstance[] = []
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
	playlist: RundownPlaylist,
	showStyleBase: UIShowStyleBase
): { unfinishedPieceInstances: PieceInstance[]; unfinishedAdLibIds: PieceId[]; unfinishedTags: string[] } {
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
	playlist: RundownPlaylist,
	showsStyleBase: UIShowStyleBase
): { nextAdLibIds: PieceId[]; nextTags: string[]; nextPieceInstances: PieceInstance[] } {
	const nextPieceInstances = getNextPiecesReactive(playlist, showsStyleBase)

	const nextAdLibIds: PieceId[] = nextPieceInstances
		.filter((piece) => !!piece.adLibSourceId)
		.map((piece) => piece.adLibSourceId!)
	const nextTags: string[] = nextPieceInstances
		.filter((piece) => !!piece.piece.tags)
		.map((piece) => piece.piece.tags!)
		.reduce((a, b) => a.concat(b), [])

	return { nextAdLibIds, nextTags, nextPieceInstances }
}

export function isAdLibOnAir(unfinishedAdLibIds: PieceId[], unfinishedTags: string[], adLib: AdLibPieceUi): boolean {
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

export function isAdLibNext(nextAdLibIds: PieceId[], nextTags: string[], adLib: AdLibPieceUi): boolean {
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
	unfinishedTags: string[],
	adLib: AdLibPieceUi
): boolean {
	const isOnAir = isAdLibOnAir(unfinishedAdLibIds, unfinishedTags, adLib)
	return adLib.invertOnAirState ? !isOnAir : isOnAir
}
