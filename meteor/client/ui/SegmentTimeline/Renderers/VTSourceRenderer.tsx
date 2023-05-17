import * as React from 'react'
import ReactDOM from 'react-dom'
import * as _ from 'underscore'

import { getElementWidth } from '../../../utils/dimensions'

import ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { MediaObject } from '../../../../lib/collections/MediaObjects'
import { PackageInfo } from '@sofie-automation/blueprints-integration'

import { Lottie } from '@crello/react-lottie'
// @ts-expect-error Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'
import { withTranslation, WithTranslation } from 'react-i18next'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { PieceStatusIcon } from '../../../lib/ui/PieceStatusIcon'
import { NoticeLevel, getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications'
import { VTFloatingInspector } from '../../FloatingInspectors/VTFloatingInspector'
import { ScanInfoForPackage, ScanInfoForPackages } from '../../../../lib/mediaObjects'
import { clone } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { FreezeFrameIcon } from '../../../lib/ui/icons/freezeFrame'
import StudioContext from '../../RundownView/StudioContext'
import { Settings } from '../../../../lib/Settings'
import { UIStudio } from '../../../../lib/api/studios'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { HourglassIconSmall } from '../../../lib/ui/icons/notifications'

interface IProps extends ICustomLayerItemProps {
	studio: UIStudio | undefined
}
interface IState {
	scenes?: Array<number>
	blacks?: Array<PackageInfo.Anomaly>
	freezes?: Array<PackageInfo.Anomaly>

	rightLabelIsAppendage?: boolean
	noticeLevel: NoticeLevel | null
	begin: string
	end: string

	sourceEndCountdownAppendage?: boolean
}
export class VTSourceRendererBase extends CustomLayerItemRenderer<IProps & WithTranslation, IState> {
	private leftLabel: HTMLSpanElement
	private rightLabel: HTMLSpanElement

	private metadataRev: string | undefined
	private cachedContentPackageInfos: ScanInfoForPackages | undefined

	private leftLabelNodes: JSX.Element | null = null
	private rightLabelNodes: JSX.Element | null = null

	private rightLabelContainer: HTMLSpanElement | null = null
	private countdownContainer: HTMLSpanElement | null = null

	private static readonly defaultLottieOptions = {
		loop: true,
		autoplay: false,
		animationData: loopAnimation,
		rendererSettings: {
			preserveAspectRatio: 'xMidYMid slice',
		},
	}

	constructor(props: IProps & WithTranslation) {
		super(props)

		const innerPiece = props.piece.instance.piece

		const labelItems = innerPiece.name.split('||')

		this.state = {
			noticeLevel: getNoticeLevelForPieceStatus(innerPiece.status),
			begin: labelItems[0] || '',
			end: labelItems[1] || '',
		}

		this.rightLabelContainer = document.createElement('span')
		this.countdownContainer = document.createElement('span')
	}

	private setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	private setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	getItemLabelOffsetRight(): React.CSSProperties {
		return {
			...super.getItemLabelOffsetRight(),
			top: this.state.rightLabelIsAppendage
				? `calc(${this.props.layerIndex} * var(--segment-layer-height))`
				: undefined,
		}
	}

	private mountRightLabelContainer(
		props: IProps,
		prevProps: IProps | null,
		newState: Partial<IState>,
		itemElement: HTMLElement | null
	): Partial<IState> {
		if (this.rightLabelContainer && itemElement) {
			const itemDuration = this.getItemDuration(true)
			if (prevProps === null || itemElement !== prevProps.itemElement) {
				if (itemDuration === Number.POSITIVE_INFINITY) {
					itemElement.parentElement?.parentElement?.parentElement?.appendChild(this.rightLabelContainer)

					newState.rightLabelIsAppendage = true
				} else {
					try {
						this.rightLabelContainer?.remove()
					} catch (err) {
						console.error('Error in VTSourceRendererBase.mountRightLabelContainer 1', err)
					}
					itemElement.appendChild(this.rightLabelContainer)
					newState.rightLabelIsAppendage = false
				}
			} else if (prevProps?.partDuration !== props.partDuration) {
				if (itemDuration === Number.POSITIVE_INFINITY && this.state.rightLabelIsAppendage !== true) {
					itemElement.parentElement?.parentElement?.parentElement?.appendChild(this.rightLabelContainer)

					newState.rightLabelIsAppendage = true
				} else if (itemDuration !== Number.POSITIVE_INFINITY && this.state.rightLabelIsAppendage === true) {
					try {
						this.rightLabelContainer?.remove()
					} catch (err) {
						console.error('Error in VTSourceRendererBase.mountRightLabelContainer 2', err)
					}
					itemElement.appendChild(this.rightLabelContainer)
					newState.rightLabelIsAppendage = false
				}
			}
		}

		return newState
	}

	mountSourceEndedCountdownContainer(
		props: IProps,
		newState: Partial<IState>,
		itemElement: HTMLElement | null
	): Partial<IState> {
		const { relative: relativeRendering, isLiveLine, outputLayer } = props
		if (
			this.countdownContainer &&
			!this.state.sourceEndCountdownAppendage &&
			!relativeRendering &&
			isLiveLine &&
			!outputLayer.collapsed &&
			itemElement
		) {
			const liveLine =
				itemElement.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.querySelector(
					'.segment-timeline__liveline'
				)
			if (liveLine) {
				liveLine.appendChild(this.countdownContainer)
				newState.sourceEndCountdownAppendage = true
			}
		} else if (
			this.countdownContainer &&
			this.state.sourceEndCountdownAppendage &&
			!(!relativeRendering && isLiveLine && !outputLayer.collapsed && itemElement)
		) {
			try {
				this.countdownContainer.remove()
			} catch (err) {
				console.error('Error in VTSourceRendererBase.mountSourceEndedCountdownContainer 1', err)
			}
			newState.sourceEndCountdownAppendage = false
		}

		return newState
	}

	componentDidMount(): void {
		if (super.componentDidMount && typeof super.componentDidMount === 'function') {
			super.componentDidMount()
		}

		const { itemElement } = this.props

		let newState: Partial<IState> = {}

		this.updateAnchoredElsWidths()
		if (this.props.piece.contentPackageInfos) {
			this.setState({
				scenes: this.getScenes(),
				freezes: this.getFreezes(),
				blacks: this.getBlacks(),
			})
		} else {
			// Fallback to Media objects:
			const metadata = this.props.piece.contentMetaData as MediaObject
			if (metadata && metadata._rev) {
				this.metadataRev = metadata._rev // update only if the metadata object changed

				this.setState({
					scenes: this.getScenes(),
					freezes: this.getFreezes(),
					blacks: this.getBlacks(),
				})
			}
		}

		newState = this.mountRightLabelContainer(this.props, null, newState, itemElement)
		newState = this.mountSourceEndedCountdownContainer(this.props, newState, itemElement)

		if (Object.keys(newState).length > 0) {
			this.setState(newState as IState)
		}
	}

	private updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate(prevProps: Readonly<IProps & WithTranslation>, prevState: Readonly<IState>): void {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		const { itemElement } = this.props
		const innerPiece = this.props.piece.instance.piece

		if (innerPiece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}

		let newState: Partial<IState> = {}
		if (
			innerPiece.name !== prevProps.piece.instance.piece.name ||
			innerPiece.status !== prevProps.piece.instance.piece.status
		) {
			const labelItems = innerPiece.name.split('||')
			newState.noticeLevel = getNoticeLevelForPieceStatus(innerPiece.status)
			newState.begin = labelItems[0] || ''
			newState.end = labelItems[1] || ''
		}

		if (this.props.piece.contentPackageInfos) {
			if (!_.isEqual(this.cachedContentPackageInfos, this.props.piece.contentPackageInfos)) {
				this.cachedContentPackageInfos = clone(this.props.piece.contentPackageInfos) // update only if the metadata object changed

				newState.scenes = this.getScenes()
				newState.freezes = this.getFreezes()
				newState.blacks = this.getBlacks()
			}
		} else {
			// Fallback to mediaObjects:

			const metadata = this.props.piece.contentMetaData as MediaObject
			if (metadata && metadata._rev && metadata._rev !== this.metadataRev) {
				this.metadataRev = metadata._rev // update only if the metadata object changed
				newState.scenes = this.getScenes()
				newState.freezes = this.getFreezes()
				newState.blacks = this.getBlacks()
			} else if (!metadata && this.metadataRev !== undefined) {
				this.metadataRev = undefined

				newState.scenes = undefined
				newState.freezes = undefined
				newState.blacks = undefined
			}
		}

		newState = this.mountRightLabelContainer(this.props, prevProps, newState, itemElement)
		newState = this.mountSourceEndedCountdownContainer(this.props, newState, itemElement)

		if (Object.keys(newState).length > 0) {
			this.setState(newState as IState, () => {
				if (newState.noticeLevel && newState.noticeLevel !== prevState.noticeLevel) {
					this.updateAnchoredElsWidths()
				}
			})
		}
	}

	componentWillUnmount(): void {
		if (super.componentWillUnmount && typeof super.componentWillUnmount === 'function') {
			super.componentWillUnmount()
		}

		if (this.rightLabelContainer) {
			try {
				this.rightLabelContainer.remove()
			} catch (err) {
				console.error('Error in VTSourceRendererBase.componentWillUnmount 1', err)
			}
			this.rightLabelContainer = null
		}

		if (this.countdownContainer) {
			try {
				this.countdownContainer.remove()
			} catch (err) {
				console.error('Error in VTSourceRendererBase.componentWillUnmount 2', err)
			}
			this.countdownContainer = null
		}
	}

	private getScenes = (): Array<number> | undefined => {
		if (this.props.piece) {
			const piece = this.props.piece
			if (piece.contentPackageInfos) {
				// TODO: support multiple packages:
				const contentPackageInfos = Object.values<ScanInfoForPackage>(piece.contentPackageInfos)
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
	}

	private getFreezes = (): Array<PackageInfo.Anomaly> | undefined => {
		if (this.props.piece) {
			if ((this.props.piece.instance.piece.content as VTContent | undefined)?.ignoreFreezeFrame) {
				return
			}

			const piece = this.props.piece
			if (piece.contentPackageInfos) {
				let items: Array<PackageInfo.Anomaly> = []
				// add freezes
				// TODO: support multiple packages:
				const contentPackageInfos = Object.values<ScanInfoForPackage>(piece.contentPackageInfos)
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
	}

	private getBlacks = (): Array<PackageInfo.Anomaly> | undefined => {
		if (this.props.piece) {
			if ((this.props.piece.instance.piece.content as VTContent | undefined)?.ignoreBlackFrames) {
				return
			}

			const piece = this.props.piece
			if (piece.contentPackageInfos) {
				let items: Array<PackageInfo.Anomaly> = []
				// add blacks
				// TODO: support multiple packages:
				const contentPackageInfos = Object.values<ScanInfoForPackage>(piece.contentPackageInfos)
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
	}

	private renderLeftLabel() {
		const { noticeLevel, begin, end } = this.state

		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined

		const duration = this.renderDuration()

		return !this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
			<span className="segment-timeline__piece__label" ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
				{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
				{this.props.piece.instance.piece.status === PieceStatusCode.SOURCE_NOT_READY && (
					<div className="piece__status-icon type-hourglass">
						<HourglassIconSmall />
					</div>
				)}
				<span
					className={ClassNames('segment-timeline__piece__label', {
						'with-duration': !!duration,
						[`with-duration--${this.getSourceDurationLabelAlignment()}`]: !!duration,
						'overflow-label': end !== '',
					})}
				>
					{duration ? (
						<>
							<span>{begin}</span>
							{duration}
						</>
					) : (
						begin
					)}
				</span>
				{begin && end === '' && vtContent && vtContent.loop && (
					<div className="segment-timeline__piece__label label-icon label-loop-icon">
						<Lottie
							config={VTSourceRendererBase.defaultLottieOptions}
							width="24px"
							height="24px"
							playingState={this.props.showMiniInspector ? 'playing' : 'stopped'}
						/>
					</div>
				)}
				{this.renderContentTrimmed()}
			</span>
		) : null
	}

	private renderRightLabel() {
		const { end } = this.state
		const { isLiveLine, part } = this.props

		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined

		return (
			<span
				className={ClassNames('segment-timeline__piece__label right-side', {
					'segment-timeline__piece-appendage': this.state.rightLabelIsAppendage,
					hidden: this.props.outputGroupCollapsed,
				})}
				ref={this.setRightLabelRef}
				style={this.getItemLabelOffsetRight()}
			>
				{end && vtContent && vtContent.loop && (
					<div className="segment-timeline__piece__label label-icon label-loop-icon">
						<Lottie
							config={VTSourceRendererBase.defaultLottieOptions}
							width="24px"
							height="24px"
							playingState={this.props.showMiniInspector ? 'playing' : 'stopped'}
						/>
					</div>
				)}
				<span className="segment-timeline__piece__label last-words">{end}</span>
				{this.renderInfiniteIcon()}
				{
					(!isLiveLine || part.instance.part.autoNext) &&
						this.renderOverflowTimeLabel() /* do not render the overflow time label if the part is live and will not autonext */
				}
			</span>
		)
	}

	private renderContentEndCountdown() {
		const { piece: uiPiece, part, isLiveLine, livePosition, partStartsAt } = this.props
		const innerPiece = uiPiece.instance.piece

		const vtContent = innerPiece.content as VTContent | undefined
		const seek = vtContent && vtContent.seek ? vtContent.seek : 0
		let countdown: React.ReactNode = null
		const livePositionInPart = (livePosition || 0) - partStartsAt
		if (
			isLiveLine &&
			this.countdownContainer &&
			livePositionInPart >= (uiPiece.renderedInPoint || 0) &&
			livePositionInPart < (uiPiece.renderedInPoint || 0) + (uiPiece.renderedDuration || Number.POSITIVE_INFINITY) &&
			vtContent &&
			vtContent.sourceDuration !== undefined &&
			((part.instance.part.autoNext &&
				(uiPiece.renderedInPoint || 0) + (vtContent.sourceDuration - seek) < (this.props.partDuration || 0)) ||
				(!part.instance.part.autoNext &&
					Math.abs(
						(this.props.piece.renderedInPoint || 0) +
							(vtContent.sourceDuration - seek) -
							(this.props.partExpectedDuration || 0)
					) > 500))
		) {
			let endOfContentAt: number = vtContent.sourceDuration + (vtContent.postrollDuration || 0)

			if (Settings.useCountdownToFreezeFrame) {
				const lastFreeze = this.state.freezes && this.state.freezes[this.state.freezes.length - 1]
				const endingFreezeStart =
					lastFreeze &&
					lastFreeze.start >= vtContent.sourceDuration &&
					lastFreeze.start < vtContent.sourceDuration + (vtContent.postrollDuration || 0) &&
					lastFreeze.start

				// Count down to the ending freeze frame of the content, instead of using the planned end:
				if (endingFreezeStart) endOfContentAt = endingFreezeStart
			}

			const counter = (this.props.piece.renderedInPoint || 0) + endOfContentAt - seek - livePositionInPart

			if (counter > 0) {
				countdown = (
					<div
						className="segment-timeline__liveline__appendage segment-timeline__liveline__appendage--piece-countdown"
						style={{
							top: `calc(${this.props.layerIndex} * var(--segment-layer-height))`,
						}}
					>
						<span className="segment-timeline__liveline__appendage--piece-countdown__content">
							{RundownUtils.formatDiffToTimecode(counter || 0, false, false, true, false, true, '', false, false)}
						</span>
						<FreezeFrameIcon className="segment-timeline__liveline__appendage--piece-countdown__icon" />
					</div>
				)
			}
		}

		return this.countdownContainer && ReactDOM.createPortal(countdown, this.countdownContainer)
	}

	render(): JSX.Element {
		const itemDuration = this.getItemDuration()
		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined
		const seek = vtContent && vtContent.seek ? vtContent.seek : 0

		const realCursorTimePosition = this.props.cursorTimePosition + seek

		if ((!this.props.relative && !this.props.isTooSmallForText) || this.props.isPreview) {
			this.leftLabelNodes = this.renderLeftLabel()
			this.rightLabelNodes = this.renderRightLabel()
		}

		return (
			<React.Fragment>
				{!this.props.part.instance.part.invalid && (
					<>
						{this.renderInfiniteItemContentEnded()}
						{this.renderContentEndCountdown()}
						{this.state.scenes &&
							this.state.scenes.map(
								(i) =>
									i < itemDuration &&
									i - seek >= 0 && (
										<span
											className="segment-timeline__piece__scene-marker"
											key={i}
											style={{ left: Math.round((i - seek) * this.props.timeScale).toString() + 'px' }}
										></span>
									)
							)}
						{this.state.freezes &&
							this.state.freezes.map(
								(i) =>
									i.start < itemDuration &&
									i.start - seek >= 0 && (
										<span
											className="segment-timeline__piece__anomaly-marker"
											key={i.start}
											style={{
												left: Math.round((i.start - seek) * this.props.timeScale).toString() + 'px',
												width:
													Math.round(
														Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale
													).toString() + 'px',
											}}
										></span>
									)
							)}
						{this.state.blacks &&
							this.state.blacks.map(
								(i) =>
									i.start < itemDuration &&
									i.start - seek >= 0 && (
										<span
											className="segment-timeline__piece__anomaly-marker segment-timeline__piece__anomaly-marker__freezes"
											key={i.start}
											style={{
												left: ((i.start - seek) * this.props.timeScale).toString() + 'px',
												width:
													(Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale).toString() +
													'px',
											}}
										></span>
									)
							)}
					</>
				)}
				{this.leftLabelNodes}
				{this.rightLabelContainer && ReactDOM.createPortal(this.rightLabelNodes, this.rightLabelContainer)}
				<VTFloatingInspector
					status={this.props.piece.instance.piece.status}
					floatingInspectorStyle={this.getFloatingInspectorStyle()}
					content={vtContent}
					itemElement={this.props.itemElement}
					noticeLevel={this.state.noticeLevel}
					showMiniInspector={this.props.showMiniInspector}
					timePosition={realCursorTimePosition}
					mediaPreviewUrl={this.props.mediaPreviewUrl}
					typeClass={this.props.typeClass}
					contentMetaData={this.props.piece.contentMetaData}
					noticeMessages={this.props.piece.messages || []}
					renderedDuration={this.props.piece.renderedDuration || undefined}
					contentPackageInfos={this.props.piece.contentPackageInfos}
					pieceId={this.props.piece.instance.piece._id}
					expectedPackages={this.props.piece.instance.piece.expectedPackages}
					studio={this.props.studio}
				/>
			</React.Fragment>
		)
	}
}

export const VTSourceRenderer = withTranslation()(
	// withStudioPackageContainers<IProps & WithTranslation, {}>()(VTSourceRendererBase)
	(props: Omit<IProps, 'studio'> & WithTranslation) => (
		<StudioContext.Consumer>{(studio) => <VTSourceRendererBase {...props} studio={studio} />}</StudioContext.Consumer>
	)
)
