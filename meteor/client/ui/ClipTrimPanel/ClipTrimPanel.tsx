import * as React from 'react'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Pieces, Piece } from '../../../lib/collections/Pieces'
import { PubSub } from '../../../lib/api/pubsub'
import { VTContent } from 'tv-automation-sofie-blueprints-integration'
import { VideoEditMonitor } from './VideoEditMonitor'
import { MediaObjects, MediaObject } from '../../../lib/collections/MediaObjects'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { TimecodeEncoder } from './TimecodeEncoder'
import { Settings } from '../../../lib/Settings'

export interface IProps {
	pieceId: string
	rundownId: string
	partId: string
	studioId: string

	inPoint: number
	duration: number
	onChange: (inPoint: number, duration: number) => void
}

interface ITrackedProps {
	piece: Piece | undefined
	mediaObject: MediaObject | undefined
	studio: Studio | undefined
	maxDuration: number
}

interface IState {
	inPoint: number
	duration: number
	outPoint: number
	maxDuration: number
}

export const ClipTrimPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const piece = Pieces.findOne(props.pieceId)
	const studio = Studios.findOne(props.studioId)
	return {
		piece: piece,
		mediaObject: piece ? MediaObjects.findOne({
			mediaId: (piece.content as VTContent).fileName.toUpperCase()
		}) : undefined,
		studio: studio,
		maxDuration: piece ? (piece.content as VTContent).sourceDuration : 0
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
		this.subscribe(PubSub.pieces, { _id: this.props.pieceId })
		this.autorun(() => {
			if (this.props.piece && this.props.piece.content && this.props.piece.content.fileName) {
				const piece = this.props.piece
				let objId: string | undefined = undefined
				objId = (piece.content as VTContent).fileName.toUpperCase()

				if (objId) {
					// if (this.mediaObjectSub) this.mediaObjectSub.stop()
					this.subscribe(PubSub.mediaObjects, this.props.studioId, {
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
		if (this.props.mediaObject && this.props.studio) {
			const mediaPreviewUrl = this.ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || ''
			previewUrl = mediaPreviewUrl + 'media/preview/' + encodeURIComponent(this.props.mediaObject.mediaId)
		}

		return (
			<div className='clip-trim-panel'>
				<div className='clip-trim-panel__monitors'>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} fps={this.fps} currentTime={this.state.inPoint / this.fps} duration={this.props.maxDuration / 1000} onCurrentTimeChange={(time) => this.onInChange(time * this.fps)} />
					</div>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} fps={this.fps} currentTime={this.state.outPoint / this.fps} duration={this.props.maxDuration / 1000} onCurrentTimeChange={(time) => this.onOutChange(time * this.fps)} />
					</div>
				</div>
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

	private ensureHasTrailingSlash (input: string | null): string | null {
		if (input) {
			return (input.substr(-1) === '/') ? input : input + '/'
		} else {
			return input
		}
	}
})
