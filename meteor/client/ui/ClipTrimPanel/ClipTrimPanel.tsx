import * as React from 'react'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Piece } from '../../../lib/collections/Pieces'
import { PubSub } from '../../../lib/api/pubsub'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { VideoEditMonitor } from './VideoEditMonitor'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { TimecodeEncoder } from './TimecodeEncoder'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Tooltip from 'rc-tooltip'
import { UIStudios } from '../Collections'
import { UIStudio } from '../../../lib/api/studios'
import { PartId, PieceId, RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaObjects, Pieces } from '../../collections'

export interface IProps {
	pieceId: PieceId
	playlistId: RundownPlaylistId
	rundownId: RundownId
	partId: PartId
	studioId: StudioId

	inPoint: number
	duration: number
	originalInPoint?: number
	originalDuration?: number
	onChange: (inPoint: number, duration: number) => void

	invalidDuration?: boolean
	minDuration?: number
}

interface ITrackedProps {
	piece: Piece | undefined
	mediaObject: MediaObject | undefined
	studio: UIStudio | undefined
	maxDuration: number
	frameRate: number
}

interface IState {
	inPoint: number
	duration: number
	outPoint: number
	maxDuration: number
	minDuration: number
}

type StateChange = Partial<IState>

export const ClipTrimPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const piece = Pieces.findOne(props.pieceId)
	const studio = UIStudios.findOne(props.studioId)
	const content = piece?.content as VTContent | undefined
	return {
		piece: piece,
		mediaObject: content?.fileName
			? MediaObjects.findOne({
					mediaId: content.fileName.toUpperCase(),
			  })
			: undefined,
		studio: studio,
		maxDuration: content?.sourceDuration || 0,
		frameRate: studio?.settings?.frameRate ?? 25,
	}
})(
	class ClipTrimPanel extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
		constructor(props: Translated<IProps> & ITrackedProps) {
			super(props)

			this.state = {
				inPoint: (this.props.inPoint * this.props.frameRate) / 1000,
				duration: (this.props.duration * this.props.frameRate) / 1000,
				outPoint: ((this.props.inPoint + this.props.duration) * this.props.frameRate) / 1000,
				maxDuration: (this.props.maxDuration * this.props.frameRate) / 1000,
				minDuration:
					((this.props.minDuration === undefined ? 1000 : this.props.minDuration) * this.props.frameRate) / 1000,
			}
		}

		static getDerivedStateFromProps(props: Translated<IProps> & ITrackedProps, _prevState: IState) {
			return {
				inPoint: (props.inPoint * props.frameRate) / 1000,
				duration: (props.duration * props.frameRate) / 1000,
				outPoint: ((props.inPoint + props.duration) * props.frameRate) / 1000,
				maxDuration: (props.maxDuration * props.frameRate) / 1000,
			}
		}

		componentDidMount(): void {
			this.subscribe(PubSub.pieces, { _id: this.props.pieceId, startRundownId: this.props.rundownId })
			this.autorun(() => {
				const content = this.props.piece?.content as VTContent | undefined
				const objId = content?.fileName?.toUpperCase()

				if (objId) {
					// if (this.mediaObjectSub) this.mediaObjectSub.stop()
					this.subscribe(PubSub.mediaObjects, this.props.studioId, {
						mediaId: objId,
					})
				}
			})
		}

		private checkInOutPoints<T extends StateChange>(change: T): T {
			if (change.inPoint !== undefined && change.duration !== undefined) {
				if (change.duration < this.state.minDuration) {
					if (change.inPoint + this.state.minDuration > this.state.maxDuration) {
						return {
							duration: this.state.minDuration,
							inPoint: this.state.maxDuration - this.state.minDuration,
						} as T
					} else {
						return {
							duration: this.state.minDuration,
							inPoint: change.inPoint,
						} as T
					}
				}
				return change
			} else if (change.duration !== undefined && change.outPoint !== undefined) {
				if (change.duration < this.state.minDuration) {
					if (change.outPoint - this.state.minDuration < 0) {
						return {
							duration: this.state.minDuration,
							outPoint: this.state.minDuration,
						} as T
					} else {
						return {
							duration: this.state.minDuration,
						} as T
					}
				}
				return change
			} else {
				return change
			}
		}

		onInChange = (val: number) => {
			if (val < this.state.outPoint) {
				const ns = this.checkInOutPoints({
					inPoint: val,
					duration: Math.min(this.state.maxDuration - val, Math.max(0, this.state.outPoint - val)),
				})
				this.setState(ns)
				this.props.onChange((ns.inPoint / this.props.frameRate) * 1000, (ns.duration / this.props.frameRate) * 1000)
			} else {
				const inp = Math.max(0, this.state.outPoint - 1)
				const ns = {
					inPoint: inp,
					duration: Math.min(this.state.maxDuration - inp, this.state.outPoint - inp),
				}
				this.setState(ns)
				this.props.onChange((ns.inPoint / this.props.frameRate) * 1000, (ns.duration / this.props.frameRate) * 1000)
			}
		}

		onDurationChange = (val: number) => {
			val = Math.max(val, this.state.minDuration)
			const ns = this.checkInOutPoints({
				duration: Math.min(val, this.state.maxDuration),
				outPoint: Math.min(this.state.inPoint + val, this.state.maxDuration),
			})
			this.setState(ns)
			this.props.onChange(
				((ns.outPoint - ns.duration) / this.props.frameRate) * 1000,
				(ns.duration / this.props.frameRate) * 1000
			)
		}

		onOutChange = (val: number) => {
			if (val > this.state.inPoint) {
				const ns = this.checkInOutPoints({
					outPoint: Math.min(val, this.state.maxDuration),
					duration: Math.min(this.state.maxDuration - this.state.inPoint, Math.max(0, val - this.state.inPoint)),
				})
				this.setState(ns)
				this.props.onChange(
					((ns.outPoint - ns.duration) / this.props.frameRate) * 1000,
					(ns.duration / this.props.frameRate) * 1000
				)
			} else {
				const out = this.state.inPoint + 1
				const ns = this.checkInOutPoints({
					outPoint: Math.min(out, this.state.maxDuration),
					duration: Math.min(this.state.maxDuration - this.state.inPoint, out - this.state.inPoint),
				})
				this.setState(ns)
				this.props.onChange(
					((ns.outPoint - ns.duration) / this.props.frameRate) * 1000,
					(ns.duration / this.props.frameRate) * 1000
				)
			}
		}

		onResetIn = () => {
			const ns = this.checkInOutPoints({
				inPoint: 0,
				duration: this.state.duration + this.state.inPoint,
			})
			this.setState(ns)
			this.props.onChange((ns.inPoint / this.props.frameRate) * 1000, (ns.duration / this.props.frameRate) * 1000)
		}

		onResetOut = () => {
			const ns = this.checkInOutPoints({
				inPoint: this.state.inPoint,
				duration: this.state.maxDuration - this.state.inPoint,
			})
			this.setState(ns)
			this.props.onChange((ns.inPoint / this.props.frameRate) * 1000, (ns.duration / this.props.frameRate) * 1000)
		}

		onResetAll = () => {
			const ns = this.checkInOutPoints({
				inPoint: 0,
				duration: this.state.maxDuration,
			})
			this.setState(ns)
			this.props.onChange((ns.inPoint / this.props.frameRate) * 1000, (ns.duration / this.props.frameRate) * 1000)
		}

		render(): JSX.Element {
			const { t } = this.props
			let previewUrl: string | undefined = undefined
			if (this.props.mediaObject && this.props.studio) {
				const mediaPreviewUrl = ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || ''
				previewUrl = mediaPreviewUrl + 'media/preview/' + encodeURIComponent(this.props.mediaObject.mediaId)
			}

			return (
				<div className="clip-trim-panel">
					<div className="clip-trim-panel__monitors">
						<div className="clip-trim-panel__monitors__monitor">
							<VideoEditMonitor
								src={previewUrl}
								fps={this.props.frameRate}
								currentTime={this.state.inPoint / this.props.frameRate}
								duration={this.props.maxDuration / 1000}
								onCurrentTimeChange={(time) => this.onInChange(time * this.props.frameRate)}
							/>
						</div>
						<div className="clip-trim-panel__monitors__monitor">
							<VideoEditMonitor
								src={previewUrl}
								fps={this.props.frameRate}
								currentTime={this.state.outPoint / this.props.frameRate}
								duration={this.props.maxDuration / 1000}
								onCurrentTimeChange={(time) => this.onOutChange(time * this.props.frameRate)}
							/>
						</div>
					</div>
					<div className="clip-trim-panel__timecode-encoders">
						<div className="clip-trim-panel__timecode-encoders__input">
							<Tooltip overlay={t('Remove in-trimming')} placement="top">
								<button
									className="action-btn clip-trim-panel__timecode-encoders__input__reset"
									onClick={this.onResetIn}
								>
									<FontAwesomeIcon icon={faUndo} />
								</button>
							</Tooltip>
							<label>{t('In')}</label>
							<TimecodeEncoder fps={this.props.frameRate} value={this.state.inPoint} onChange={this.onInChange} />
						</div>
						<div className="clip-trim-panel__timecode-encoders__input">
							<Tooltip overlay={t('Remove all trimming')} placement="top">
								<button
									className="action-btn clip-trim-panel__timecode-encoders__input__reset"
									onClick={this.onResetAll}
								>
									<FontAwesomeIcon icon={faUndo} />
								</button>
							</Tooltip>
							<label>{t('Duration')}</label>
							<TimecodeEncoder
								fps={this.props.frameRate}
								value={this.state.duration}
								invalid={this.props.invalidDuration}
								onChange={this.onDurationChange}
							/>
						</div>
						<div className="clip-trim-panel__timecode-encoders__input">
							<Tooltip overlay={t('Remove out-trimming')} placement="top">
								<button
									className="action-btn clip-trim-panel__timecode-encoders__input__reset"
									onClick={this.onResetOut}
								>
									<FontAwesomeIcon icon={faUndo} />
								</button>
							</Tooltip>
							<label>{t('Out')}</label>
							<TimecodeEncoder fps={this.props.frameRate} value={this.state.outPoint} onChange={this.onOutChange} />
						</div>
					</div>
				</div>
			)
		}
	}
)
