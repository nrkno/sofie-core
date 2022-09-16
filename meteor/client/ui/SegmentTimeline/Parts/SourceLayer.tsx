import React, { useCallback, useState } from 'react'
import _ from 'underscore'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Studio } from '../../../../lib/collections/Studios'
import { literal, unprotectString } from '../../../../lib/lib'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { IContextMenuContext } from '../../RundownView'
import { IOutputLayerUi, ISourceLayerUi, PartUi, PieceUi, SegmentUi } from '../SegmentTimelineContainer'
import { SegmentTimelinePartElementId } from './SegmentTimelinePart'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { SourceLayerItemContainer } from '../SourceLayerItemContainer'
import { contextMenuHoldToDisplayTime } from '../../../lib/lib'

export interface ISourceLayerPropsBase {
	key: string
	outputLayer: IOutputLayerUi
	playlist: RundownPlaylist
	studio: Studio
	segment: SegmentUi
	part: PartUi
	mediaPreviewUrl: string
	startsAt: number
	duration: number
	expectedDuration: number
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	isTooSmallForText: boolean
	outputGroupCollapsed: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	relative: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	autoNextPart: boolean
	layerIndex: number
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	isPreview: boolean
}
interface ISourceLayerProps extends ISourceLayerPropsBase {
	layer: ISourceLayerUi
	showDuration?: boolean
}

export function useMouseContext(props: ISourceLayerPropsBase) {
	const [mousePosition, setMousePosition] = useState<OffsetPosition>({ left: 0, top: 0 })

	return {
		getPartContext: useCallback(() => {
			const partElement = document.querySelector('#' + SegmentTimelinePartElementId + props.part.instance._id)
			const partDocumentOffset = getElementDocumentOffset(partElement)

			const ctx = literal<IContextMenuContext>({
				segment: props.segment,
				part: props.part,
				partDocumentOffset: partDocumentOffset || undefined,
				timeScale: props.timeScale,
				mousePosition: mousePosition,
				partStartsAt: props.startsAt,
			})

			if (props.onContextMenu && typeof props.onContextMenu === 'function') {
				props.onContextMenu(ctx)
			}

			return ctx
		}, [props.segment, props.part, props.timeScale, props.startsAt, props.onContextMenu, mousePosition]),
		onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => {
			setMousePosition({ left: e.pageX, top: e.pageY })
		},
	}
}

export function SourceLayer(props: ISourceLayerProps) {
	const { getPartContext, onMouseUp } = useMouseContext(props)

	return (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			attributes={{
				className: 'segment-timeline__layer',
				//@ts-ignore A Data attribue is perfectly fine
				'data-layer-id': props.layer._id,
				onMouseUpCapture: (e) => onMouseUp(e),
				role: 'log',
				'aria-live': 'assertive',
				'aria-label': props.layer.name,
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			collect={getPartContext}
		>
			{props.layer.pieces !== undefined
				? _.chain(
						props.layer.pieces.filter((piece) => {
							// filter only pieces belonging to this part
							return piece.instance.partInstanceId === props.part.instance._id
								? // filter only pieces, that have not been hidden from the UI
								  piece.instance.hidden !== true && piece.instance.piece.virtual !== true
								: false
						})
				  )
						.sortBy((it) => it.renderedInPoint)
						.sortBy((it) => it.cropped)
						.map((piece) => {
							return (
								<SourceLayerItemContainer
									key={unprotectString(piece.instance._id)}
									onClick={props.onPieceClick}
									onDoubleClick={props.onPieceDoubleClick}
									mediaPreviewUrl={props.mediaPreviewUrl}
									piece={piece}
									layer={props.layer}
									outputLayer={props.outputLayer}
									part={props.part}
									partStartsAt={props.startsAt}
									partDuration={props.duration}
									partExpectedDuration={props.expectedDuration}
									timeScale={props.timeScale}
									relative={props.relative}
									autoNextPart={props.autoNextPart}
									liveLinePadding={props.liveLinePadding}
									scrollLeft={props.scrollLeft}
									scrollWidth={props.scrollWidth}
									playlist={props.playlist}
									studio={props.studio}
									followLiveLine={props.followLiveLine}
									isLiveLine={props.isLiveLine}
									isNextLine={props.isNextLine}
									isTooSmallForText={props.isTooSmallForText}
									liveLineHistorySize={props.liveLineHistorySize}
									livePosition={props.livePosition}
									outputGroupCollapsed={props.outputGroupCollapsed}
									onFollowLiveLine={props.onFollowLiveLine}
									layerIndex={props.layerIndex}
									isPreview={props.isPreview}
									showDuration={props.showDuration}
								/>
							)
						})
						.value()
				: null}
		</ContextMenuTrigger>
	)
}
