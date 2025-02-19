import classNames from 'classnames'
import React, { CSSProperties, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { PieceExtended } from '../../../lib/RundownResolver'
import { RundownUtils } from '../../../lib/rundown'
import { PieceHoverInspector } from '../PieceHoverInspector'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment'
import StudioContext from '../../RundownView/StudioContext'
import { useContentStatusForPieceInstance } from '../../SegmentTimeline/withMediaObjectStatus'
import {
	PreviewPopUpContext,
	IPreviewPopUpSession,
	convertPreviewToContents,
	convertSourceLayerItemToPreview,
} from '../../PreviewPopUp/PreviewPopUpContext'

interface IProps {
	piece: PieceExtended
	timelineBase: number
	partDuration: number
	onClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}

function timeInBase(time: number, partDuration: number, timelineBase: number): number {
	const pieceMaxDuration = Math.min(time, partDuration)
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return size * 100
}

export const LinePartSecondaryPiece: React.FC<IProps> = React.memo(function LinePartSecondaryPiece({
	piece,
	partDuration,
	timelineBase,
	onClick: incomingOnClick,
	onDoubleClick: incomingOnDoubleClick,
}) {
	const contentStatus = useContentStatusForPieceInstance(piece.instance)

	const pieceEl = useRef<HTMLDivElement>(null)
	const [hovering, setHover] = useState(false)
	const [origin, setOrigin] = useState<OffsetPosition>({ left: 0, top: 0 })
	const [mousePosition, setMousePosition] = useState(0)
	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const pieceStyle = useMemo<CSSProperties>(() => {
		const width = timeInBase(piece.renderedDuration ?? Math.max(timelineBase, partDuration), timelineBase, timelineBase)
		const left = timeInBase(piece.renderedInPoint ?? 0, timelineBase, timelineBase)
		const overflow = Math.max(0, left + width - 100)
		return {
			width: `${width - overflow}%`,
			left: `${left}%`,
		}
	}, [piece, partDuration, timelineBase])

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)
	const previewContents = piece.instance.piece.content.popUpPreview
		? convertPreviewToContents(piece.instance.piece.content.popUpPreview, contentStatus)
		: piece.sourceLayer
		? convertSourceLayerItemToPreview(piece.sourceLayer?.type, piece, contentStatus)
		: []

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		// setHover(true)

		if (previewContents.length > 0)
			previewSession.current = previewContext.requestPreview(e.target as any, previewContents, {
				startCoordinate: e.screenX,
			})

		const newOffset = pieceEl.current && getElementDocumentOffset(pieceEl.current)
		if (newOffset !== null) {
			setOrigin(newOffset)
		}
	}

	const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setHover(false)
		if (previewSession.current) {
			previewSession.current.close()
			previewSession.current = null
		}
	}

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setMousePosition(e.pageX - origin.left)
	}

	const onClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			incomingOnClick && incomingOnClick(piece, e)
		},
		[piece, incomingOnClick]
	)

	const onDoubleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			incomingOnDoubleClick && incomingOnDoubleClick(piece, e)
		},
		[piece, incomingOnDoubleClick]
	)

	return (
		<div
			ref={pieceEl}
			className={classNames('segment-opl__secondary-piece', typeClass)}
			style={pieceStyle}
			data-duraton={piece.renderedDuration}
			data-obj-id={piece.instance._id}
			data-piece-id={piece.instance.isTemporary ? piece.instance.piece._id : piece.instance._id}
			data-label={piece.instance.piece.name}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
		>
			<StudioContext.Consumer>
				{(studio) =>
					studio && (
						<PieceHoverInspector
							hovering={hovering}
							hoverScrubTimePosition={0}
							layer={piece.sourceLayer}
							mousePosition={mousePosition}
							originPosition={origin}
							pieceInstance={piece}
							contentStatus={contentStatus}
							studio={studio}
						/>
					)
				}
			</StudioContext.Consumer>
		</div>
	)
})
