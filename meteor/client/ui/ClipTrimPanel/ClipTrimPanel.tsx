import * as React from 'react'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { SegmentLineItems, SegmentLineItem } from '../../../lib/collections/SegmentLineItems'
import { PubSub } from '../../../lib/api/pubsub'
import { VTContent } from 'tv-automation-sofie-blueprints-integration'
import { VideoEditMonitor } from './VideoEditMonitor'
import { MediaObjects, MediaObject } from '../../../lib/collections/MediaObjects'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { TimecodeEncoder } from './TimecodeEncoder'
import { Settings } from '../../../lib/Settings'

export interface IProps {
	segmentLineItemId: string
	runningOrderId: string
	segmentLineId: string
	studioInstallationId: string

	inPoint: number
	outPoint: number
}

interface ITrackedProps {
	segmentLineItem: SegmentLineItem | undefined
	mediaObject: MediaObject | undefined
	studioInstallation: StudioInstallation | undefined
}

interface IState {
	inPoint: number
	duration: number
	outPoint: number
}

export const ClipTrimPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const sli = SegmentLineItems.findOne(props.segmentLineItemId)
	const si = StudioInstallations.findOne(props.studioInstallationId)
	return {
		segmentLineItem: sli,
		mediaObject: sli ? MediaObjects.findOne({
			mediaId: (sli.content as VTContent).fileName.toUpperCase()
		}) : undefined,
		studioInstallation: si
	}
})(class ClipTrimPanel extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
	private fps = Settings['frameRate']

	constructor (props: Translated<IProps> & ITrackedProps) {
		super(props)

		this.state = {
			inPoint: this.props.inPoint * this.fps,
			duration: (this.props.outPoint * this.fps) - (this.props.inPoint * this.fps),
			outPoint: this.props.outPoint * this.fps
		}
	}

	componentDidMount () {
		this.subscribe(PubSub.segmentLineItems, { _id: this.props.segmentLineItemId })
		this.autorun(() => {
			if (this.props.segmentLineItem && this.props.segmentLineItem.content && this.props.segmentLineItem.content.fileName) {
				const sli = this.props.segmentLineItem
				let objId: string | undefined = undefined
				objId = (sli.content as VTContent).fileName.toUpperCase()

				if (objId) {
					// if (this.mediaObjectSub) this.mediaObjectSub.stop()
					this.subscribe(PubSub.mediaObjects, this.props.studioInstallationId, {
						mediaId: objId
					})
				}
			}
		})
	}

	onInChange = (val: number) => {
		if (val < this.state.outPoint) {
			this.setState({
				inPoint: val,
				duration: Math.max(0, this.state.outPoint - val)
			})
		} else {
			const inp = Math.max(0, this.state.outPoint - 1)
			this.setState({
				inPoint: inp,
				duration: this.state.outPoint - inp
			})
		}
	}

	onDurationChange = (val: number) => {
		if (val > 0) {
			this.setState({
				duration: val,
				outPoint: this.state.inPoint + val
			})
		}
	}

	onOutChange = (val: number) => {
		if (val > this.state.inPoint) {
			this.setState({
				outPoint: val,
				duration: Math.max(0, val - this.state.inPoint)
			})
		} else {
			const out = this.state.inPoint + 1
			this.setState({
				outPoint: out,
				duration: out - this.state.inPoint
			})
		}
	}

	render () {
		let previewUrl: string | undefined = undefined
		if (this.props.mediaObject && this.props.studioInstallation) {
			const mediaPreviewUrl = this.ensureHasTrailingSlash(this.props.studioInstallation.settings.mediaPreviewsUrl + '' || '') || ''
			previewUrl = mediaPreviewUrl + 'media/preview/' + encodeURIComponent(this.props.mediaObject.mediaId)
		}

		return (
			<div className='clip-trim-panel'>
				<div className='clip-trim-panel__monitors'>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} fps={this.fps} currentTime={this.state.inPoint / this.fps} onCurrentTimeChange={(time) => this.onInChange(time * this.fps)} />
					</div>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} fps={this.fps} currentTime={this.state.outPoint / this.fps} onCurrentTimeChange={(time) => this.onOutChange(time * this.fps)} />
					</div>
				</div>
				<div className='clip-trim-panel__timecode-encoders'>
					<div className='clip-trim-panel__timecode-encoders__input'>
						<TimecodeEncoder fps={this.fps} value={this.state.inPoint} onChange={this.onInChange} />
					</div>
					<div className='clip-trim-panel__timecode-encoders__input'>
						<TimecodeEncoder fps={this.fps} value={this.state.duration} onChange={this.onDurationChange} />
					</div>
					<div className='clip-trim-panel__timecode-encoders__input'>
						<TimecodeEncoder fps={this.fps} value={this.state.outPoint} onChange={this.onOutChange} />
					</div>
				</div>
			</div>
		)
	}

	private ensureHasTrailingSlash(input: string | null): string | null {
		if (input) {
			return (input.substr(-1) === '/') ? input : input + '/'
		} else {
			return input
		}
	}
})
