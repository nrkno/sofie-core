import React from 'react'
import _ from 'underscore'
import { TFunction } from 'i18next'
import { withTranslation, WithTranslation } from 'react-i18next'

import ClassNames from 'classnames'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { SegmentUi, PartUi, IOutputLayerUi, PieceUi, LIVE_LINE_TIME_PADDING } from '../SegmentTimelineContainer'
import {
	TimingDataResolution,
	TimingTickResolution,
	WithTiming,
	withTiming,
} from '../../RundownView/RundownTiming/withTiming'
import { RundownTiming } from '../../RundownView/RundownTiming/RundownTiming'

import { RundownUtils } from '../../../lib/rundown'
import { getCurrentTime, unprotectString } from '../../../../lib/lib'
import { ensureHasTrailingSlash } from '../../../lib/lib'

import { DEBUG_MODE } from '../SegmentTimelineDebugMode'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'

import { IContextMenuContext } from '../../RundownView'
import { CSSProperties } from '../../../styles/_cssVariables'
import RundownViewEventBus, { RundownViewEvents, HighlightEvent } from '../../RundownView/RundownViewEventBus'
import { LoopingIcon } from '../../../lib/ui/icons/looping'
import { SegmentEnd } from '../../../lib/ui/icons/segment'
import { getShowHiddenSourceLayers } from '../../../lib/localStorage'
import { Part } from '../../../../lib/collections/Parts'
import { RundownTimingContext } from '../../../lib/rundownTiming'
import { OutputGroup } from './OutputGroup'
import { InvalidPartCover } from './InvalidPartCover'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { UIStudio } from '../../../../lib/api/studios'

export const SegmentTimelineLineElementId = 'rundown__segment__line__'
export const SegmentTimelinePartElementId = 'rundown__segment__part__'

/** The width at which a Part is too small to attempt displaying text labels on Pieces, in pixels */
export const BREAKPOINT_TOO_SMALL_FOR_TEXT = 30

/** The width at whcih a Part is too small to be drawn at all, in pixels */
export const BREAKPOINT_TOO_SMALL_FOR_DISPLAY = 6

interface IProps {
	segment: SegmentUi
	playlist: RundownPlaylist
	studio: UIStudio
	part: PartUi
	timeScale: number
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	}
	isCollapsed?: boolean
	scrollLeft: number
	scrollWidth: number
	onScroll?: (scrollLeft: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPartTooSmallChanged?: (part: PartUi, isTooSmallForDisplay: number | false) => void
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	relative: boolean
	totalSegmentDuration?: number
	firstPartInSegment?: PartUi
	lastPartInSegment?: PartUi
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	isLastInSegment: boolean
	isAfterLastValidInSegmentAndItsLive: boolean
	isLastSegment: boolean
	isBudgetGap?: boolean
	isPreview?: boolean
	cropDuration?: number
	className?: string
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
}

interface IState {
	isLive: boolean
	isNext: boolean
	isDurationSettling: boolean
	durationSettlingStartsAt: number
	liveDuration: number

	isInsideViewport: boolean
	isTooSmallForText: boolean
	isTooSmallForDisplay: boolean
	highlight: boolean
}
export class SegmentTimelinePartClass extends React.Component<Translated<WithTiming<IProps>>, IState> {
	constructor(props: Readonly<Translated<WithTiming<IProps>>>) {
		super(props)

		const partInstance = this.props.part.instance

		const isLive = this.props.playlist.currentPartInstanceId === partInstance._id
		const isNext = this.props.playlist.nextPartInstanceId === partInstance._id
		const startedPlayback = partInstance.timings?.plannedStartedPlayback

		this.state = {
			isLive,
			isNext,
			isDurationSettling: false,
			durationSettlingStartsAt: 0,
			isInsideViewport: false,
			isTooSmallForText: false,
			isTooSmallForDisplay: false,
			highlight: false,
			liveDuration: isLive
				? Math.max(
						(startedPlayback &&
							props.timingDurations.partDurations &&
							SegmentTimelinePartClass.getCurrentLiveLinePosition(
								props.part,
								props.timingDurations.currentTime || getCurrentTime()
							) + SegmentTimelinePartClass.getLiveLineTimePadding(props.timeScale)) ||
							0,
						props.timingDurations.partDurations
							? partInstance.part.displayDuration ||
									props.timingDurations.partDurations[unprotectString(partInstance.part._id)]
							: 0
				  )
				: 0,
		}
	}

	static getDerivedStateFromProps(
		nextProps: Readonly<IProps & RundownTiming.InjectedROTimingProps>,
		state: Readonly<IState>
	): Partial<IState> {
		const isPrevious = nextProps.playlist.previousPartInstanceId === nextProps.part.instance._id
		const isLive = nextProps.playlist.currentPartInstanceId === nextProps.part.instance._id
		const isNext = nextProps.playlist.nextPartInstanceId === nextProps.part.instance._id

		const nextPartInner = nextProps.part.instance.part

		const startedPlayback = nextProps.part.instance.timings?.plannedStartedPlayback

		const isDurationSettling =
			!!nextProps.playlist.activationId &&
			isPrevious &&
			!isLive &&
			!!startedPlayback &&
			!nextProps.part.instance.timings?.duration

		let durationSettlingStartsAt = state.durationSettlingStartsAt
		if (!state.isDurationSettling && isDurationSettling) {
			durationSettlingStartsAt = SegmentTimelinePartClass.getCurrentLiveLinePosition(
				nextProps.part,
				nextProps.timingDurations.currentTime || getCurrentTime()
			)
			//console.log('Start Duration Settling in Part : ', nextState.partId)
		}

		let liveDuration = 0
		if (!isDurationSettling) {
			// if the duration isn't settling, calculate the live line postion and add some liveLive time padding
			if (isLive && !nextProps.autoNextPart && !nextPartInner.autoNext) {
				liveDuration = Math.max(
					(startedPlayback &&
						nextProps.timingDurations.partDurations &&
						(nextProps.relative
							? SegmentTimelinePartClass.getCurrentLiveLinePosition(
									nextProps.part,
									nextProps.timingDurations.currentTime || getCurrentTime()
							  )
							: SegmentTimelinePartClass.getCurrentLiveLinePosition(
									nextProps.part,
									nextProps.timingDurations.currentTime || getCurrentTime()
							  ) + SegmentTimelinePartClass.getLiveLineTimePadding(nextProps.timeScale))) ||
						0,
					nextProps.timingDurations.partDurations
						? nextPartInner.displayDuration ||
								nextProps.timingDurations.partDurations[unprotectString(nextPartInner._id)]
						: 0
				)
			}
			durationSettlingStartsAt = 0
		}

		const partDisplayDuration = SegmentTimelinePartClass.getPartDuration(
			nextProps,
			liveDuration,
			isDurationSettling,
			durationSettlingStartsAt
		)

		const isInsideViewport =
			nextProps.relative ||
			isLive ||
			RundownUtils.isInsideViewport(
				nextProps.scrollLeft,
				nextProps.scrollWidth,
				nextProps.part,
				SegmentTimelinePartClass.getPartStartsAt(nextProps),
				partDisplayDuration
			)

		const partDisplayWidth = partDisplayDuration * nextProps.timeScale
		const isTooSmallForText = !isLive && !nextProps.relative && partDisplayWidth < BREAKPOINT_TOO_SMALL_FOR_TEXT
		const isTooSmallForDisplay = !isLive && !nextProps.relative && partDisplayWidth < BREAKPOINT_TOO_SMALL_FOR_DISPLAY

		const partial = {
			isLive,
			isNext,
			isDurationSettling,
			durationSettlingStartsAt,
			liveDuration,
			isInsideViewport,
			isTooSmallForText,
			isTooSmallForDisplay,
		}

		return partial
	}

	static getLiveLineTimePadding(timeScale): number {
		return timeScale === 0 ? 0 : LIVE_LINE_TIME_PADDING / timeScale
	}

	static getCurrentLiveLinePosition(part: Readonly<PartUi>, currentTime: number): number {
		if (part.instance.timings?.plannedStartedPlayback) {
			if (part.instance.timings?.duration) {
				return part.instance.timings.duration
			} else {
				return currentTime - part.instance.timings.plannedStartedPlayback
			}
		} else {
			return 0
		}
	}

	private highlightTimeout: NodeJS.Timer

	private onHighlight = (e: HighlightEvent) => {
		if (e && e.partId === this.props.part.partId && !e.pieceId) {
			this.setState({
				highlight: true,
			})
			clearTimeout(this.highlightTimeout)
			this.highlightTimeout = setTimeout(() => {
				this.setState({
					highlight: false,
				})
			}, 5000)
		}
	}

	componentDidMount() {
		super.componentDidMount && super.componentDidMount()
		RundownViewEventBus.on(RundownViewEvents.HIGHLIGHT, this.onHighlight)
		const tooSmallState = this.state.isTooSmallForDisplay || this.state.isTooSmallForText
		if (tooSmallState) {
			this.props.onPartTooSmallChanged &&
				this.props.onPartTooSmallChanged(
					this.props.part,
					SegmentTimelinePartClass.getPartDuration(
						this.props,
						this.state.liveDuration,
						this.state.isDurationSettling,
						this.state.durationSettlingStartsAt
					)
				)
		}
	}

	componentWillUnmount() {
		super.componentWillUnmount && super.componentWillUnmount()
		RundownViewEventBus.off(RundownViewEvents.HIGHLIGHT, this.onHighlight)
		this.highlightTimeout && clearTimeout(this.highlightTimeout)
	}

	shouldComponentUpdate(nextProps: Readonly<WithTiming<IProps>>, nextState: Readonly<IState>) {
		if (!_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)) {
			return true
		} else {
			return false
		}
	}

	componentDidUpdate(prevProps: Readonly<Translated<WithTiming<IProps>>>, prevState: IState, snapshot?: any) {
		super.componentDidUpdate && super.componentDidUpdate(prevProps, prevState, snapshot)
		const tooSmallState = this.state.isTooSmallForDisplay || this.state.isTooSmallForText
		const prevTooSmallState = prevState.isTooSmallForDisplay || prevState.isTooSmallForText
		if (tooSmallState !== prevTooSmallState) {
			this.props.onPartTooSmallChanged &&
				this.props.onPartTooSmallChanged(
					this.props.part,
					tooSmallState
						? SegmentTimelinePartClass.getPartDuration(
								this.props,
								this.state.liveDuration,
								this.state.isDurationSettling,
								this.state.durationSettlingStartsAt
						  )
						: false
				)
		}
	}

	getLayerStyle(): React.CSSProperties {
		const actualPartDuration = SegmentTimelinePartClass.getPartDuration(
			this.props,
			this.state.liveDuration,
			this.state.isDurationSettling,
			this.state.durationSettlingStartsAt
		)
		const partDuration = this.props.cropDuration
			? Math.min(this.props.cropDuration, actualPartDuration)
			: actualPartDuration
		if (this.props.relative) {
			return {
				width: ((partDuration / (this.props.totalSegmentDuration || 1)) * 100).toString() + '%',
			}
		} else {
			return {
				minWidth: Math.round(partDuration * this.props.timeScale).toString() + 'px',
			}
		}
	}

	getPartStyle(): React.CSSProperties {
		return this.getLayerStyle()
	}

	static getPartExpectedDuration(props: WithTiming<IProps>): number {
		return (
			props.part.instance.timings?.duration ||
			(props.timingDurations.partDisplayDurations &&
				props.timingDurations.partDisplayDurations[unprotectString(props.part.instance.part._id)]) ||
			props.part.renderedDuration ||
			0
		)
	}

	static getPartDuration(
		props: WithTiming<IProps>,
		liveDuration: number,
		isDurationSettling: boolean,
		durationSettlingStartsAt: number
	): number {
		if (isDurationSettling) {
			return durationSettlingStartsAt
		}
		return Math.max(
			!props.isPreview ? liveDuration : 0,
			SegmentTimelinePartClass.getPartDisplayDuration(props.part, props.timingDurations)
		)
	}

	static getPartDisplayDuration(part: PartUi, timingDurations: RundownTimingContext): number {
		return (
			part.instance.timings?.duration ||
			(timingDurations.partDisplayDurations &&
				timingDurations.partDisplayDurations[unprotectString(part.instance.part._id)]) ||
			part.renderedDuration ||
			0
		)
	}

	static getPartStartsAt(props: WithTiming<IProps>): number {
		if (props.isBudgetGap) {
			return Math.max(
				0,
				(props.lastPartInSegment &&
					props.firstPartInSegment &&
					props.timingDurations.partDisplayStartsAt &&
					props.timingDurations.partDisplayDurations &&
					props.timingDurations.partDisplayStartsAt[unprotectString(props.lastPartInSegment.instance.part._id)] -
						props.timingDurations.partDisplayStartsAt[unprotectString(props.firstPartInSegment.instance.part._id)] +
						props.timingDurations.partDisplayDurations[unprotectString(props.lastPartInSegment.instance.part._id)]) ||
					0
			)
		}
		return Math.max(
			0,
			(props.firstPartInSegment &&
				props.timingDurations.partDisplayStartsAt &&
				props.timingDurations.partDisplayStartsAt[unprotectString(props.part.instance.part._id)] -
					props.timingDurations.partDisplayStartsAt[unprotectString(props.firstPartInSegment.instance.part._id)]) ||
				0
		)
	}

	private renderTimelineOutputGroups(part: PartUi) {
		if (this.props.segment.outputLayers !== undefined) {
			const showHiddenSourceLayers = getShowHiddenSourceLayers()

			let indexAccumulator = 0

			return Object.values(this.props.segment.outputLayers)
				.filter((layer) => {
					return layer.used ? true : false
				})
				.sort((a, b) => {
					return a._rank - b._rank
				})
				.map((layer) => {
					// Only render output layers used by the segment
					if (layer.used) {
						const sourceLayers = layer.sourceLayers
							.filter((i) => showHiddenSourceLayers || !i.isHidden)
							.sort((a, b) => a._rank - b._rank)
						const currentIndex = indexAccumulator
						const isCollapsed =
							this.props.collapsedOutputs[layer._id] !== undefined
								? this.props.collapsedOutputs[layer._id] === true
								: layer.isDefaultCollapsed
						const isFlattened = layer.collapsed || false

						indexAccumulator += isFlattened || isCollapsed ? 1 : sourceLayers.length
						return (
							<OutputGroup
								key={layer._id}
								collapsedOutputs={this.props.collapsedOutputs}
								followLiveLine={this.props.followLiveLine}
								liveLineHistorySize={this.props.liveLineHistorySize}
								livePosition={this.props.livePosition}
								onContextMenu={this.props.onContextMenu}
								onFollowLiveLine={this.props.onFollowLiveLine}
								onPieceClick={this.props.onPieceClick}
								onPieceDoubleClick={this.props.onPieceDoubleClick}
								scrollLeft={this.props.scrollLeft}
								scrollWidth={this.props.scrollWidth}
								relative={this.props.relative}
								mediaPreviewUrl={ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || ''}
								layer={layer}
								sourceLayers={sourceLayers}
								segment={this.props.segment}
								part={part}
								playlist={this.props.playlist}
								studio={this.props.studio}
								startsAt={SegmentTimelinePartClass.getPartStartsAt(this.props) || this.props.part.startsAt || 0}
								duration={
									this.props.cropDuration
										? Math.min(
												this.props.cropDuration,
												SegmentTimelinePartClass.getPartDuration(
													this.props,
													this.state.liveDuration,
													this.state.isDurationSettling,
													this.state.durationSettlingStartsAt
												)
										  )
										: SegmentTimelinePartClass.getPartDuration(
												this.props,
												this.state.liveDuration,
												this.state.isDurationSettling,
												this.state.durationSettlingStartsAt
										  )
								}
								expectedDuration={SegmentTimelinePartClass.getPartExpectedDuration(this.props)}
								isLiveLine={this.props.playlist.currentPartInstanceId === part.instance._id}
								isNextLine={this.props.playlist.nextPartInstanceId === part.instance._id}
								isTooSmallForText={this.state.isTooSmallForText}
								timeScale={this.props.timeScale}
								autoNextPart={this.props.autoNextPart}
								liveLinePadding={SegmentTimelinePartClass.getLiveLineTimePadding(this.props.timeScale)}
								indexOffset={currentIndex}
								isPreview={this.props.isPreview || false}
								showDurationSourceLayers={this.props.showDurationSourceLayers}
							/>
						)
					}
				})
		}
	}

	private getFutureShadeStyle = () => {
		return {
			width:
				Math.min(
					Math.max(
						0,
						(this.props.livePosition || 0) +
							SegmentTimelinePartClass.getLiveLineTimePadding(this.props.timeScale) -
							(this.props.part.instance.part.expectedDurationWithPreroll || this.props.part.renderedDuration || 0)
					),
					SegmentTimelinePartClass.getLiveLineTimePadding(this.props.timeScale)
				) *
					this.props.timeScale +
				'px',
		}
	}

	private renderEndOfSegment = (t: TFunction, innerPart: Part, isEndOfShow: boolean, isEndOfLoopingShow?: boolean) => {
		const isNext =
			this.state.isLive &&
			((!this.props.isLastSegment && !this.props.isLastInSegment) || !!this.props.playlist.nextPartInstanceId) &&
			!innerPart.invalid
		return (
			<>
				{this.props.isLastInSegment && !this.props.isBudgetGap && (
					<div
						className={ClassNames('segment-timeline__part__nextline', 'segment-timeline__part__nextline--endline', {
							'auto-next': innerPart.autoNext,
							'is-next': isNext,
							'show-end': isEndOfShow,
						})}
					>
						<div
							className={ClassNames('segment-timeline__part__nextline__label', {
								'segment-timeline__part__nextline__label--thin': innerPart.autoNext && !this.state.isLive,
							})}
						>
							{innerPart.autoNext ? t('Auto') : this.state.isLive ? t('Next') : null}
							{isEndOfLoopingShow && <LoopingIcon />}
						</div>
					</div>
				)}
				{!isEndOfShow && this.props.isLastInSegment && !innerPart.invalid && (
					<div
						className={ClassNames('segment-timeline__part__segment-end', {
							'is-next': isNext,
						})}
					>
						<div className="segment-timeline__part__segment-end__label">
							<SegmentEnd />
						</div>
					</div>
				)}
				{isEndOfShow && (
					<div
						className={ClassNames('segment-timeline__part__show-end', {
							loop: this.props.playlist.loop,
						})}
					>
						<div className="segment-timeline__part__show-end__label">
							{this.props.playlist.loop ? t('Loops to top') : t('Show End')}
						</div>
					</div>
				)}
			</>
		)
	}

	static convertHexToRgb(hexColor: string): { red: number; green: number; blue: number } | undefined {
		if (hexColor.substr(0, 1) !== '#') return
		if (hexColor.length !== 7) return

		const red = parseInt(hexColor.substr(1, 2), 16)
		const green = parseInt(hexColor.substr(3, 2), 16)
		const blue = parseInt(hexColor.substr(5, 2), 16)

		return { red, green, blue }
	}

	render() {
		const { t } = this.props

		const innerPart = this.props.part.instance.part

		const isEndOfShow =
			this.props.isLastSegment &&
			this.props.isLastInSegment &&
			(!this.state.isLive || (this.state.isLive && !this.props.playlist.nextPartInstanceId))
		const isEndOfLoopingShow = this.props.isLastSegment && this.props.isLastInSegment && this.props.playlist.loop
		let invalidReasonColorVars: CSSProperties | undefined = undefined
		if (innerPart.invalidReason && innerPart.invalidReason.color) {
			const invalidColor = SegmentTimelinePartClass.convertHexToRgb(innerPart.invalidReason.color)
			if (invalidColor) {
				invalidReasonColorVars = {
					['--invalid-reason-color-opaque']: `rgba(${invalidColor.red}, ${invalidColor.green}, ${invalidColor.blue}, 1)`,
					['--invalid-reason-color-transparent']: `rgba(${invalidColor.red}, ${invalidColor.green}, ${invalidColor.blue}, 0)`,
				}
			}
		}

		if (
			this.state.isInsideViewport &&
			(!this.state.isTooSmallForDisplay || this.state.isLive || this.state.isNext || this.props.isBudgetGap)
		) {
			return (
				<div
					className={ClassNames(
						'segment-timeline__part',
						{
							live: this.state.isLive,
							next: (this.state.isNext || this.props.isAfterLastValidInSegmentAndItsLive) && !innerPart.invalid,
							invalid: innerPart.invalid && !innerPart.gap,
							floated: innerPart.floated,
							gap: innerPart.gap,
							'invert-flash': this.state.highlight,

							'duration-settling': this.state.isDurationSettling,
							'budget-gap': this.props.isBudgetGap,
						},
						this.props.className
					)}
					data-obj-id={this.props.part.instance._id}
					id={SegmentTimelinePartElementId + this.props.part.instance._id}
					style={{ ...this.getPartStyle(), ...invalidReasonColorVars }}
					role="region"
					aria-roledescription={t('part')}
					aria-label={this.props.part.instance.part.title}
				>
					{DEBUG_MODE && (
						<div className="segment-timeline__debug-info">
							{this.props.livePosition} / {this.props.part.startsAt} /{' '}
							{
								((this.props.timingDurations || { partStartsAt: {} }).partStartsAt || {})[
									unprotectString(innerPart._id)
								]
							}
						</div>
					)}
					{this.renderTimelineOutputGroups(this.props.part)}
					{innerPart.invalid ? (
						<InvalidPartCover className="segment-timeline__part__invalid-cover" part={innerPart} />
					) : null}
					{innerPart.floated ? <div className="segment-timeline__part__floated-cover"></div> : null}

					{this.props.playlist.nextTimeOffset &&
						this.state.isNext && ( // This is the off-set line
							<div
								className={ClassNames('segment-timeline__part__nextline', {
									// This is the base, basic line
									'auto-next':
										!innerPart.invalid &&
										!innerPart.gap &&
										((this.state.isNext && this.props.autoNextPart) ||
											(!this.state.isNext && this.props.part.willProbablyAutoNext)),
									invalid: innerPart.invalid && !innerPart.gap,
									floated: innerPart.floated,
								})}
								style={{
									left: this.props.relative
										? (this.props.playlist.nextTimeOffset /
												(SegmentTimelinePartClass.getPartDuration(
													this.props,
													this.state.liveDuration,
													this.state.isDurationSettling,
													this.state.durationSettlingStartsAt
												) || 1)) *
												100 +
										  '%'
										: Math.round(this.props.playlist.nextTimeOffset * this.props.timeScale) + 'px',
								}}
							>
								<div
									className={ClassNames('segment-timeline__part__nextline__label', {
										'segment-timeline__part__nextline__label--thin':
											(this.props.autoNextPart || this.props.part.willProbablyAutoNext) && !this.state.isNext,
									})}
								>
									{innerPart.invalid && !innerPart.gap ? null : (
										<React.Fragment>
											{this.props.autoNextPart || this.props.part.willProbablyAutoNext
												? t('Auto')
												: this.state.isNext
												? t('Next')
												: null}
										</React.Fragment>
									)}
								</div>
							</div>
						)}
					{this.state.isLive && !this.props.relative && !this.props.autoNextPart && !innerPart.autoNext && (
						<div className="segment-timeline__part__future-shade" style={this.getFutureShadeStyle()}></div>
					)}
					{!this.props.isBudgetGap && (
						<div
							className={ClassNames('segment-timeline__part__nextline', {
								// This is the base, basic line
								'auto-next':
									(this.state.isNext && this.props.autoNextPart) ||
									(!this.state.isNext && this.props.part.willProbablyAutoNext),
								invalid: innerPart.invalid && !innerPart.gap,
								floated: innerPart.floated,
								offset: !!this.props.playlist.nextTimeOffset,
							})}
						>
							<div
								className={ClassNames('segment-timeline__part__nextline__label', {
									'segment-timeline__part__nextline__label--thin':
										(this.props.autoNextPart || this.props.part.willProbablyAutoNext) && !this.state.isNext,
								})}
							>
								{innerPart.invalid && !innerPart.gap ? null : (
									<React.Fragment>
										{(this.state.isNext && this.props.autoNextPart) ||
										(!this.state.isNext && this.props.part.willProbablyAutoNext)
											? t('Auto')
											: this.state.isNext || this.props.isAfterLastValidInSegmentAndItsLive
											? t('Next')
											: null}
									</React.Fragment>
								)}
								{this.props.isAfterLastValidInSegmentAndItsLive && !this.props.playlist.loop && <SegmentEnd />}
								{this.props.isAfterLastValidInSegmentAndItsLive && this.props.playlist.loop && <LoopingIcon />}
							</div>
							{(!this.props.relative || this.props.isPreview) && this.props.part.instance.part.identifier && (
								<div className="segment-timeline__identifier">{this.props.part.instance.part.identifier}</div>
							)}
						</div>
					)}
					{this.renderEndOfSegment(t, innerPart, isEndOfShow, isEndOfLoopingShow)}
				</div>
			)
		} else {
			// render placeholders
			return (
				<div
					className={ClassNames(
						'segment-timeline__part',
						{
							'segment-timeline__part--too-small': this.state.isInsideViewport,
							live: this.state.isLive,
							next: this.state.isNext,
						},
						this.props.className
					)}
					data-obj-id={this.props.part.instance._id}
					style={this.getPartStyle()}
				>
					{/* render it empty, just to take up space */}
					{this.state.isInsideViewport ? this.renderEndOfSegment(t, innerPart, isEndOfShow, isEndOfLoopingShow) : null}
				</div>
			)
		}
	}
}

export const SegmentTimelinePart = withTranslation()(
	withTiming<IProps & WithTranslation, IState>((props: IProps) => {
		return {
			tickResolution: TimingTickResolution.Synced,
			dataResolution: TimingDataResolution.High,
			filter: (durations: RundownTimingContext) => {
				durations = durations || {}

				const partId = unprotectString(props.part.instance.part._id)
				const firstPartInSegmentId = props.firstPartInSegment
					? unprotectString(props.firstPartInSegment.instance.part._id)
					: undefined
				return [
					(durations.partDurations || {})[partId],
					(durations.partDisplayStartsAt || {})[partId],
					(durations.partDisplayDurations || {})[partId],
					firstPartInSegmentId ? (durations.partDisplayStartsAt || {})[firstPartInSegmentId] : undefined,
					firstPartInSegmentId ? (durations.partDisplayDurations || {})[firstPartInSegmentId] : undefined,
				]
			},
		}
	})(SegmentTimelinePartClass)
)
