import { PieceLifespan, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import classNames from 'classnames'
import { PieceUi } from '../../ui/SegmentContainer/withResolvedSegment'
import { RundownUtils } from '../rundown'

export function pieceUiClassNames(
	pieceInstance: PieceUi,
	baseClassName: string,
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
			pieceInstance.contentStatus?.status === PieceStatusCode.SOURCE_MISSING ||
			pieceInstance.contentStatus?.status === PieceStatusCode.SOURCE_NOT_SET,
		'source-unknown-state': pieceInstance.contentStatus?.status === PieceStatusCode.SOURCE_UNKNOWN_STATE,
		'source-broken': pieceInstance.contentStatus?.status === PieceStatusCode.SOURCE_BROKEN,
		'source-not-ready': pieceInstance.contentStatus?.status === PieceStatusCode.SOURCE_NOT_READY,
		'unknown-state': pieceInstance.contentStatus?.status === PieceStatusCode.UNKNOWN,
		disabled: pieceInstance.instance.disabled,

		'invert-flash': highlight,
	})
}
