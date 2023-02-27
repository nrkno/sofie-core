import React, { useRef, useState } from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PieceExtended } from '../../../../lib/Rundown'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { getElementWidth } from '../../../utils/dimensions'
import renderThumbnail from './Renderers/ThumbnailRendererFactory'
import { PieceElement } from '../utils/PieceElement'
import { UIStudio } from '../../../../lib/api/studios'
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IProps {
	partId: PartId
	partInstanceId: PartInstanceId
	partAutoNext: boolean
	layer: ISourceLayer | undefined
	piece: PieceExtended
	studio: UIStudio | undefined
	isLive: boolean
	isNext: boolean
	isFinished: boolean
	highlight?: boolean
}

export const StoryboardPartThumbnailInner = withMediaObjectStatus<IProps, {}>()(
	({ piece, layer, partId, partInstanceId, studio, highlight, partAutoNext, isLive, isNext, isFinished }: IProps) => {
		const [hover, setHover] = useState(false)
		const [origin, setOrigin] = useState<OffsetPosition>({ left: 0, top: 0 })
		const [width, setWidth] = useState(0)
		const [mousePosition, setMousePosition] = useState(0)
		const thumbnailEl = useRef<HTMLDivElement>(null)

		const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType !== 'mouse') {
				return
			}
			setHover(true)

			const newOffset = thumbnailEl.current && getElementDocumentOffset(thumbnailEl.current)
			if (newOffset !== null) {
				setOrigin(newOffset)
			}
			const newWidth = thumbnailEl.current && getElementWidth(thumbnailEl.current)
			if (newWidth !== null) {
				setWidth(newWidth)
			}
		}

		const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType !== 'mouse') {
				return
			}
			setHover(false)
		}

		const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType !== 'mouse') {
				return
			}
			const newMousePosition = Math.max(0, Math.min(1, (e.pageX - origin.left - 5) / (width - 10)))
			setMousePosition(newMousePosition)
		}

		return (
			<PieceElement
				className="segment-storyboard__part__thumbnail"
				layer={layer}
				partId={partId}
				piece={piece}
				highlight={highlight}
				onPointerEnter={onPointerEnter}
				onPointerLeave={onPointerLeave}
				onPointerMove={onPointerMove}
				ref={thumbnailEl}
			>
				{studio &&
					renderThumbnail({
						partId,
						partInstanceId,
						partAutoNext,
						hoverScrubTimePosition: mousePosition * (piece.instance.piece.content.sourceDuration || 0),
						hovering: hover,
						layer: layer,
						originPosition: origin,
						pieceInstance: piece,
						studio,
						isLive,
						isNext,
						isFinished,
					})}
			</PieceElement>
		)
	}
)
