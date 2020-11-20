import * as React from 'react'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

import { FloatingInspector } from '../../FloatingInspector'
import { getElementWidth } from '../../../utils/dimensions'

import ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { MediaObject, Anomaly } from '../../../../lib/collections/MediaObjects'

import { Lottie } from '@crello/react-lottie'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'
import { withTranslation, WithTranslation } from 'react-i18next'
import { VTContent, PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { PieceStatusIcon } from '../PieceStatusIcon'
import { NoticeLevel, getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications'
import { CriticalIconSmall, WarningIconSmall } from '../../../lib/notificationIcons'

interface IProps extends ICustomLayerItemProps {}
interface IState {
	scenes?: Array<number>
	blacks?: Array<Anomaly>
	freezes?: Array<Anomaly>

	rightLabelIsAppendage?: boolean
}
export class VTSourceRendererBase extends CustomLayerItemRenderer<IProps & WithTranslation, IState> {
	vPreview: HTMLVideoElement
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement
	itemElement: HTMLDivElement | null
	begin: string
	end: string

	metadataRev: string | undefined

	constructor(props: IProps & WithTranslation) {
		super(props)

		this.state = {}
	}

	setVideoRef = (e: HTMLVideoElement) => {
		this.vPreview = e
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	updateTime = () => {
		if (this.vPreview) {
			const innerPiece = this.props.piece.instance.piece
			const vtContent = innerPiece.content as VTContent | undefined

			const itemDuration = (vtContent ? vtContent.sourceDuration : undefined) || this.props.piece.renderedDuration || 0
			let targetTime = this.props.cursorTimePosition
			let seek = (vtContent ? vtContent.seek : undefined) || 0
			if (vtContent && vtContent.loop && this.vPreview.duration > 0) {
				targetTime =
					targetTime %
					((itemDuration > 0 ? Math.min(this.vPreview.duration, itemDuration) : this.vPreview.duration) * 1000)
			} else if (itemDuration === 0 && innerPiece.lifespan !== PieceLifespan.WithinPart) {
				// noop
			} else {
				targetTime = Math.min(targetTime, itemDuration)
			}
			targetTime += seek
			this.vPreview.currentTime = targetTime / 1000
		}
	}

	getItemLabelOffsetRight(): React.CSSProperties {
		return {
			...super.getItemLabelOffsetRight(),
			top: this.state.rightLabelIsAppendage
				? `calc(${this.props.layerIndex} * var(--segment-layer-height))`
				: undefined,
		}
	}

	componentDidMount() {
		if (super.componentDidMount && typeof super.componentDidMount === 'function') {
			super.componentDidMount()
		}

		this.updateAnchoredElsWidths()
		const metadata = this.props.piece.contentMetaData as MediaObject
		if (metadata && metadata._rev) {
			this.metadataRev = metadata._rev // update only if the metadata object changed
		}
		this.setState({
			scenes: this.getScenes(),
			freezes: this.getFreezes(),
			blacks: this.getBlacks(),
		})
	}

	updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate(prevProps: Readonly<IProps & WithTranslation>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}
		this.updateTime()

		if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}

		const metadata = this.props.piece.contentMetaData as MediaObject
		if (metadata && metadata._rev && metadata._rev !== this.metadataRev) {
			this.metadataRev = metadata._rev // update only if the metadata object changed
			this.setState({
				scenes: this.getScenes(),
				freezes: this.getFreezes(),
				blacks: this.getBlacks(),
			})
		} else if (!metadata && this.metadataRev !== undefined) {
			this.metadataRev = undefined
			this.setState({
				scenes: undefined,
				freezes: undefined,
				blacks: undefined,
			})
		}

		if (this.rightLabel) {
			const itemDuration = this.getItemDuration(true)
			if (this.itemElement !== this.props.itemElement) {
				if (itemDuration === Number.POSITIVE_INFINITY) {
					this.moveLabelOutsidePiece(this.props.itemElement, this.rightLabel)
				} else {
					this.moveLabelInsidePiece(this.props.itemElement, this.rightLabel)
				}
			} else if (prevProps.partDuration !== this.props.partDuration) {
				if (itemDuration === Number.POSITIVE_INFINITY) {
					this.moveLabelOutsidePiece(this.props.itemElement, this.rightLabel)
				} else {
					this.moveLabelInsidePiece(this.props.itemElement, this.rightLabel)
				}
			}
		}
	}

	private moveLabelOutsidePiece(newPieceEl: HTMLDivElement | null, labelEl: HTMLSpanElement) {
		if (labelEl.parentNode !== this.itemElement?.parentNode?.parentNode?.parentNode) {
			if (this.itemElement) {
				labelEl.remove()
			}
			this.itemElement = newPieceEl
			if (this.itemElement) {
				this.itemElement.parentNode &&
					this.itemElement.parentNode.parentNode &&
					this.itemElement.parentNode.parentNode.parentNode &&
					this.itemElement.parentNode.parentNode.parentNode.appendChild(labelEl)
				this.setState({
					rightLabelIsAppendage: true,
				})
			}
		}
	}

	private moveLabelInsidePiece(newPieceEl: HTMLDivElement | null, labelEl: HTMLSpanElement) {
		if (labelEl.parentNode !== this.itemElement) {
			if (this.itemElement) {
				labelEl.remove()
			}
			this.itemElement = newPieceEl
			if (this.itemElement) {
				this.itemElement.appendChild(labelEl)
				this.setState({
					rightLabelIsAppendage: false,
				})
			}
		}
	}

	componentWillUnmount() {
		if (super.componentWillUnmount && typeof super.componentWillUnmount === 'function') {
			super.componentWillUnmount()
		}

		this.rightLabel && this.rightLabel.remove()
		// put the element back where it's supposed to be, so that React can unmount it safely
		this.itemElement?.appendChild(this.rightLabel)
	}

	getPreviewUrl = (): string | undefined => {
		if (this.props.piece) {
			const item = this.props.piece
			const metadata = item.contentMetaData as MediaObject
			if (metadata && metadata.previewPath && this.props.mediaPreviewUrl) {
				return this.props.mediaPreviewUrl + 'media/preview/' + encodeURIComponent(metadata.mediaId)
			}
		}
		return undefined
	}

	getScenes = (): Array<number> | undefined => {
		if (this.props.piece) {
			const itemDuration = this.getItemDuration()
			const item = this.props.piece
			const metadata = item.contentMetaData as MediaObject
			if (metadata && metadata.mediainfo && metadata.mediainfo.scenes) {
				return _.compact(
					metadata.mediainfo.scenes.map((i) => {
						if (i < itemDuration) {
							return i * 1000
						}
						return undefined
					})
				) // convert into milliseconds
			}
		}
	}

	getFreezes = (): Array<Anomaly> | undefined => {
		if (this.props.piece) {
			const itemDuration = this.getItemDuration()
			const item = this.props.piece
			const metadata = item.contentMetaData as MediaObject
			let items: Array<Anomaly> = []
			// add freezes
			if (metadata && metadata.mediainfo && metadata.mediainfo.freezes) {
				items = metadata.mediainfo.freezes
					.filter((i) => i.start < itemDuration)
					.map(
						(i): Anomaly => {
							return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
						}
					)
			}
			return items
		}
	}

	getBlacks = (): Array<Anomaly> | undefined => {
		if (this.props.piece) {
			const itemDuration = this.getItemDuration()
			const item = this.props.piece
			const metadata = item.contentMetaData as MediaObject
			let items: Array<Anomaly> = []
			// add blacks
			if (metadata && metadata.mediainfo && metadata.mediainfo.blacks) {
				items = [
					...items,
					...metadata.mediainfo.blacks
						.filter((i) => i.start < itemDuration)
						.map(
							(i): Anomaly => {
								return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
							}
						),
				]
			}
			return items
		}
	}

	getInspectorWarnings = (time: number): JSX.Element | undefined => {
		let show = false
		let msgBlacks = ''
		let msgFreezes = ''
		const item = this.props.piece
		const metadata = item.contentMetaData as MediaObject
		const timebase = metadata.mediainfo && metadata.mediainfo.timebase ? metadata.mediainfo.timebase : 20
		if (this.state.blacks) {
			let tot = 0
			for (const b of this.state.blacks) {
				tot += b.duration
				let s = b.start
				let e = b.end
				if (b.duration < 5000) {
					s = b.start + b.duration * 0.5 - 2500
					e = b.end - b.duration * 0.5 + 2500
				}
				if (s < time && e > time) {
					show = true
				}
			}
			// @todo: hardcoded 25fps
			if (tot > 0) msgBlacks = `${Math.round(tot / timebase)} black frame${tot > timebase ? 's' : ''} in clip`
		}
		if (this.state.freezes) {
			let tot = 0
			for (const b of this.state.freezes) {
				tot += b.duration
				let s = b.start
				let e = b.end
				if (b.duration < 5000) {
					s = b.start + b.duration * 0.5 - 2500
					e = b.end - b.duration * 0.5 + 2500
				}
				if (s < time && e > time) {
					show = true
				}
			}
			// @todo: hardcoded 25fps
			if (tot > 0) msgFreezes += `${Math.round(tot / timebase)} freeze\n frame${tot > timebase ? 's' : ''} in clip`
		}
		if (show) {
			return (
				<React.Fragment>
					<div className="segment-timeline__mini-inspector__warnings">
						{msgBlacks}
						{msgFreezes && <br />}
						{msgFreezes}
					</div>
				</React.Fragment>
			)
		} else {
			return undefined
		}
	}

	renderNotice(noticeLevel: NoticeLevel) {
		return (
			<>
				<div className="segment-timeline__mini-inspector__notice-header">
					{noticeLevel === NoticeLevel.CRITICAL ? (
						<CriticalIconSmall />
					) : noticeLevel === NoticeLevel.WARNING ? (
						<WarningIconSmall />
					) : null}
				</div>
				<div className="segment-timeline__mini-inspector__notice">{this.props.piece.message}</div>
			</>
		)
	}

	render() {
		const { t } = this.props

		const innerPiece = this.props.piece.instance.piece

		let labelItems = innerPiece.name.split('||')
		this.begin = labelItems[0] || ''
		this.end = labelItems[1] || ''

		const defaultOptions = {
			loop: true,
			autoplay: false,
			animationData: loopAnimation,
			rendererSettings: {
				preserveAspectRatio: 'xMidYMid slice',
			},
		}

		const itemDuration = this.getItemDuration()
		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined
		const seek = vtContent && vtContent.seek ? vtContent.seek : 0

		const realCursorTimePosition = this.props.cursorTimePosition + seek

		const noticeLevel = getNoticeLevelForPieceStatus(innerPiece.status)

		return (
			<React.Fragment>
				{this.renderInfiniteItemContentEnded()}
				{this.state.scenes &&
					this.state.scenes.map(
						(i) =>
							i < itemDuration &&
							i - seek >= 0 && (
								<span
									className="segment-timeline__piece__scene-marker"
									key={i}
									style={{ left: ((i - seek) * this.props.timeScale).toString() + 'px' }}></span>
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
										left: ((i.start - seek) * this.props.timeScale).toString() + 'px',
										width:
											(Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale).toString() + 'px',
									}}></span>
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
											(Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale).toString() + 'px',
									}}></span>
							)
					)}
				{!this.props.relative && (
					<span
						className="segment-timeline__piece__label"
						ref={this.setLeftLabelRef}
						style={this.getItemLabelOffsetLeft()}>
						{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
						<span
							className={ClassNames('segment-timeline__piece__label', {
								'overflow-label': this.end !== '',
							})}>
							{this.begin}
						</span>
						{this.begin && this.end === '' && vtContent && vtContent.loop && (
							<div className="segment-timeline__piece__label label-icon label-loop-icon">
								<Lottie
									config={defaultOptions}
									width="24px"
									height="24px"
									playingState={this.props.showMiniInspector ? 'playing' : 'stopped'}
								/>
							</div>
						)}
						{this.renderContentTrimmed()}
					</span>
				)}
				{!this.props.relative && (
					<span
						className={ClassNames('segment-timeline__piece__label right-side', {
							'segment-timeline__piece-appendage': this.state.rightLabelIsAppendage,
							hidden: this.props.outputGroupCollapsed,
						})}
						ref={this.setRightLabelRef}
						style={this.getItemLabelOffsetRight()}>
						{this.end && vtContent && vtContent.loop && (
							<div className="segment-timeline__piece__label label-icon label-loop-icon">
								<Lottie
									config={defaultOptions}
									width="24px"
									height="24px"
									playingState={this.props.showMiniInspector ? 'playing' : 'stopped'}
								/>
							</div>
						)}
						<span className="segment-timeline__piece__label last-words">{this.end}</span>
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
					</span>
				)}
				<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
					{this.getPreviewUrl() ? (
						<div
							className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
							style={this.getFloatingInspectorStyle()}>
							<video
								src={this.getPreviewUrl()}
								ref={this.setVideoRef}
								crossOrigin="anonymous"
								playsInline={true}
								muted={true}
							/>
							<span className="segment-timeline__mini-inspector__timecode">
								{RundownUtils.formatDiffToTimecode(
									realCursorTimePosition,
									false,
									false,
									false,
									false,
									true,
									undefined,
									true
								)}
							</span>
							{noticeLevel !== null ? (
								<div
									className={
										'segment-timeline__mini-inspector segment-timeline__mini-inspector--sub-inspector ' +
										this.props.typeClass +
										' ' +
										(noticeLevel === NoticeLevel.CRITICAL
											? 'segment-timeline__mini-inspector--notice notice-critical'
											: noticeLevel === NoticeLevel.WARNING
											? 'segment-timeline__mini-inspector--notice notice-warning'
											: '')
									}>
									{this.renderNotice(noticeLevel)}
								</div>
							) : null}
						</div>
					) : (
						<div
							className={
								'segment-timeline__mini-inspector ' +
								this.props.typeClass +
								' ' +
								(noticeLevel === NoticeLevel.CRITICAL
									? 'segment-timeline__mini-inspector--notice notice-critical'
									: noticeLevel === NoticeLevel.WARNING
									? 'segment-timeline__mini-inspector--notice notice-warning'
									: '')
							}
							style={this.getFloatingInspectorStyle()}>
							{noticeLevel !== null ? this.renderNotice(noticeLevel) : null}
							<div className="segment-timeline__mini-inspector__properties">
								<span className="mini-inspector__label">{t('File name')}</span>
								<span className="mini-inspector__value">{vtContent && vtContent.fileName}</span>
							</div>
						</div>
					)}
				</FloatingInspector>
			</React.Fragment>
		)
	}
}

export const VTSourceRenderer = withTranslation()(VTSourceRendererBase)
