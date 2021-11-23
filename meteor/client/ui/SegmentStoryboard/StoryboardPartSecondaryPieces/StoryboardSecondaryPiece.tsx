import classNames from 'classnames'
import React, { useRef, useState } from 'react'
import { Studio } from '../../../../lib/collections/Studios'
import { RundownUtils } from '../../../lib/rundown'
import { ISourceLayer, PieceLifespan, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment'
import { RundownAPI } from '../../../../lib/api/rundown'
import { PartId } from '../../../../lib/collections/Parts'
import { DefaultRenderer } from './Renderers/DefaultRenderer'
import { assertNever } from '../../../../lib/lib'
import { ScriptRenderer } from './Renderers/ScriptRenderer'
import { getElementDocumentOffset } from '../../../utils/positions'
import { getElementWidth } from '../../../utils/dimensions'

interface IProps {
	layer: ISourceLayer
	piece: PieceUi
	partId: PartId
	isLiveLine: boolean
	studio: Studio | undefined
}

function renderPieceInside(
	props: IProps,
	elementOffset: { top: number; left: number; width: number } | undefined,
	isHovering: boolean,
	typeClass: string
) {
	const type = props.piece?.sourceLayer?.type
	switch (type) {
		case SourceLayerType.SCRIPT:
			return ScriptRenderer({ ...props, elementOffset, isHovering, typeClass })
		case SourceLayerType.AUDIO:
		case SourceLayerType.CAMERA:
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.LOWER_THIRD:
		case SourceLayerType.LIVE_SPEAK:
		case SourceLayerType.VT:
		case SourceLayerType.LOCAL:
		case SourceLayerType.REMOTE:
		case SourceLayerType.SPLITS:
		case SourceLayerType.TRANSITION:
		case SourceLayerType.UNKNOWN:
		case undefined:
			return DefaultRenderer({ ...props, elementOffset, isHovering, typeClass })
		default:
			assertNever(type)
			return null
	}
}

export const StoryboardSecondaryPiece = withMediaObjectStatus<IProps, {}>()(function StoryboardSecondaryPiece(
	props: IProps
) {
	const { piece, partId } = props
	const [highlight] = useState(false)
	const element = useRef<HTMLDivElement>(null)
	const [isHovering, setHovering] = useState(false)
	const [elementOffset, setElementOffset] = useState<{ top: number; left: number; width: number } | undefined>(
		undefined
	)

	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const innerPiece = piece.instance.piece

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') return

		setHovering(true)
		if (!element.current) return

		const offset = getElementDocumentOffset(element.current)
		if (!offset) return

		const width = getElementWidth(element.current)
		setElementOffset({
			top: offset.top,
			left: offset.left,
			width,
		})
	}

	const onPointerLeave = () => {
		setHovering(false)
	}

	return (
		<div
			className={classNames('segment-storyboard__part__piece', typeClass, {
				'super-infinite':
					innerPiece.lifespan !== PieceLifespan.WithinPart &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd,
				'infinite-starts':
					innerPiece.lifespan !== PieceLifespan.WithinPart &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd &&
					piece.instance.piece.startPartId === partId,

				'not-in-vision': piece.instance.piece.notInVision,

				'source-missing':
					innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING ||
					innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_NOT_SET,
				'source-broken': innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
				'unknown-state': innerPiece.status === RundownAPI.PieceStatusCode.UNKNOWN,
				disabled: piece.instance.disabled,

				'invert-flash': highlight,
			})}
			data-obj-id={piece.instance._id}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			ref={element}
		>
			{renderPieceInside(props, elementOffset, isHovering, typeClass)}
		</div>
	)
})
