import {
	GraphicsContent,
	ISourceLayer,
	SourceLayerType,
	TransitionContent,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import React from 'react'
import { UIStudio } from '../../../lib/api/studios'
import { getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications'
import { RundownUtils } from '../../lib/rundown'
import { OffsetPosition } from '../../utils/positions'
import { FloatingInspector } from '../FloatingInspector'
import { L3rdFloatingInspector } from '../FloatingInspectors/L3rdFloatingInspector'
import { VTFloatingInspector } from '../FloatingInspectors/VTFloatingInspector'
import { PieceUi } from '../SegmentContainer/withResolvedSegment'

// TODO: Clean up upper-level component props
export function PieceHoverInspector({
	studio,
	pieceInstance,
	hovering,
	hoverScrubTimePosition,
	originPosition,
	mousePosition,
	layer,
}: {
	studio: UIStudio
	pieceInstance: PieceUi
	hovering: boolean
	hoverScrubTimePosition: number
	originPosition: OffsetPosition
	mousePosition: number
	layer: ISourceLayer | undefined
}): JSX.Element | null {
	const mediaPreviewUrl = studio.settings.mediaPreviewsUrl

	const status = pieceInstance.instance.piece.status

	const vtContent = pieceInstance.instance.piece.content as VTContent
	const graphicsContent = pieceInstance.instance.piece.content as GraphicsContent
	const transitionContent = pieceInstance.instance.piece.content as TransitionContent

	const noticeLevel = status !== null && status !== undefined ? getNoticeLevelForPieceStatus(status) : null

	switch (layer?.type) {
		case SourceLayerType.TRANSITION:
			// TODO: Move this code to a shared TransitionFloatingInspector
			return (
				<FloatingInspector shown={hovering}>
					{transitionContent && transitionContent.preview && (
						<div
							className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
							style={{
								top: originPosition.top + 'px',
								left: originPosition.left + mousePosition + 'px',
								transform: 'translate(0, -100%)',
							}}
						>
							<img src={'/blueprints/assets/' + transitionContent.preview} className="thumbnail" />
						</div>
					)}
				</FloatingInspector>
			)
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.LOWER_THIRD:
			return (
				<L3rdFloatingInspector
					showMiniInspector={hovering}
					content={graphicsContent}
					floatingInspectorStyle={{
						top: originPosition.top + 'px',
						left: originPosition.left + mousePosition + 'px',
						transform: 'translate(0, -100%)',
					}}
					typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
					itemElement={null}
					piece={pieceInstance.instance.piece}
					pieceRenderedDuration={pieceInstance.renderedDuration}
					pieceRenderedIn={pieceInstance.renderedInPoint}
					displayOn="document"
				/>
			)
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
			return (
				<VTFloatingInspector
					status={status || PieceStatusCode.UNKNOWN}
					showMiniInspector={hovering}
					timePosition={hoverScrubTimePosition}
					content={vtContent}
					floatingInspectorStyle={{
						top: originPosition.top + 'px',
						left: originPosition.left + mousePosition + 'px',
						transform: 'translate(0, -100%)',
					}}
					typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
					itemElement={null}
					contentMetaData={pieceInstance.contentMetaData || null}
					noticeMessages={pieceInstance.messages || null}
					noticeLevel={noticeLevel}
					mediaPreviewUrl={mediaPreviewUrl}
					contentPackageInfos={pieceInstance.contentPackageInfos}
					pieceId={pieceInstance.instance.piece._id}
					expectedPackages={pieceInstance.instance.piece.expectedPackages}
					studio={studio}
				/>
			)
	}

	return null
}
