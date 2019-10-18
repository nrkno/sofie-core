import * as React from 'react'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

import { PieceUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'
import { getElementWidth } from '../../../utils/dimensions'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { MediaObject, Anomaly } from '../../../../lib/collections/MediaObjects'

import Lottie from 'react-lottie'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { VTContent } from 'tv-automation-sofie-blueprints-integration'
interface IProps extends ICustomLayerItemProps {
}
interface IState {
	scenes?: Array<number>
	blacks?: Array<Anomaly>
	freezes?: Array<Anomaly>
}
export class VTSourceRendererBase extends CustomLayerItemRenderer<IProps & InjectedTranslateProps, IState> {
	vPreview: HTMLVideoElement
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement
	begin: string
	end: string

	metadataRev: string | undefined

	constructor (props: IProps & InjectedTranslateProps) {
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
			const piece = this.props.piece
			const itemDuration = ((piece.content ? piece.content.sourceDuration as number : undefined) || piece.playoutDuration || piece.renderedDuration || 0)
			let targetTime = this.props.cursorTimePosition
			let seek = ((piece.content ? piece.content.seek as number : undefined) || 0)
			if (piece.content && piece.content.loop && this.vPreview.duration > 0) {
				targetTime = targetTime % (Math.min(this.vPreview.duration, itemDuration) * 1000)
			} else if (itemDuration === 0 && piece.infiniteMode) {
				// noop
			} else {
				targetTime = Math.min(targetTime, itemDuration)
			}
			targetTime += seek
			this.vPreview.currentTime = targetTime / 1000
		}
	}

	componentDidMount () {
		this.updateAnchoredElsWidths()
		const metadata = this.props.piece.contentMetaData as MediaObject
		if (metadata && metadata._rev) {
			this.metadataRev = metadata._rev // update only if the metadata object changed
		}
		this.setState({
			scenes: this.getScenes(),
			freezes: this.getFreezes(),
			blacks: this.getBlacks()
		})
	}

	updateAnchoredElsWidths = () => {
		const leftLabelWidth = getElementWidth(this.leftLabel)
		const rightLabelWidth = getElementWidth(this.rightLabel)

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<IProps & InjectedTranslateProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}
		this.updateTime()

		if (this.props.piece.name !== prevProps.piece.name) {
			this.updateAnchoredElsWidths()
		}

		const metadata = this.props.piece.contentMetaData as MediaObject
		if (metadata && metadata._rev && metadata._rev !== this.metadataRev) {
			this.metadataRev = metadata._rev // update only if the metadata object changed
			this.setState({
				scenes: this.getScenes(),
				freezes: this.getFreezes(),
				blacks: this.getBlacks()
			})
		} else if (!metadata && this.metadataRev !== undefined) {
			this.metadataRev = undefined
			this.setState({
				scenes: undefined,
				freezes: undefined,
				blacks: undefined
			})
		}
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
				return _.compact(metadata.mediainfo.scenes.map((i) => {
					if (i < itemDuration) {
						return i * 1000
					}
					return undefined
				})) // convert into milliseconds
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
					.map((i): Anomaly => { return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 } })
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
						.map((i): Anomaly => { return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 } })
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
			return <React.Fragment>
				<div className='segment-timeline__mini-inspector__warnings'>{msgBlacks}{msgFreezes && <br />}{msgFreezes}</div>
			</React.Fragment>
		} else {
			return undefined
		}
	}

	render () {
		const { t } = this.props

		let labelItems = this.props.piece.name.split('||')
		this.begin = labelItems[0] || ''
		this.end = labelItems[1] || ''

		const defaultOptions = {
			loop: true,
			autoplay: false,
			animationData: loopAnimation,
			rendererSettings: {
				preserveAspectRatio: 'xMidYMid slice'
			}
		}

		const itemDuration = this.getItemDuration()
		const content = this.props.piece.content as VTContent
		const seek = content && content.seek ? content.seek : 0

		const realCursorTimePosition = this.props.cursorTimePosition + seek

		const vtContent = this.props.piece.content as VTContent

		return <React.Fragment>
			{this.renderInfiniteItemContentEnded()}
			{this.state.scenes &&
				this.state.scenes.map((i) => (i < itemDuration) && (i - seek >= 0) &&
					<span className='segment-timeline__piece__scene-marker' key={i}
						style={{ 'left': ((i - seek) * this.props.timeScale).toString() + 'px' }}></span>)}
			{this.state.freezes &&
				this.state.freezes.map((i) => (i.start < itemDuration) && (i.start - seek >= 0) &&
					<span className='segment-timeline__piece__anomaly-marker' key={i.start}
						style={{ 'left': ((i.start - seek) * this.props.timeScale).toString() + 'px', width: (Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale).toString() + 'px' }}></span>)}
			{this.state.blacks &&
				this.state.blacks.map((i) => (i.start < itemDuration) && (i.start - seek >= 0) &&
					<span className='segment-timeline__piece__anomaly-marker segment-timeline__piece__anomaly-marker__freezes' key={i.start}
						style={{ 'left': ((i.start - seek) * this.props.timeScale).toString() + 'px', width: (Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale).toString() + 'px' }}></span>)}
			<span className='segment-timeline__piece__label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
				<span className={ClassNames('segment-timeline__piece__label', {
					'overflow-label': this.end !== ''
				})}>
					{this.begin}
				</span>
				{(this.begin && this.end === '' && vtContent && vtContent.loop) &&
					(<div className='segment-timeline__piece__label label-icon label-loop-icon'>
						<Lottie options={defaultOptions} width={24} height={24} isStopped={!this.props.showMiniInspector} isPaused={false} />
					</div>)
				}
				{this.renderContentTrimmed()}
			</span>
			<span className='segment-timeline__piece__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
				{(this.end && this.props.piece.content && this.props.piece.content.loop) &&
					(<div className='segment-timeline__piece__label label-icon label-loop-icon'>
						<Lottie options={defaultOptions} width={24} height={24} isStopped={!this.props.showMiniInspector} isPaused={false} />
					</div>)
				}
				{this.renderInfiniteIcon()}
				{this.renderOverflowTimeLabel()}
				<span className='segment-timeline__piece__label last-words'>
					{this.end}
				</span>
			</span>
			<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				{this.getPreviewUrl() ?
					<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={this.getFloatingInspectorStyle()}>
						<video src={this.getPreviewUrl()} ref={this.setVideoRef} crossOrigin='anonymous' playsInline={true} muted={true} />
						<span className='segment-timeline__mini-inspector__timecode'>{RundownUtils.formatDiffToTimecode(realCursorTimePosition, false, false, false, false, true, undefined, true)}</span>
						{this.getInspectorWarnings(realCursorTimePosition)}
					</div> :
					<div className={'segment-timeline__mini-inspector ' + this.props.typeClass} style={this.getFloatingInspectorStyle()}>
						<div>
							<span className='mini-inspector__label'>{t('File name')}</span>
							<span className='mini-inspector__value'>{this.props.piece.content && this.props.piece.content.fileName}</span>
						</div>
					</div>
				}
			</FloatingInspector>
		</React.Fragment>
	}
}

export const VTSourceRenderer = translate()(VTSourceRendererBase)
