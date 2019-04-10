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
import { getDeveloperMode } from '../../lib/localStorage';

export interface IProps {
	segmentLineItemId: string
	runningOrderId: string
	segmentLineId: string
	studioInstallationId: string

	inPoint: number
	duration: number
	onChange: (inPoint: number, duration: number) => void
}

interface ITrackedProps {
	segmentLineItem: SegmentLineItem | undefined
	mediaObject: MediaObject | undefined
	studioInstallation: StudioInstallation | undefined
	maxDuration: number
}

interface IState {
	inPoint: number
	duration: number
	outPoint: number
	maxDuration: number
}

export const ClipTrimPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const sli = SegmentLineItems.findOne(props.segmentLineItemId)
	const si = StudioInstallations.findOne(props.studioInstallationId)
	return {
		segmentLineItem: sli,
		mediaObject: sli ? MediaObjects.findOne({
			mediaId: (sli.content as VTContent).fileName.toUpperCase()
		}) : undefined,
		studioInstallation: si,
		maxDuration: sli ? (sli.content as VTContent).sourceDuration : 0
	}
})(class ClipTrimPanel extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
	private fps = Settings['frameRate']

	constructor (props: Translated<IProps> & ITrackedProps) {
		super(props)

		this.state = {
			inPoint: this.props.inPoint * this.fps / 1000,
			duration: this.props.duration * this.fps / 1000,
			outPoint: (this.props.inPoint + this.props.duration) * this.fps / 1000,
			maxDuration: this.props.maxDuration * this.fps / 1000
		}
	}

	static getDerivedStateFromProps (props: Translated<IProps> & ITrackedProps, state: IState) {
		return {
			inPoint: props.inPoint * Settings['frameRate'] / 1000,
			duration: props.duration * Settings['frameRate'] / 1000,
			outPoint: (props.inPoint + props.duration) * Settings['frameRate'] / 1000,
			maxDuration: props.maxDuration * Settings['frameRate'] / 1000
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
			const ns = {
				inPoint: val,
				duration: Math.min(this.state.maxDuration - val, Math.max(0, this.state.outPoint - val))
			}
			this.setState(ns)
			this.props.onChange(ns.inPoint / this.fps * 1000, ns.duration / this.fps * 1000)
		} else {
			const inp = Math.max(0, this.state.outPoint - 1)
			const ns = {
				inPoint: inp,
				duration: Math.min(this.state.maxDuration - inp, this.state.outPoint - inp)
			}
			this.setState(ns)
			this.props.onChange(ns.inPoint / this.fps * 1000, ns.duration / this.fps * 1000)
		}
	}

	onDurationChange = (val: number) => {
		if (val > 0) {
			const ns = {
				duration: Math.min(val, this.state.maxDuration),
				outPoint: Math.min(this.state.inPoint + val, this.state.maxDuration)
			}
			this.setState(ns)
			this.props.onChange((ns.outPoint - ns.duration) / this.fps * 1000, ns.duration / this.fps * 1000)
		}
	}

	onOutChange = (val: number) => {
		if (val > this.state.inPoint) {
			const ns = {
				outPoint: Math.min(val, this.state.maxDuration),
				duration: Math.min(this.state.maxDuration - this.state.inPoint, Math.max(0, val - this.state.inPoint))
			}
			this.setState(ns)
			console.log(this.state.maxDuration, ns.duration)
			this.props.onChange((ns.outPoint - ns.duration) / this.fps * 1000, ns.duration / this.fps * 1000)
		} else {
			const out = this.state.inPoint + 1
			const ns = {
				outPoint: Math.min(out, this.state.maxDuration),
				duration: Math.min(this.state.maxDuration - this.state.inPoint, out - this.state.inPoint)
			}
			this.setState(ns)
			this.props.onChange((ns.outPoint - ns.duration) / this.fps * 1000, ns.duration / this.fps * 1000)
		}
	}

	render () {
		const { t } = this.props
		let previewUrl: string | undefined = undefined
		if (this.props.mediaObject && this.props.studioInstallation) {
			const mediaPreviewUrl = this.ensureHasTrailingSlash(this.props.studioInstallation.settings.mediaPreviewsUrl + '' || '') || ''
			previewUrl = mediaPreviewUrl + 'media/preview/' + encodeURIComponent(this.props.mediaObject.mediaId)
		}

		return (
			<div className='clip-trim-panel'>
				{getDeveloperMode() && <div className='clip-trim-panel__monitors'>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} fps={this.fps} currentTime={this.state.inPoint / this.fps} onCurrentTimeChange={(time) => this.onInChange(time * this.fps)} />
					</div>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} fps={this.fps} currentTime={this.state.outPoint / this.fps} onCurrentTimeChange={(time) => this.onOutChange(time * this.fps)} />
					</div>
				</div>}
				<div className='clip-trim-panel__timecode-encoders'>
					<div className='clip-trim-panel__timecode-encoders__input'>
						<label>{t('In')}</label>
						<TimecodeEncoder fps={this.fps} value={this.state.inPoint} onChange={this.onInChange} />
					</div>
					<div className='clip-trim-panel__timecode-encoders__input'>
						<label>{t('Duration')}</label>
						<TimecodeEncoder fps={this.fps} value={this.state.duration} onChange={this.onDurationChange} />
					</div>
					<div className='clip-trim-panel__timecode-encoders__input'>
						<label>{t('Out')}</label>
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
