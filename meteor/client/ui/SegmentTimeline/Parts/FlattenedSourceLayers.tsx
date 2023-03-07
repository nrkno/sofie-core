import React from 'react'
import * as _ from 'underscore'
import { unprotectString } from '../../../../lib/lib'
import { ISourceLayerUi } from '../SegmentTimelineContainer'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { SourceLayerItemContainer } from '../SourceLayerItemContainer'
import { ISourceLayerPropsBase, useMouseContext } from './SourceLayer'
import { ISourceLayerExtended } from '../../../../lib/Rundown'

interface IFlattenedSourceLayerProps extends ISourceLayerPropsBase {
	layers: ISourceLayerUi[]
	shouldShowDuration: (layer: ISourceLayerExtended) => boolean
}

export function FlattenedSourceLayers(props: IFlattenedSourceLayerProps): JSX.Element {
	const { getPartContext, onMouseUp } = useMouseContext(props)

	return (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			attributes={{
				className: 'segment-timeline__layer segment-timeline__layer--flattened',
				onMouseUpCapture: (e) => onMouseUp(e),
				role: 'log',
				'aria-live': 'assertive',
				'aria-label': props.outputLayer.name,
			}}
			collect={getPartContext}
		>
			{props.layers.map((layer) => {
				if (layer.pieces !== undefined) {
					return _.chain(
						layer.pieces.filter((piece) => {
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
									studio={props.studio}
									playlist={props.playlist}
									followLiveLine={props.followLiveLine}
									isLiveLine={props.isLiveLine}
									isNextLine={props.isNextLine}
									isTooSmallForText={props.isTooSmallForText}
									liveLineHistorySize={props.liveLineHistorySize}
									livePosition={props.livePosition}
									outputGroupCollapsed={props.outputGroupCollapsed}
									onFollowLiveLine={props.onFollowLiveLine}
									onClick={props.onPieceClick}
									onDoubleClick={props.onPieceDoubleClick}
									mediaPreviewUrl={props.mediaPreviewUrl}
									piece={piece}
									layer={layer}
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
									layerIndex={props.layerIndex}
									isPreview={props.isPreview}
									showDuration={props.shouldShowDuration(layer)}
								/>
							)
						})
						.value()
				}
			})}
		</ContextMenuTrigger>
	)
}
