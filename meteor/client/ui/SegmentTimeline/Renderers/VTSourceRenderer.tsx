import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

import { SegmentLineItemUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'
import { MediaObject } from '../../../../lib/collections/MediaObjects'

import Lottie from 'react-lottie'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'

export class VTSourceRenderer extends CustomLayerItemRenderer {
	vPreview: HTMLVideoElement
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement
	begin: string
	end: string
	scenes?: Array<number>

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
			let targetTime = this.props.cursorTimePostion
			const segmentLineItem = this.props.segmentLineItem as SegmentLineItemUi
			const itemDuration = ((segmentLineItem.content ? segmentLineItem.content.sourceDuration as number : undefined) || segmentLineItem.duration || segmentLineItem.renderedDuration || 0)
			if (segmentLineItem.content && segmentLineItem.content.loop && this.vPreview.duration > 0) {
				targetTime = targetTime % (this.vPreview.duration * 1000)
			} else {
				targetTime = Math.min(targetTime, itemDuration)
			}
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

	componentDidUpdate (prevProps: Readonly<ISourceLayerItemProps>, prevState: Readonly<any>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}
		this.updateTime()

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}

		this.scenes = this.getScenes()
	}

	getPreviewUrl = (): string | undefined => {
		if (this.props.segmentLineItem) {
			const item = this.props.segmentLineItem as SegmentLineItemUi
			const metadata = item.metadata as MediaObject
			if (metadata && metadata.previewPath && this.props.mediaPreviewUrl) {
				// TODO: Remove _preview from the path in MediaObjects
				return this.props.mediaPreviewUrl + 'media/preview/' + encodeURIComponent(metadata.objId)
			}
		}
		return undefined // TODO: should be undefined, but is a placeholder for time being
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

	render () {
		const {t} = this.props

		let labelItems = this.props.segmentLineItem.name.split('||')
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

		return <React.Fragment>
					<span className='segment-timeline__layer-item__label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
						<span className={ClassNames('segment-timeline__layer-item__label', {
							'overflow-label': this.end !== ''
						})}>
							{this.begin}
						</span>
						{(this.begin && this.end === '' && (this.props.segmentLineItem as SegmentLineItemUi).content && (this.props.segmentLineItem as SegmentLineItemUi).content!.loop) &&
							(<div className='segment-timeline__layer-item__label label-icon'>
								<Lottie options={defaultOptions} width={24} height={16} isStopped={!this.props.showMiniInspector} isPaused={false} />
							</div>)
						}
					</span>
					<span className='segment-timeline__layer-item__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
						{(this.end && (this.props.segmentLineItem as SegmentLineItemUi).content && (this.props.segmentLineItem as SegmentLineItemUi).content!.loop) &&
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
					{this.scenes && this.scenes.map((i) => i < itemDuration && <span className='segment-timeline__layer-item__scene-marker' key={i} style={{ 'left': (i * this.props.timeScale).toString() + 'px' }}></span>)}
					<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
						{this.getPreviewUrl() ?
							<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={this.getFloatingInspectorStyle()}>
								<video src={this.getPreviewUrl()} ref={this.setVideoRef} crossOrigin='anonymous' playsInline={true} muted={true}/>
								<span className='segment-timeline__mini-inspector__timecode'>{RundownUtils.formatDiffToTimecode(this.props.cursorTimePostion, false, false, false, false, true, undefined, true)}</span>
							</div> :
							<div className={'segment-timeline__mini-inspector ' + this.props.typeClass} style={this.getFloatingInspectorStyle()}>
								<div>
									<span className='mini-inspector__label'>{t('File name')}</span>
									<span className='mini-inspector__value'>{this.props.segmentLineItem.content.fileName}</span>
								</div>
							</div>
						}
					</FloatingInspector>
				</React.Fragment>
	}
}
