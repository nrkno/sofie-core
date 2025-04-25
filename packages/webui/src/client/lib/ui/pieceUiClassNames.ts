import { PieceLifespan, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import classNames from 'classnames'
import { PieceUi } from '../../ui/SegmentContainer/withResolvedSegment'
import { RundownUtils } from '../rundown'
import { ReadonlyDeep } from 'type-fest'
import { PieceContentStatusObj } from '@sofie-automation/meteor-lib/dist/api/pieceContentStatus'

export function pieceUiClassNames(
	pieceInstance: PieceUi,
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined,
	baseClassName: string,
	selected: boolean,
	layerType?: SourceLayerType,
	partId?: PartId,
	highlight?: boolean,
	elementWidth?: number,
	uiState?: {
		leftAnchoredWidth: number
		rightAnchoredWidth: number
	}
): string {
	const typeClass = layerType ? RundownUtils.getSourceLayerClassName(layerType) : ''

	const innerPiece = pieceInstance.instance.piece

	return classNames(baseClassName, typeClass, {
		'hide-overflow-labels':
			uiState && elementWidth
				? uiState.leftAnchoredWidth > 0 && uiState.leftAnchoredWidth + uiState.rightAnchoredWidth > elementWidth
				: undefined,

		'super-infinite':
			innerPiece.lifespan !== PieceLifespan.WithinPart &&
			innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
			innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd,
		'infinite-starts':
			innerPiece.lifespan !== PieceLifespan.WithinPart &&
			innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
			innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd &&
			innerPiece.startPartId === partId,

		'not-in-vision': innerPiece.notInVision,

		'next-is-touching': pieceInstance.cropped,

		'source-missing':
			contentStatus?.status === PieceStatusCode.SOURCE_MISSING ||
			contentStatus?.status === PieceStatusCode.SOURCE_NOT_SET,
		'source-unknown-state': contentStatus?.status === PieceStatusCode.SOURCE_UNKNOWN_STATE,
		'source-broken': contentStatus?.status === PieceStatusCode.SOURCE_BROKEN,
		'source-not-ready': contentStatus?.status === PieceStatusCode.SOURCE_NOT_READY,
		'unknown-state': contentStatus?.status === PieceStatusCode.UNKNOWN,
		disabled: pieceInstance.instance.disabled,

		'invert-flash': highlight,

		'element-selected': selected,
	})
}
