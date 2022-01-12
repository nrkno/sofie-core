import React from 'react'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Studio } from '../../../../lib/collections/Studios'
import { ISourceLayerExtended } from '../../../../lib/Rundown'
import { IContextMenuContext } from '../../RundownView'
import { IOutputLayerUi, PartUi, PieceUi, SegmentUi } from '../SegmentTimelineContainer'
import { FlattenedSourceLayers } from './FlattenedSourceLayers'
import { SourceLayer } from './SourceLayer'
import classNames from 'classnames'
import { DEBUG_MODE } from '../SegmentTimelineDebugMode'
import { RundownUtils } from '../../../lib/rundown'

interface IOutputGroupProps {
	layer: IOutputLayerUi
	sourceLayers: ISourceLayerExtended[]
	playlist: RundownPlaylist
	studio: Studio
	segment: SegmentUi
	part: PartUi
	mediaPreviewUrl: string
	startsAt: number
	duration: number
	expectedDuration: number
	timeScale: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	isLiveLine: boolean
	isNextLine: boolean
	isTooSmallForText: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	autoNextPart: boolean
	relative: boolean
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	indexOffset: number
	isPreview: boolean
}

export function OutputGroup(props: IOutputGroupProps) {
	const isCollapsed =
		props.collapsedOutputs[props.layer._id] !== undefined
			? props.collapsedOutputs[props.layer._id] === true
			: props.layer.isDefaultCollapsed

	function renderInside(isOutputGroupCollapsed) {
		if (props.sourceLayers !== undefined) {
			if (!props.layer.isFlattened) {
				return props.sourceLayers.map((sourceLayer, index) => {
					return (
						<SourceLayer
							key={sourceLayer._id}
							studio={props.studio}
							layer={sourceLayer}
							playlist={props.playlist}
							outputLayer={props.layer}
							outputGroupCollapsed={isOutputGroupCollapsed}
							segment={props.segment}
							part={props.part}
							startsAt={props.startsAt}
							duration={props.duration}
							expectedDuration={props.expectedDuration}
							timeScale={props.timeScale}
							autoNextPart={props.autoNextPart}
							liveLinePadding={props.liveLinePadding}
							layerIndex={props.indexOffset + (isCollapsed ? 0 : index)}
							mediaPreviewUrl={props.mediaPreviewUrl}
							followLiveLine={props.followLiveLine}
							isLiveLine={props.isLiveLine}
							isNextLine={props.isLiveLine}
							isTooSmallForText={props.isTooSmallForText}
							liveLineHistorySize={props.liveLineHistorySize}
							livePosition={props.livePosition}
							relative={props.relative}
							scrollLeft={props.scrollLeft}
							scrollWidth={props.scrollWidth}
							onContextMenu={props.onContextMenu}
							onFollowLiveLine={props.onFollowLiveLine}
							onPieceClick={props.onPieceClick}
							onPieceDoubleClick={props.onPieceDoubleClick}
							isPreview={props.isPreview}
						/>
					)
				})
			} else {
				return (
					<FlattenedSourceLayers
						key={props.layer._id + '_flattened'}
						studio={props.studio}
						layers={props.sourceLayers}
						playlist={props.playlist}
						outputLayer={props.layer}
						outputGroupCollapsed={isOutputGroupCollapsed}
						segment={props.segment}
						part={props.part}
						startsAt={props.startsAt}
						duration={props.duration}
						expectedDuration={props.expectedDuration}
						timeScale={props.timeScale}
						autoNextPart={props.autoNextPart}
						liveLinePadding={props.liveLinePadding}
						layerIndex={props.indexOffset}
						mediaPreviewUrl={props.mediaPreviewUrl}
						followLiveLine={props.followLiveLine}
						isLiveLine={props.isLiveLine}
						isNextLine={props.isLiveLine}
						isTooSmallForText={props.isTooSmallForText}
						liveLineHistorySize={props.liveLineHistorySize}
						livePosition={props.livePosition}
						relative={props.relative}
						scrollLeft={props.scrollLeft}
						scrollWidth={props.scrollWidth}
						onContextMenu={props.onContextMenu}
						onFollowLiveLine={props.onFollowLiveLine}
						onPieceClick={props.onPieceClick}
						onPieceDoubleClick={props.onPieceDoubleClick}
						isPreview={props.isPreview}
					/>
				)
			}
		}
	}

	return (
		<div
			className={classNames(
				'segment-timeline__output-group',
				{
					collapsable: props.layer.sourceLayers && props.layer.sourceLayers.length > 1 && !props.layer.isFlattened,
					collapsed: isCollapsed,
					flattened: props.layer.isFlattened,
				},
				`layer-count-${props.layer.isFlattened ? 1 : isCollapsed ? 1 : props.sourceLayers?.length || 0}`
			)}
			data-layer-group-id={props.layer._id}
		>
			{DEBUG_MODE && (
				<div className="segment-timeline__debug-info red">
					{RundownUtils.formatTimeToTimecode(props.studio.settings, props.startsAt)}
				</div>
			)}
			{renderInside(isCollapsed)}
		</div>
	)
}
