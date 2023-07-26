import React from 'react'
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown'
import classNames from 'classnames'
import { MediaStatusIndicator } from '../../MediaStatus/MediaStatusIndicator'

export const MediaStatusItem = withTiming<
	{
		partId: PartId | undefined
		partInstanceId: PartInstanceId | undefined
		status: PieceStatusCode
		statusOverlay?: string | undefined
		sourceLayerType?: SourceLayerType | undefined
		sourceLayerName?: string | undefined
		segmentIdentifier?: string | undefined
		partIdentifier?: string | undefined
		invalid?: boolean | undefined
		label: string
		isAdLib: boolean
	},
	{}
>({
	dataResolution: TimingDataResolution.Synced,
	tickResolution: TimingTickResolution.Low,
})(function MediaStatusItem({
	partId,
	partInstanceId,
	status,
	statusOverlay,
	sourceLayerType,
	sourceLayerName,
	segmentIdentifier,
	partIdentifier,
	invalid,
	label,
	timingDurations,
	isAdLib,
}): JSX.Element {
	const timingId = unprotectString(partInstanceId ?? partId)
	const thisPartCountdown = timingId ? timingDurations.partCountdown?.[timingId] : undefined

	const sourceLayerClassName =
		sourceLayerType !== undefined ? RundownUtils.getSourceLayerClassName(sourceLayerType) : undefined

	return (
		<tr className="media-status-popup-item">
			<td className="media-status-popup-item__countdown">
				{!isAdLib && thisPartCountdown ? RundownUtils.formatTimeToShortTime(thisPartCountdown) : null}
			</td>
			<td className="media-status-popup-item__status">
				<MediaStatusIndicator status={status} overlay={statusOverlay} />
			</td>
			<td className="media-status-popup-item__source-layer">
				<div
					data-status={status}
					className={classNames('media-status-popup-item__source-layer-indicator', sourceLayerClassName, {
						'source-missing': status === PieceStatusCode.SOURCE_MISSING || status === PieceStatusCode.SOURCE_NOT_SET,
						'source-unknown-state': status === PieceStatusCode.SOURCE_UNKNOWN_STATE,
						'source-broken': status === PieceStatusCode.SOURCE_BROKEN,
						'source-not-ready': status === PieceStatusCode.SOURCE_NOT_READY,
					})}
				>
					{invalid && <div className={'media-status-popup-item__source-layer-overlay invalid'}></div>}
					<div className="media-status-popup-item__source-layer-label">{sourceLayerName}</div>
				</div>
			</td>
			<td className="media-status-popup-item__identifiers">
				{segmentIdentifier ? (
					<div className="media-status-popup-item__segment-identifier">{segmentIdentifier}</div>
				) : null}
				{partIdentifier ? <div className="media-status-popup-item__part-identifier">{partIdentifier}</div> : null}
			</td>
			<td className="media-status-popup-item__label">{label}</td>
		</tr>
	)
})
