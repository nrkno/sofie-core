import React, { useRef, useState } from 'react'
import { Studio } from '../../../../lib/collections/Studios'
import { RundownUtils } from '../../../lib/rundown'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment'
import { PartId } from '../../../../lib/collections/Parts'
import { DefaultRenderer } from './Renderers/DefaultRenderer'
import { assertNever } from '../../../../lib/lib'
import { ScriptRenderer } from './Renderers/ScriptRenderer'
import { getElementDocumentOffset } from '../../../utils/positions'
import { getElementWidth } from '../../../utils/dimensions'
import { GraphicsRenderer } from './Renderers/GraphicsRenderer'
import { SplitsRenderer } from './Renderers/SplitsRenderer'
import { PieceElement } from '../utils/PieceElement'

interface IProps {
	layer: ISourceLayer
	piece: PieceUi
	partId: PartId
	isLiveLine: boolean
	studio: Studio | undefined
	className?: string
	style?: React.CSSProperties
}

function renderPieceInside(
	props: IProps,
	elementOffset: { top: number; left: number; width: number } | undefined,
	hovering: MousePagePosition | null,
	typeClass: string
) {
	const type = props.piece?.sourceLayer?.type
	switch (type) {
		case SourceLayerType.SCRIPT:
			return ScriptRenderer({ ...props, elementOffset, hovering, typeClass })
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.LOWER_THIRD:
			return GraphicsRenderer({ ...props, elementOffset, hovering, typeClass })
		case SourceLayerType.SPLITS:
			return SplitsRenderer({ ...props, elementOffset, hovering, typeClass })
		case SourceLayerType.AUDIO:
		case SourceLayerType.CAMERA:
		case SourceLayerType.LIVE_SPEAK:
		case SourceLayerType.VT:
		case SourceLayerType.LOCAL:
		case SourceLayerType.REMOTE:
		case SourceLayerType.TRANSITION:
		case SourceLayerType.UNKNOWN:
		case undefined:
			return DefaultRenderer({ ...props, elementOffset, hovering, typeClass })
		default:
			assertNever(type)
			return DefaultRenderer({ ...props, elementOffset, hovering, typeClass })
	}
}

type MousePagePosition = { pageX: number; pageY: number }

export const StoryboardSecondaryPiece = withMediaObjectStatus<IProps, {}>()(function StoryboardSecondaryPiece(
	props: IProps
) {
	const { piece, partId, style, className } = props
	const [highlight] = useState(false)
	const element = useRef<HTMLDivElement>(null)
	const [hovering, setHovering] = useState<MousePagePosition | null>(null)
	const [elementOffset, setElementOffset] = useState<{ top: number; left: number; width: number } | undefined>(
		undefined
	)

	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') return

		setHovering({ pageX: e.pageX, pageY: e.pageY })
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
		setHovering(null)
	}

	return (
		<PieceElement
			className={['segment-storyboard__part__piece', className].join(' ')}
			layer={piece?.sourceLayer}
			partId={partId}
			piece={piece}
			highlight={highlight}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			ref={element}
			style={style}
		>
			{renderPieceInside(props, elementOffset, hovering, typeClass)}
		</PieceElement>
	)
})
