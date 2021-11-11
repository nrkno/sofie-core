import React, { useCallback, useEffect, useState } from 'react'
import * as VelocityReact from 'velocity-react'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { SegmentNote } from '../../../lib/api/notes'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { SegmentId } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import { IContextMenuContext } from '../RundownView'
import { PartUi, PieceUi, SegmentUi } from '../SegmentContainer/withResolvedSegment'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { SegmentDuration } from '../RundownView/RundownTiming/SegmentDuration'
import { PartCountdown } from '../RundownView/RundownTiming/PartCountdown'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { PartId } from '../../../lib/collections/Parts'
import { Settings } from '../../../lib/Settings'
import { useTranslation } from 'react-i18next'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { literal, unprotectString } from '../../../lib/lib'
import { scrollToPart } from '../../lib/viewPort'
import { StoryboardPart } from './StoryboardPart'
import { RundownHoldState } from '../../../lib/collections/Rundowns'
import classNames from 'classnames'
import RundownViewEventBus, { RundownViewEvents } from '../RundownView/RundownViewEventBus'

export const StudioContext = React.createContext<Studio | undefined>(undefined)

interface IProps {
	id: string
	key: string
	segment: SegmentUi
	playlist: RundownPlaylist
	studio: Studio
	parts: Array<PartUi>
	segmentNotes: Array<SegmentNote>
	// timeScale: number
	// maxTimeScale: number
	// onRecalculateMaxTimeScale: () => Promise<number>
	// showingAllSegment: boolean
	// onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	// collapsedOutputs: {
	// 	[key: string]: boolean
	// }
	hasAlreadyPlayed: boolean
	hasGuestItems: boolean
	hasRemoteItems: boolean
	isLiveSegment: boolean
	isNextSegment: boolean
	isQueuedSegment: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	displayLiveLineCounter: boolean
	currentPartWillAutoNext: boolean
	onScroll: (scrollLeft: number, event: any) => void
	onZoomChange: (newScale: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	onShowEntireSegment?: (event: any) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onItemClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onItemDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
	isLastSegment: boolean
	lastValidPartIndex: number | undefined
	budgetDuration?: number
	showCountdownToSegment: boolean
	fixedSegmentDuration: boolean | undefined
	subscriptionsReady: boolean
}

const PART_WIDTH = 160 // Must match SCSS: $segment-storyboard-part-width

export const SegmentStoryboard = React.memo(
	React.forwardRef<HTMLDivElement, IProps>(function SegmentStoryboard(props: IProps, ref) {
		const [scrollLeft, setScrollLeft] = useState(0)
		const [animateScrollLeft] = useState(true)
		const { t } = useTranslation()
		const notes: Array<SegmentNote> = props.segmentNotes

		const identifiers: Array<{ partId: PartId; ident?: string }> = props.parts
			.map((p) =>
				p.instance.part.identifier
					? {
							partId: p.partId,
							ident: p.instance.part.identifier,
					  }
					: null
			)
			.filter((entry) => entry !== null) as Array<{ partId: PartId; ident?: string }>

		let countdownToPartId: PartId | undefined = undefined
		if (!props.isLiveSegment) {
			const nextPart = props.isNextSegment
				? props.parts.find((p) => p.instance._id === props.playlist.nextPartInstanceId)
				: props.parts[0]

			if (nextPart) {
				countdownToPartId = nextPart.instance.part._id
			}
		}

		const criticalNotes = notes.reduce((prev, item) => {
			if (item.type === NoteSeverity.ERROR) return ++prev
			return prev
		}, 0)
		const warningNotes = notes.reduce((prev, item) => {
			if (item.type === NoteSeverity.WARNING) return ++prev
			return prev
		}, 0)

		const [useTimeOfDayCountdowns, setUseTimeOfDayCountdowns] = useState(
			UIStateStorage.getItemBoolean(
				`rundownView.${props.playlist._id}`,
				`segment.${props.segment._id}.useTimeOfDayCountdowns`,
				!!props.playlist.timeOfDayCountdowns
			)
		)
		const [highlight] = useState(false)

		const getSegmentContext = (_props) => {
			const ctx = literal<IContextMenuContext>({
				segment: props.segment,
				part: props.parts.find((p) => p.instance.part.isPlayable()) || null,
			})

			if (props.onContextMenu && typeof props.onContextMenu === 'function') {
				props.onContextMenu(ctx)
			}

			return ctx
		}

		const onTimeUntilClick = () => {
			const newUseTimeOfDayCountdowns = !useTimeOfDayCountdowns
			setUseTimeOfDayCountdowns(!useTimeOfDayCountdowns)
			UIStateStorage.setItem(
				`rundownView.${props.playlist._id}`,
				`segment.${props.segment._id}.useTimeOfDayCountdowns`,
				newUseTimeOfDayCountdowns
			)
		}

		const onClickPartIdent = (partId: PartId) => {
			scrollToPart(partId, false, true, true).catch((error) => {
				if (!error.toString().match(/another scroll/)) console.error(error)
			})
		}

		let nextPartIndex = -1
		let currentPartIndex = -1

		const parts = props.parts.map((part, index) => {
			const isLivePart = part.instance._id === props.playlist.currentPartInstanceId
			const isNextPart = part.instance._id === props.playlist.nextPartInstanceId

			if (isLivePart) currentPartIndex = index
			if (isNextPart) nextPartIndex = index

			return (
				<StoryboardPart
					key={unprotectString(part.instance._id)}
					part={part}
					isLivePart={isLivePart}
					isNextPart={isNextPart}
					inHold={!!(props.playlist.holdState && props.playlist.holdState !== RundownHoldState.COMPLETE)}
					currentPartWillAutonext={isNextPart && props.currentPartWillAutoNext}
					outputLayers={props.segment.outputLayers}
					subscriptionsReady={props.subscriptionsReady}
				/>
			)
		})

		useEffect(() => {
			if (props.followLiveLine) {
				if (nextPartIndex >= 0 && currentPartIndex >= 0) {
					setScrollLeft(Math.max(0, currentPartIndex * PART_WIDTH - props.liveLineHistorySize))
				} else if (nextPartIndex >= 0) {
					setScrollLeft(Math.max(0, nextPartIndex * PART_WIDTH - props.liveLineHistorySize))
				} else if (currentPartIndex >= 0) {
					setScrollLeft(Math.max(0, currentPartIndex * PART_WIDTH - props.liveLineHistorySize))
				}
			}
		}, [currentPartIndex, nextPartIndex, props.followLiveLine])

		const onRewindSegment = useCallback(() => {
			setScrollLeft(0)
		}, [])

		useEffect(() => {
			RundownViewEventBus.on(RundownViewEvents.REWIND_SEGMENTS, onRewindSegment)
			// RundownViewEventBus.on(RundownViewEvents.GO_TO_PART, onGoToPart)
			// RundownViewEventBus.on(RundownViewEvents.GO_TO_PART_INSTANCE, onGoToPartInstance)

			return () => {
				RundownViewEventBus.off(RundownViewEvents.REWIND_SEGMENTS, onRewindSegment)
			}
		}, [onRewindSegment])

		return (
			<div
				id={props.id}
				className={classNames('segment-timeline', 'segment-storyboard', {
					live: props.isLiveSegment,
					next: !props.isLiveSegment && props.isNextSegment,
					queued: props.isQueuedSegment,

					'has-played':
						props.hasAlreadyPlayed &&
						!props.isLiveSegment &&
						!props.isNextSegment &&
						!props.hasGuestItems &&
						!props.hasRemoteItems,

					'has-guest-items': props.hasGuestItems,
					'has-remote-items': props.hasRemoteItems,
					'has-identifiers': identifiers.length > 0,
					'invert-flash': highlight,

					'time-of-day-countdowns': useTimeOfDayCountdowns,
				})}
				data-obj-id={props.segment._id}
				ref={ref}
			>
				<StudioContext.Provider value={props.studio}>
					<ContextMenuTrigger
						id="segment-timeline-context-menu"
						collect={getSegmentContext}
						attributes={{
							className: 'segment-timeline__title',
						}}
						holdToDisplay={contextMenuHoldToDisplayTime()}
						renderTag="div"
					>
						<h2
							className={'segment-timeline__title__label' + (props.segment.identifier ? ' identifier' : '')}
							data-identifier={props.segment.identifier}
						>
							{props.segment.name}
						</h2>
						{(criticalNotes > 0 || warningNotes > 0) && (
							<div className="segment-timeline__title__notes">
								{criticalNotes > 0 && (
									<div
										className="segment-timeline__title__notes__note segment-timeline__title__notes__note--critical"
										onClick={() =>
											props.onHeaderNoteClick && props.onHeaderNoteClick(props.segment._id, NoteSeverity.ERROR)
										}
									>
										<CriticalIconSmall />
										<div className="segment-timeline__title__notes__count">{criticalNotes}</div>
									</div>
								)}
								{warningNotes > 0 && (
									<div
										className="segment-timeline__title__notes__note segment-timeline__title__notes__note--warning"
										onClick={() =>
											props.onHeaderNoteClick && props.onHeaderNoteClick(props.segment._id, NoteSeverity.WARNING)
										}
									>
										<WarningIconSmall />
										<div className="segment-timeline__title__notes__count">{warningNotes}</div>
									</div>
								)}
							</div>
						)}
						{identifiers.length > 0 && (
							<div className="segment-timeline__part-identifiers">
								{identifiers.map((ident) => (
									<div
										className="segment-timeline__part-identifiers__identifier"
										key={ident.partId + ''}
										onClick={() => onClickPartIdent(ident.partId)}
									>
										{ident.ident}
									</div>
								))}
							</div>
						)}
					</ContextMenuTrigger>
					<div className="segment-timeline__duration" tabIndex={0}>
						{props.playlist &&
							props.parts &&
							props.parts.length > 0 &&
							(!props.hasAlreadyPlayed || props.isNextSegment || props.isLiveSegment) && (
								<SegmentDuration
									segmentId={props.segment._id}
									parts={props.parts}
									label={<span className="segment-timeline__duration__label">{t('Duration')}</span>}
									fixed={props.fixedSegmentDuration}
								/>
							)}
					</div>
					<div className="segment-timeline__timeUntil" onClick={onTimeUntilClick}>
						{props.playlist && props.parts && props.parts.length > 0 && props.showCountdownToSegment && (
							<PartCountdown
								partId={countdownToPartId}
								hideOnZero={!useTimeOfDayCountdowns}
								useWallClock={useTimeOfDayCountdowns}
								playlist={props.playlist}
								label={
									useTimeOfDayCountdowns ? (
										<span className="segment-timeline__timeUntil__label">{t('On Air At')}</span>
									) : (
										<span className="segment-timeline__timeUntil__label">{t('On Air In')}</span>
									)
								}
							/>
						)}
						{Settings.preserveUnsyncedPlayingSegmentContents && props.segment.orphaned && (
							<span className="segment-timeline__unsynced">{t('Unsynced')}</span>
						)}
					</div>
					<div className="segment-timeline__mos-id">{props.segment.externalId}</div>
					<div className="segment-storyboard__part-list__container">
						<VelocityReact.VelocityComponent
							animation={{
								translateX: `-${scrollLeft}px`,
							}}
							duration={animateScrollLeft ? 100 : 0}
						>
							<div
								className={classNames('segment-storyboard__part-list', {
									loading: !props.subscriptionsReady,
								})}
							>
								{parts}
							</div>
						</VelocityReact.VelocityComponent>
						<div className="segment-storyboard__history-shade"></div>
					</div>
				</StudioContext.Provider>
			</div>
		)
	})
)

SegmentStoryboard.displayName = 'SegmentStoryboard'
