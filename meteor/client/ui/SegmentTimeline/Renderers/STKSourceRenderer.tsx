import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

import { PieceUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { VTSourceRendererBase } from './VTSourceRenderer'
import { MediaObject, Anomaly } from '../../../../lib/collections/MediaObjects'

import { Lottie } from '@crello/react-lottie'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'
import { WithTranslation, withTranslation } from 'react-i18next'
import { LiveSpeakContent, VTContent } from 'tv-automation-sofie-blueprints-integration'

export const STKSourceRenderer = withTranslation()(
	class STKSourceRenderer extends VTSourceRendererBase {
		constructor(props) {
			super(props)
		}

		render() {
			const { t } = this.props

			let labelItems = this.props.piece.instance.piece.name.split('||')
			this.begin = labelItems[0] || ''
			this.end = labelItems[1] || ''

			const itemDuration = this.getItemDuration()
			const content = this.props.piece.instance.piece.content as LiveSpeakContent | undefined
			const seek = content && content.seek ? content.seek : 0

			const defaultOptions = {
				loop: true,
				autoplay: false,
				animationData: loopAnimation,
				rendererSettings: {
					preserveAspectRatio: 'xMidYMid slice',
				},
			}

			const realCursorTimePosition = this.props.cursorTimePosition + seek

			const vtContent = this.props.piece.instance.piece.content as VTContent | undefined

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
												(Math.min(i.duration, itemDuration - i.start + seek) * this.props.timeScale).toString() + 'px',
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
												(Math.min(i.duration, itemDuration - i.start + seek) * this.props.timeScale).toString() + 'px',
										}}></span>
								)
						)}
					<span
						className="segment-timeline__piece__label"
						ref={this.setLeftLabelRef}
						style={this.getItemLabelOffsetLeft()}>
						<span
							className={ClassNames('segment-timeline__piece__label', {
								'overflow-label': this.end !== '',
							})}
							key={this.props.piece.instance._id + '-start'}>
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
					<span
						className="segment-timeline__piece__label right-side"
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
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
						<span className="segment-timeline__piece__label last-words">{this.end}</span>
					</span>
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
								{this.getInspectorWarnings(realCursorTimePosition)}
							</div>
						) : (
							<div
								className={'segment-timeline__mini-inspector ' + this.props.typeClass}
								style={this.getFloatingInspectorStyle()}>
								<div>
									<span className="mini-inspector__label">{t('File Name')}</span>
									<span className="mini-inspector__value">{vtContent && vtContent.fileName}</span>
								</div>
							</div>
						)}
					</FloatingInspector>
				</React.Fragment>
			)
		}
	}
)
