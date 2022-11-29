import _ from 'underscore'
import { EvsContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import React, { useMemo, useState, useRef } from 'react'
import { PieceExtended } from '../../../../lib/Rundown'
import { MediaObject } from '../../../../lib/collections/MediaObjects'
import { PackageInfo, VTContent } from '@sofie-automation/blueprints-integration'
// TODO: Move to a shared lib file
import { getSplitItems } from '../../SegmentStoryboard/utils/getSplitItems'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment'
import { PieceElement } from '../../SegmentStoryboard/utils/PieceElement'
import { getElementWidth } from '../../../utils/dimensions'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { PieceHoverInspector } from '../PieceHoverInspector'
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications'
import { PieceStatusIcon } from '../../../lib/ui/PieceStatusIcon'
import { UIStudio } from '../../../../lib/api/studios'

interface IProps {
	partId: PartId
	partInstanceId: PartInstanceId
	piece: PieceExtended
	studio: UIStudio | undefined
	timelineBase: number
	partDuration: number
	capToPartDuration: boolean
	isLive: boolean
}

function getPieceDuration(
	piece: PieceExtended,
	partDuration: number,
	timelineBase: number,
	capToPartDuration: boolean
): number {
	return capToPartDuration
		? // capToPartDuration is something that can be used when the part is Auto and there is no chance of the Piece
		  // being extended
		  Math.min(piece.renderedDuration ?? partDuration, partDuration)
		: Math.max(
				// renderedDuration can be null. If there is a sourceDuration, use that, if not, use timelineBase
				piece.renderedDuration ?? (piece.instance.piece.content.sourceDuration ? 0 : timelineBase),
				piece.instance.piece.content.sourceDuration ?? 0
		  )
}

function widthInBase(pieceMaxDuration: number, timelineBase: number): number {
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return size * 100
}

function getScenes(piece: PieceUi): Array<number> | undefined {
	if (piece.contentPackageInfos) {
		// TODO: support multiple packages:
		const contentPackageInfos = Object.values(piece.contentPackageInfos)
		if (contentPackageInfos[0]?.deepScan?.scenes) {
			return _.compact(contentPackageInfos[0].deepScan.scenes.map((i) => i * 1000)) // convert into milliseconds
		}
	} else {
		// Fallback to media objects:
		const metadata = piece.contentMetaData as MediaObject
		if (metadata && metadata.mediainfo && metadata.mediainfo.scenes) {
			return _.compact(metadata.mediainfo.scenes.map((i) => i * 1000)) // convert into milliseconds
		}
	}
}

function getFreezes(piece: PieceUi): Array<PackageInfo.Anomaly> | undefined {
	if ((piece.instance.piece.content as VTContent | undefined)?.ignoreFreezeFrame) {
		return
	}

	if (piece.contentPackageInfos) {
		let items: Array<PackageInfo.Anomaly> = []
		// add freezes
		// TODO: support multiple packages:
		const contentPackageInfos = Object.values(piece.contentPackageInfos)
		if (contentPackageInfos[0]?.deepScan?.freezes?.length) {
			items = contentPackageInfos[0].deepScan.freezes.map((i): PackageInfo.Anomaly => {
				return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
			})
		}
		return items
	} else {
		// Fallback to media objects:
		const metadata = piece.contentMetaData as MediaObject
		let items: Array<PackageInfo.Anomaly> = []
		// add freezes
		if (metadata && metadata.mediainfo && metadata.mediainfo.freezes?.length) {
			items = metadata.mediainfo.freezes.map((i): PackageInfo.Anomaly => {
				return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
			})
		}
		return items
	}
}

function getBlacks(piece: PieceUi): Array<PackageInfo.Anomaly> | undefined {
	if ((piece.instance.piece.content as VTContent | undefined)?.ignoreBlackFrames) {
		return
	}

	if (piece.contentPackageInfos) {
		let items: Array<PackageInfo.Anomaly> = []
		// add blacks
		// TODO: support multiple packages:
		const contentPackageInfos = Object.values(piece.contentPackageInfos)
		if (contentPackageInfos[0]?.deepScan?.blacks) {
			items = [
				...items,
				...contentPackageInfos[0].deepScan.blacks.map((i): PackageInfo.Anomaly => {
					return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
				}),
			]
		}
		return items
	} else {
		// Fallback to media objects:
		const metadata = piece.contentMetaData as MediaObject
		let items: Array<PackageInfo.Anomaly> = []
		// add blacks
		if (metadata && metadata.mediainfo && metadata.mediainfo.blacks) {
			items = [
				...items,
				...metadata.mediainfo.blacks.map((i): PackageInfo.Anomaly => {
					return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
				}),
			]
		}
		return items
	}
}

// TODO: Create useMediaObjectStatus that would set up new subscriptions
export const LinePartMainPiece = withMediaObjectStatus<IProps, {}>()(function LinePartMainPiece({
	partId,
	partInstanceId,
	piece,
	partDuration,
	timelineBase,
	capToPartDuration,
	studio,
}) {
	const [hover, setHover] = useState(false)
	const [origin, setOrigin] = useState<OffsetPosition>({ left: 0, top: 0 })
	const [width, setWidth] = useState(0)
	const [mouseTimePosition, setMouseTimePosition] = useState(0)
	const [mousePosition, setMousePosition] = useState(0)
	const pieceEl = useRef<HTMLDivElement>(null)

	const pieceMaxDuration = getPieceDuration(piece, partDuration, timelineBase, capToPartDuration)
	const pieceStyle = useMemo<React.CSSProperties>(() => {
		return {
			// TODO: handle piece.enable.start
			width: `${widthInBase(pieceMaxDuration, timelineBase)}%`,
		}
	}, [pieceMaxDuration, timelineBase])

	const pieceUi = piece as PieceUi

	const seek = (piece.instance.piece.content as any).seek ?? 0

	const blacks = useMemo(() => getBlacks(pieceUi), [pieceUi.contentPackageInfos?.[0], pieceUi.contentMetaData])
	const freezes = useMemo(() => getFreezes(pieceUi), [pieceUi.contentPackageInfos?.[0], pieceUi.contentMetaData])
	const scenes = useMemo(() => getScenes(pieceUi), [pieceUi.contentPackageInfos?.[0], pieceUi.contentMetaData])

	const anomalies = useMemo(
		() => (
			<>
				{scenes &&
					scenes.map(
						(i) =>
							i < pieceMaxDuration &&
							i - seek >= 0 && (
								<span
									className="segment-timeline__piece__scene-marker"
									key={i}
									style={{ left: `${((i - seek) / pieceMaxDuration) * 100}%` }}
								></span>
							)
					)}
				{freezes &&
					freezes.map(
						(i) =>
							i.start < pieceMaxDuration &&
							i.start - seek >= 0 && (
								<span
									className="segment-timeline__piece__anomaly-marker"
									key={i.start}
									style={{
										left: `${((i.start - seek) / pieceMaxDuration) * 100}%`,
										width: `${(i.duration / pieceMaxDuration) * 100}%`,
									}}
								></span>
							)
					)}
				{blacks &&
					blacks.map(
						(i) =>
							i.start < pieceMaxDuration &&
							i.start - seek >= 0 && (
								<span
									className="segment-timeline__piece__anomaly-marker segment-timeline__piece__anomaly-marker__freezes"
									key={i.start}
									style={{
										left: `${((i.start - seek) / pieceMaxDuration) * 100}%`,
										width: `${(i.duration / pieceMaxDuration) * 100}%`,
									}}
								></span>
							)
					)}
			</>
		),
		[blacks, freezes, scenes]
	)

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			return
		}
		setHover(true)

		const newOffset = pieceEl.current && getElementDocumentOffset(pieceEl.current)
		if (newOffset !== null) {
			setOrigin(newOffset)
		}
		const newWidth = pieceEl.current && getElementWidth(pieceEl.current)
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
		setMouseTimePosition(newMousePosition)
		setMousePosition(e.pageX - origin.left)
	}

	const status = piece.instance.piece.status
	const noticeLevel = status !== null && status !== undefined ? getNoticeLevelForPieceStatus(status) : null

	return (
		<PieceElement
			className="segment-opl__main-piece"
			piece={piece}
			layer={piece.sourceLayer}
			partId={partId}
			style={pieceStyle}
			ref={pieceEl}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
		>
			{piece.sourceLayer?.type === SourceLayerType.SPLITS && (
				<div className="segment-opl__main-piece__bkg">{getSplitItems(piece, 'segment-opl__main-piece__item')}</div>
			)}
			{anomalies}
			<div className="segment-opl__main-piece__label">
				{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
				{piece.sourceLayer?.type === SourceLayerType.LOCAL && (piece.instance.piece.content as EvsContent).color && (
					<ColoredMark color={(piece.instance.piece.content as EvsContent).color} />
				)}
				{piece.instance.piece.name}
			</div>
			{studio && (
				<PieceHoverInspector
					hoverScrubTimePosition={mouseTimePosition * (piece.instance.piece.content.sourceDuration || 0)}
					hovering={hover}
					pieceInstance={piece}
					layer={piece.sourceLayer}
					originPosition={origin}
					mousePosition={mousePosition}
					isFinished={false}
					isLive={false}
					isNext={false}
					partAutoNext={false}
					studio={studio}
					partId={partId}
					partInstanceId={partInstanceId}
				/>
			)}
		</PieceElement>
	)
})

function ColoredMark({ color }: { color: string | undefined }) {
	if (!color) return null

	return (
		<span
			style={{ color: color.startsWith('#') ? color : `#${color}` }}
			className="segment-opl__main-piece__label__colored-mark"
		></span>
	)
}
