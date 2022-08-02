import React from 'react'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import classNames from 'classnames'
// import { InView } from 'react-intersection-observer'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { SwitchViewModeButton } from '../SegmentContainer/SwitchViewModeButton'
import { SegmentViewMode } from '../SegmentContainer/SegmentViewModes'
import { Studio } from '../../../lib/collections/Studios'
import { PartUi, SegmentUi } from '../SegmentContainer/withResolvedSegment'
import { SegmentNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { PartCountdown } from '../RundownView/RundownTiming/PartCountdown'
import { SegmentDuration } from '../RundownView/RundownTiming/SegmentDuration'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { IContextMenuContext } from '../RundownView'
// import { getHeaderHeight } from '../../lib/viewPort'
import ReactDOM from 'react-dom'

export function SegmentListHeader({
	isDetached,
	segment,
	parts,
	playlist,
	studio,
	highlight,
	isLiveSegment,
	isNextSegment,
	isQueuedSegment,
	useTimeOfDayCountdowns,
	fixedSegmentDuration,
	showCountdownToSegment,
	hasAlreadyPlayed,
	onSwitchViewMode,
	getSegmentContext,
	onTimeUntilClick,
}: {
	isDetached: boolean
	segment: SegmentUi
	playlist: RundownPlaylist
	studio: Studio
	parts: Array<PartUi>
	segmentNotes: Array<SegmentNote>
	highlight: boolean
	isLiveSegment: boolean
	isNextSegment: boolean
	isQueuedSegment: boolean
	useTimeOfDayCountdowns: boolean
	hasAlreadyPlayed: boolean
	showCountdownToSegment: boolean
	fixedSegmentDuration: boolean
	onSwitchViewMode?: (newViewMode: SegmentViewMode) => void
	onTimeUntilClick: () => void
	getSegmentContext: () => IContextMenuContext
}) {
	const { t } = useTranslation()

	// TODO: This still needs to detect when it should stop being detached, because the original segment is no longer
	// sufficiently in view

	let countdownToPartId: PartId | undefined = undefined
	if (!isLiveSegment) {
		const nextPart = isNextSegment ? parts.find((p) => p.instance._id === playlist.nextPartInstanceId) : parts[0]

		if (nextPart) {
			countdownToPartId = nextPart.instance.part._id
		}
	}

	// function onChange(inView: boolean, entry: IntersectionObserverEntry) {
	// 	const shouldDetach = !inView && parts.length > 1 && entry.boundingClientRect.top < window.innerHeight / 2
	// 	setDetached(shouldDetach)
	// }

	const contents = (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			collect={getSegmentContext}
			attributes={{
				className: 'segment-opl__title',
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			renderTag="div"
		>
			<div className="segment-opl__counters">
				<div
					className={classNames('segment-opl__duration', {
						hidden: hasAlreadyPlayed && !isLiveSegment && !isNextSegment,
					})}
					tabIndex={0}
					onClick={onTimeUntilClick}
				>
					{playlist && parts && parts.length > 0 && (
						<SegmentDuration
							segmentId={segment._id}
							parts={parts}
							label={<span className="segment-timeline__duration__label">{t('Duration')}</span>}
							fixed={fixedSegmentDuration}
						/>
					)}
				</div>
			</div>
			<h2
				id={`segment-name-${segment._id}`}
				className={'segment-opl__title__label' + (segment.identifier ? ' identifier' : '')}
				data-identifier={segment.identifier}
			>
				{segment.name}
			</h2>
			<div className="segment-opl__counters">
				<div
					className={classNames('segment-opl__timeUntil', {
						'segment-opl__timeUntil--time-of-day': useTimeOfDayCountdowns,
					})}
					onClick={onTimeUntilClick}
				>
					{playlist && parts && parts.length > 0 && showCountdownToSegment && (
						<PartCountdown
							partId={countdownToPartId}
							hideOnZero={!useTimeOfDayCountdowns}
							useWallClock={useTimeOfDayCountdowns}
							playlist={playlist}
							label={
								useTimeOfDayCountdowns ? (
									<span className="segment-timeline__timeUntil__label">{t('On Air At')}</span>
								) : (
									<span className="segment-timeline__timeUntil__label">{t('On Air In')}</span>
								)
							}
						/>
					)}
					{studio.settings.preserveUnsyncedPlayingSegmentContents && segment.orphaned && (
						<span className="segment-timeline__unsynced">{t('Unsynced')}</span>
					)}
				</div>
			</div>
			<ErrorBoundary>
				<SwitchViewModeButton currentMode={SegmentViewMode.List} onSwitchViewMode={onSwitchViewMode} />
			</ErrorBoundary>
		</ContextMenuTrigger>
	)

	return (
		// <InView threshold={1} rootMargin={`-${getHeaderHeight()}px 0px 0px 0px`} onChange={onChange} as="div">
		<>
			{contents}
			{isDetached &&
				ReactDOM.createPortal(
					<div
						className={classNames('segment-opl__title-float-parent dark', {
							live: isLiveSegment,
							next: !isLiveSegment && isNextSegment,
							queued: isQueuedSegment,

							'has-played': hasAlreadyPlayed && !isLiveSegment && !isNextSegment,

							'invert-flash': highlight,

							'time-of-day-countdowns': useTimeOfDayCountdowns,
						})}
					>
						{contents}
					</div>,
					document.body
				)}
		</>
		// </InView>
	)
}
