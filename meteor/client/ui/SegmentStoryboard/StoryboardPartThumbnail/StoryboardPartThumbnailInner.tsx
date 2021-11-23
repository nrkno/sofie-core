import React, { useRef, useState } from 'react'
import classNames from 'classnames'
import { ISourceLayer, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { Studio } from '../../../../lib/collections/Studios'
import { PieceExtended } from '../../../../lib/Rundown'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'
import { RundownUtils } from '../../../lib/rundown'
import { PartId } from '../../../../lib/collections/Parts'
import { RundownAPI } from '../../../../lib/api/rundown'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { getElementWidth } from '../../../utils/dimensions'
import renderThumbnail from './Renderers/ThumbnailRendererFactory'

interface IProps {
	partId: PartId
	layer: ISourceLayer | undefined
	piece: PieceExtended
	studio: Studio | undefined
	isLiveLine?: boolean
	highlight?: boolean
}

export const StoryboardPartThumbnailInner = withMediaObjectStatus<IProps, {}>()(
	({ piece, layer, partId, studio, highlight }: IProps) => {
		const [hover, setHover] = useState(false)
		const [origin, setOrigin] = useState<OffsetPosition>({ left: 0, top: 0 })
		const [width, setWidth] = useState(0)
		const [mousePosition, setMousePosition] = useState(0)
		const thumbnailEl = useRef<HTMLDivElement>(null)
		const typeClass = layer?.type ? RundownUtils.getSourceLayerClassName(layer?.type) : ''

		const innerPiece = piece.instance.piece

		const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType !== 'mouse') {
				return
			}
			setHover(true)

			const offset = thumbnailEl.current && getElementDocumentOffset(thumbnailEl.current)
			if (offset !== null) {
				setOrigin(offset)
			}
			const width = thumbnailEl.current && getElementWidth(thumbnailEl.current)
			if (width !== null) {
				setWidth(width)
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
			<div
				className={classNames('segment-storyboard__part__thumbnail', typeClass, {
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
				onPointerMove={onPointerMove}
				ref={thumbnailEl}
			>
				{studio &&
					renderThumbnail({
						hoverScrubTimePosition: mousePosition * (piece.instance.piece.content.sourceDuration || 0),
						hovering: hover,
						layer: layer,
						originPosition: origin,
						pieceInstance: piece,
						studio,
					})}
			</div>
		)
	}
)
