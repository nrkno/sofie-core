import React, { ReactNode, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { SegmentNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { RundownHoldState, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Studio } from '../../../lib/collections/Studios'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { PartUi, SegmentUi } from '../SegmentContainer/withResolvedSegment'
import { IContextMenuContext } from '../RundownView'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime, useCombinedRefs } from '../../lib/lib'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { SegmentDuration } from '../RundownView/RundownTiming/SegmentDuration'
import { PartCountdown } from '../RundownView/RundownTiming/PartCountdown'
import { useTranslation } from 'react-i18next'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { LinePart } from './LinePart'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ISourceLayerExtended } from '../../../lib/Rundown'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { SegmentViewMode } from '../SegmentContainer/SegmentViewModes'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { SwitchViewModeButton } from '../SegmentContainer/SwitchViewModeButton'

export const StudioContext = React.createContext<Studio | undefined>(undefined)

interface IProps {
	id: string
	isLiveSegment: boolean
	isNextSegment: boolean
	isQueuedSegment: boolean
	hasAlreadyPlayed: boolean

	currentPartWillAutoNext: boolean

	key: string
	segment: SegmentUi
	playlist: RundownPlaylist
	studio: Studio
	parts: Array<PartUi>
	segmentNotes: Array<SegmentNote>

	fixedSegmentDuration: boolean
	showCountdownToSegment: boolean
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onSwitchViewMode: (newViewMode: SegmentViewMode) => void
}

// TODO: This is a horribly wonky hack for the prototype
const BANNED_COLUMN_NAMES = new Set()

// TODO: This is not great. Ideally, we would be able to figure out which SourceLayers are to be shown as columns
// based on if they are used in the PGM or not. However, we don't have that information. We can figure out if
// a given PIECE is going to be used on PGM, but SourceLayers can be shared across Outputs, so that's complicated
// on this level.
const COLUMN_SUPPORTED_LAYER_TYPES: Set<SourceLayerType> = new Set([
	SourceLayerType.AUDIO,
	SourceLayerType.LOWER_THIRD,
	// SourceLayerType.METADATA,
	SourceLayerType.SCRIPT,
	// SourceLayerType.UNKNOWN,
])

const SegmentListInner = React.forwardRef<HTMLDivElement, IProps>(function SegmentList(props, ref) {
	const innerRef = useRef<HTMLDivElement>(null)
	const combinedRef = useCombinedRefs(null, ref, innerRef)
	const { t } = useTranslation()
	const [highlight, _setHighlight] = useState(false)
	const [useTimeOfDayCountdowns, setUseTimeOfDayCountdowns] = useState(
		UIStateStorage.getItemBoolean(
			`rundownView.${props.playlist._id}`,
			`segment.${props.segment._id}.useTimeOfDayCountdowns`,
			!!props.playlist.timeOfDayCountdowns
		)
	)

	const getSegmentContext = (_props) => {
		const ctx = literal<IContextMenuContext>({
			segment: props.segment,
			part: props.parts.find((p) => isPartPlayable(p.instance.part)) || null,
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

	const indicatorColumns = useMemo(() => {
		const sourceColumns: Record<string, ISourceLayerExtended[]> = {}
		Object.values(props.segment.sourceLayers).forEach((sourceLayer) => {
			if (sourceLayer.isHidden) return
			// TODO: this is kind-of wonky, the selector on what goes into the columns should be better
			if (!COLUMN_SUPPORTED_LAYER_TYPES.has(sourceLayer.type)) return
			if (BANNED_COLUMN_NAMES.has(sourceLayer.name)) return
			let thisSourceColumn = sourceColumns[sourceLayer.name]
			if (!thisSourceColumn) {
				sourceColumns[sourceLayer.name] = []
				thisSourceColumn = sourceColumns[sourceLayer.name]
			}
			thisSourceColumn.push(sourceLayer)
		})
		return sourceColumns
	}, [props.segment.sourceLayers])

	let countdownToPartId: PartId | undefined = undefined
	if (!props.isLiveSegment) {
		const nextPart = props.isNextSegment
			? props.parts.find((p) => p.instance._id === props.playlist.nextPartInstanceId)
			: props.parts[0]

		if (nextPart) {
			countdownToPartId = nextPart.instance.part._id
		}
	}

	const parts: ReactNode[] = []
	// let currentPartIndex: number = -1
	// let nextPartIndex: number = -1

	const playlistHasNextPart = !!props.playlist.nextPartInstanceId

	const renderedParts = props.parts.filter((part) => !(part.instance.part.invalid && part.instance.part.gap))
	const isSinglePartInSegment = renderedParts.length === 1
	renderedParts.forEach((part) => {
		const isLivePart = part.instance._id === props.playlist.currentPartInstanceId
		const isNextPart = part.instance._id === props.playlist.nextPartInstanceId

		// if (isLivePart) currentPartIndex = index
		// if (isNextPart) nextPartIndex = index

		if (part.instance.part.invalid && part.instance.part.gap) return null

		const partComponent = (
			<LinePart
				key={unprotectString(part.instance._id)}
				part={part}
				segment={props.segment}
				isLivePart={isLivePart}
				isNextPart={isNextPart}
				isSinglePartInSegment={isSinglePartInSegment}
				hasAlreadyPlayed={!!part.instance.timings?.stoppedPlayback || !!part.instance.timings?.takeOut}
				displayLiveLineCounter={false}
				inHold={!!(props.playlist.holdState && props.playlist.holdState !== RundownHoldState.COMPLETE)}
				currentPartWillAutonext={isNextPart && props.currentPartWillAutoNext}
				indicatorColumns={indicatorColumns}
				doesPlaylistHaveNextPart={playlistHasNextPart}
			/>
		)

		parts.push(partComponent)
	})

	return (
		<StudioContext.Provider value={props.studio}>
			<div
				id={props.id}
				className={classNames('segment-timeline', 'segment-opl', {
					live: props.isLiveSegment,
					next: !props.isLiveSegment && props.isNextSegment,
					queued: props.isQueuedSegment,

					'has-played': props.hasAlreadyPlayed && !props.isLiveSegment && !props.isNextSegment,

					'invert-flash': highlight,

					'time-of-day-countdowns': useTimeOfDayCountdowns,
				})}
				data-segment-id={props.segment._id}
				ref={combinedRef}
			>
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
						<div className="segment-opl__duration" tabIndex={0}>
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
					</div>
					<h2
						id={`segment-name-${props.segment._id}`}
						className={'segment-opl__title__label' + (props.segment.identifier ? ' identifier' : '')}
						data-identifier={props.segment.identifier}
					>
						{props.segment.name}
					</h2>
					<div className="segment-opl__counters">
						<div
							className={classNames('segment-opl__timeUntil', {
								'segment-opl__timeUntil--time-of-day': useTimeOfDayCountdowns,
							})}
							onClick={onTimeUntilClick}
						>
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
							{props.studio.settings.preserveUnsyncedPlayingSegmentContents && props.segment.orphaned && (
								<span className="segment-timeline__unsynced">{t('Unsynced')}</span>
							)}
						</div>
					</div>
					<ErrorBoundary>
						<SwitchViewModeButton currentMode={SegmentViewMode.List} onSwitchViewMode={props.onSwitchViewMode} />
					</ErrorBoundary>
				</ContextMenuTrigger>
				<div className="segment-opl__part-list">{parts}</div>
			</div>
		</StudioContext.Provider>
	)
})

export const SegmentList = React.memo(SegmentListInner)
