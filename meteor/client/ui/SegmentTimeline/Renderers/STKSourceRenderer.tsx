import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

import { SegmentLineItemUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { MediaObject, Anomaly } from '../../../../lib/collections/MediaObjects'

import Lottie from 'react-lottie'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'
import { InjectedTranslateProps, translate } from 'react-i18next'
import { LiveSpeakContent } from 'tv-automation-sofie-blueprints-integration'
interface IProps extends ICustomLayerItemProps {
}
interface IState {
}
export const STKSourceRenderer = translate()(class extends CustomLayerItemRenderer<IProps & InjectedTranslateProps, IState> {
	vPreview: HTMLVideoElement
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement
	begin: string
	end: string
	scenes?: Array<number>
	freezes?: Array<Anomaly>
	blacks?: Array<Anomaly>

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
			const segmentLineItem = this.props.segmentLineItem as SegmentLineItemUi
			const itemDuration = ((segmentLineItem.content ? segmentLineItem.content.sourceDuration as number : undefined) || segmentLineItem.duration || segmentLineItem.renderedDuration || 0)
			let targetTime = this.props.cursorTimePosition
			let seek = ((segmentLineItem.content ? segmentLineItem.content.seek as number : undefined) || 0)
			if (segmentLineItem.content && segmentLineItem.content.loop && this.vPreview.duration > 0) {
				targetTime = targetTime % (Math.min(this.vPreview.duration, itemDuration) * 1000)
			} else if (itemDuration === 0 && segmentLineItem.infiniteMode) {
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

		this.scenes = this.getScenes()
	}

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0
		let rightLabelWidth = $(this.rightLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<IProps & InjectedTranslateProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}
		this.updateTime()

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}

		this.scenes = this.getScenes()
		this.freezes = this.getFreezes()
		this.blacks = this.getBlacks()
	}

	getPreviewUrl = (): string | undefined => {
		if (this.props.segmentLineItem) {
			const item = this.props.segmentLineItem as SegmentLineItemUi
			const metadata = item.metadata as MediaObject
			if (metadata && metadata.previewPath && this.props.mediaPreviewUrl) {
				return this.props.mediaPreviewUrl + 'media/preview/' + encodeURIComponent(metadata.mediaId)
			}
		}
		return undefined
	}

	getScenes = (): Array<number> | undefined => {
		if (this.props.segmentLineItem) {
			const itemDuration = this.getItemDuration()
			const item = this.props.segmentLineItem as SegmentLineItemUi
			const metadata = item.metadata as MediaObject
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
		if (this.props.segmentLineItem) {
			const itemDuration = this.getItemDuration()
			const item = this.props.segmentLineItem as SegmentLineItemUi
			const metadata = item.metadata as MediaObject
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
		if (this.props.segmentLineItem) {
			const itemDuration = this.getItemDuration()
			const item = this.props.segmentLineItem as SegmentLineItemUi
			const metadata = item.metadata as MediaObject
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
		const item = this.props.segmentLineItem as SegmentLineItemUi
		const metadata = item.metadata as MediaObject
		const timebase = metadata.mediainfo && metadata.mediainfo.timebase ? metadata.mediainfo.timebase : 20
		if (this.blacks) {
			let tot = 0
			for (const b of this.blacks) {
				tot += b.duration
				let s = b.start
				let e = b.end
				if (b.duration < 5000) {
					s = b.start + b.duration * .5 - 2500
					e = b.end - b.duration * .5 + 2500
				}
				if (s < time && e > time) {
					show = true
				}
			}
			// @todo: hardcoded 25fps
			if (tot > 0) msgBlacks = `${Math.round(tot / timebase)} black frame${tot > timebase ? 's' : ''} in clip`
		}
		if (this.freezes) {
			let tot = 0
			for (const b of this.freezes) {
				tot += b.duration
				let s = b.start
				let e = b.end
				if (b.duration < 5000) {
					s = b.start + b.duration * .5 - 2500
					e = b.end - b.duration * .5 + 2500
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

		let labelItems = this.props.segmentLineItem.name.split('||')
		this.begin = labelItems[0] || ''
		this.end = labelItems[1] || ''

		const itemDuration = this.getItemDuration()
		const content = this.props.segmentLineItem.content as LiveSpeakContent
		const seek = content && content.seek ? content.seek : 0

		const defaultOptions = {
			loop: true,
			autoplay: false,
			animationData: loopAnimation,
			rendererSettings: {
				preserveAspectRatio: 'xMidYMid slice'
			}
		}

		const realCursorTimePosition = this.props.cursorTimePosition + seek

		return <React.Fragment>
					{this.renderInfiniteItemContentEnded()}
					{this.scenes &&
						this.scenes.map((i) => (i < itemDuration) && (i - seek >= 0) &&
							<span className='segment-timeline__layer-item__scene-marker' key={i}
								style={{ 'left': ((i - seek) * this.props.timeScale).toString() + 'px' }}></span>)}
					{this.freezes &&
						this.freezes.map((i) => (i.start < itemDuration) && (i.start - seek >= 0) &&
							<span className='segment-timeline__layer-item__anomaly-marker' key={i.start}
								style={{ 'left': ((i.start - seek) * this.props.timeScale).toString() + 'px', width: ((i.duration) * this.props.timeScale).toString() + 'px' }}></span>)}
					{this.blacks &&
						this.blacks.map((i) => (i.start < itemDuration) && (i.start - seek >= 0) &&
							<span className='segment-timeline__layer-item__anomaly-marker segment-timeline__layer-item__anomaly-marker__freezes' key={i.start}
								style={{ 'left': ((i.start - seek) * this.props.timeScale).toString() + 'px', width: ((i.duration) * this.props.timeScale).toString() + 'px' }}></span>)}
					<span className='segment-timeline__layer-item__label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
						<span className={ClassNames('segment-timeline__layer-item__label', {
							'overflow-label': this.end !== ''
						})} key={this.props.segmentLineItem._id + '-start'}>
							{this.begin}
						</span>
						{(this.begin && this.end === '' && this.props.segmentLineItem.content && this.props.segmentLineItem.content.loop) &&
							(<div className='segment-timeline__layer-item__label label-icon'>
								<Lottie options={defaultOptions} width={24} height={16} isStopped={!this.props.showMiniInspector} isPaused={false} />
							</div>)
						}
					</span>
					<span className='segment-timeline__layer-item__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
						{(this.end && this.props.segmentLineItem.content && this.props.segmentLineItem.content.loop) &&
							(<div className='segment-timeline__layer-item__label label-icon'>
								<Lottie options={defaultOptions} width={24} height={16} isStopped={!this.props.showMiniInspector} isPaused={false} />
							</div>)
						}
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
						<span className='segment-timeline__layer-item__label last-words'>
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
									<span className='mini-inspector__label'>{t('File Name')}</span>
									<span className='mini-inspector__value'>{this.props.segmentLineItem.content && this.props.segmentLineItem.content.fileName}</span>
								</div>
							</div>
						}
					</FloatingInspector>
				</React.Fragment>
	}
})
