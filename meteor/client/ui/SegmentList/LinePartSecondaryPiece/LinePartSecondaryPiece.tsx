import classNames from 'classnames'
import React, { CSSProperties, useMemo, useRef, useState } from 'react'
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'
import { PieceHoverInspector } from '../PieceHoverInspector'
import { StudioContext } from '../SegmentOnePartLine'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'

interface IProps {
	piece: PieceExtended
	partId: PartId
	partInstanceId: PartInstanceId
	timelineBase: number
	partDuration: number
}

function timeInBase(time: number, partDuration: number, timelineBase: number): string {
	const pieceMaxDuration = Math.min(time, partDuration)
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return `${size * 100}%`
}

export const LinePartSecondaryPiece: React.FC<IProps> = function LinePartSecondaryPiece({
	piece,
	partId,
	partInstanceId,
	partDuration,
	timelineBase,
}) {
	const pieceEl = useRef<HTMLDivElement>(null)
	const [hovering, setHover] = useState(false)
	const [origin, setOrigin] = useState<OffsetPosition>({ left: 0, top: 0 })
	const [mousePosition, setMousePosition] = useState(0)
	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const pieceStyle = useMemo<CSSProperties>(() => {
		return {
			width: timeInBase(piece.renderedDuration ?? partDuration, partDuration, timelineBase),
			left: timeInBase(piece.renderedInPoint ?? 0, partDuration, timelineBase),
		}
	}, [piece, partDuration, timelineBase])

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setHover(true)

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
	}

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setMousePosition(e.pageX - origin.left)
	}

	return (
		<div
			ref={pieceEl}
			className={classNames('segment-opl__secondary-piece', typeClass)}
			style={pieceStyle}
			data-duraton={piece.renderedDuration}
			data-obj-id={piece.instance._id}
			data-label={piece.instance.piece.name}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
		>
			<StudioContext.Consumer>
				{(studio) =>
					studio && (
						<PieceHoverInspector
							hovering={hovering}
							partId={partId}
							partInstanceId={partInstanceId}
							hoverScrubTimePosition={0}
							isFinished={false}
							isLive={false}
							isNext={false}
							layer={piece.sourceLayer}
							mousePosition={mousePosition}
							originPosition={origin}
							partAutoNext={false}
							pieceInstance={piece}
							studio={studio}
						/>
					)
				}
			</StudioContext.Consumer>
		</div>
	)
}
