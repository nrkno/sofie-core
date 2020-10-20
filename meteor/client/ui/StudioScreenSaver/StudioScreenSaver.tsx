import * as React from 'react'
import { translateWithTracker, Translated, withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { StudioId, Studio, Studios } from '../../../lib/collections/Studios'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { getCurrentTime } from '../../../lib/lib'
import { invalidateAfter } from '../../lib/invalidatingTime'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import classNames from 'classnames'
import { Clock } from './Clock'
import { Countdown } from './Countdown'

interface IProps {
	studioId: StudioId
}

interface ITrackedProps {
	studio: Studio | undefined
	rundownPlaylist: RundownPlaylist | undefined
}

interface IState {
	infoElement: HTMLDivElement | undefined
	targetSpeedVector: [number, number]
	infoElementSize: {
		width: number | undefined
		height: number | undefined
	}
	subsReady: boolean
}

export const StudioScreenSaver = translateWithTracker((props: IProps) => {
	invalidateAfter(5000)
	const now = getCurrentTime()

	return {
		studio: Studios.findOne(props.studioId, {
			fields: {
				name: 1,
			},
		}),
		rundownPlaylist: RundownPlaylists.find(
			{
				studioId: props.studioId,
			},
			{
				sort: {
					expectedStart: 1,
				},
				fields: {
					name: 1,
					expectedStart: 1,
					expectedDuration: 1,
					studioId: 1,
				},
			}
		)
			.fetch()
			.find((rundownPlaylist) => {
				if (rundownPlaylist.expectedStart && rundownPlaylist.expectedStart > now) {
					// is expected to start next
					return true
				} else if (
					rundownPlaylist.expectedStart &&
					rundownPlaylist.expectedDuration &&
					rundownPlaylist.expectedStart <= now &&
					rundownPlaylist.expectedStart + rundownPlaylist.expectedDuration > now
				) {
					// should be live right now
					return true
				}
				return false
			}),
	}
})(
	class StudioScreenSaver extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
		private _nextAnimationFrameRequest: number | undefined
		private readonly SPEED = 0.5 // non-unit value
		private readonly FRAME_MARGIN: [number, number, number, number] = [10, 28, 10, 10] // margin, specified in vmin CSS units
		private FRAME_PIXEL_MARGIN: [number, number, number, number] // margin, calculated to pixels on resize
		private PIXEL_SPEED = 0.5

		private position: {
			x: number
			y: number
		} = {
			x: 0,
			y: 0,
		}
		private speedVector: [number, number] = [0, 0]

		constructor(props) {
			super(props)
			this.state = {
				infoElement: undefined,
				targetSpeedVector: [0, 0],
				infoElementSize: {
					width: undefined,
					height: undefined,
				},
				subsReady: false,
			}
		}

		componentDidMount() {
			this.subscribe(PubSub.studios, {
				_id: this.props.studioId,
			})
			this.subscribe(PubSub.rundownPlaylists, {
				studioId: this.props.studioId,
			})

			this.measureElement()

			window.addEventListener('resize', this.measureElement)

			this.autorun(() => {
				const subsReady = this.subscriptionsReady()
				this.setState({
					subsReady,
				})
			})
		}

		componentDidUpdate(prevProps: Translated<IProps & ITrackedProps>, prevState: IState) {
			if (
				this.props.rundownPlaylist?.name !== prevProps.rundownPlaylist?.name ||
				this.props.studio?.name !== prevProps.studio?.name
			) {
				this.measureElement()
			}
			if (this.state.infoElement !== prevState.infoElement) {
				this.restartAnimation()
			}
		}

		componentWillUnmount() {
			this._nextAnimationFrameRequest && window.cancelAnimationFrame(this._nextAnimationFrameRequest)
			window.removeEventListener('resize', this.measureElement)
		}

		/**
		 * When the component is mounted, the contents of the info box changes or when the window is resized,
		 * measure it's size and calculate pixel value representations for all values that are specified in
		 * relative units
		 *
		 * @private
		 */
		private measureElement = () => {
			const { infoElement } = this.state
			if (infoElement) {
				const infoElementSize = infoElement.getBoundingClientRect()

				// this is a first measure, place the info-box in the center of the screen
				if (this.state.infoElementSize.height === undefined || this.state.infoElementSize.width === undefined) {
					this.position = {
						x: (window.innerWidth - infoElementSize.width) / 2,
						y: (window.innerHeight - infoElementSize.height) / 2,
					}

					infoElement.style.transform = `translate3d(${this.position.x}px, ${this.position.y}px, 0.1px)`
				}

				this.setState({
					infoElementSize,
				})
			}

			const vmin = Math.min(window.innerWidth, window.innerHeight)
			this.FRAME_PIXEL_MARGIN = this.FRAME_MARGIN.map((v) => (v * vmin) / 100) as [number, number, number, number]
			this.PIXEL_SPEED = this.SPEED * (vmin / 1080)
		}

		private vectorTransitionFrameStepX = 0
		private vectorTransitionFrameStepY = 0

		// How long the transition between current speedVector and the targetSpeedVector should take
		private readonly VECTOR_TRANSITION_DURATION = 2000
		private lastFrameTime = Date.now()

		/**
		 * Update the DOM for a single frame of the animation
		 *
		 * @private
		 * @param {*} timestamp
		 */
		private animatePongFrame = (timestamp) => {
			const frameTime = timestamp - this.lastFrameTime
			const { infoElement, infoElementSize } = this.state
			let { targetSpeedVector } = this.state
			let { x, y } = this.position
			let speedVector = this.speedVector
			if (infoElement && infoElementSize.width && infoElementSize.height) {
				// If the info element is within the frame margin, and the target vector is pointing outwards,
				// calculate a new target vector and calculate the step that should happen per 1ms to transition
				// the speedVector to the target in VECTOR_TRANSITION_DURATION time.
				if (
					(x < this.FRAME_PIXEL_MARGIN[3] && targetSpeedVector[0] < 0) ||
					(x + infoElementSize.width > window.innerWidth - this.FRAME_PIXEL_MARGIN[1] && targetSpeedVector[0] > 0)
				) {
					targetSpeedVector = [targetSpeedVector[0] * -1, targetSpeedVector[1]]
					this.vectorTransitionFrameStepX = (targetSpeedVector[0] - speedVector[0]) / this.VECTOR_TRANSITION_DURATION
				}
				if (
					(y < this.FRAME_PIXEL_MARGIN[0] && targetSpeedVector[1] < 0) ||
					(y + infoElementSize.height > window.innerHeight - this.FRAME_PIXEL_MARGIN[2] && targetSpeedVector[1] > 0)
				) {
					targetSpeedVector = [targetSpeedVector[0], targetSpeedVector[1] * -1]
					this.vectorTransitionFrameStepY = (targetSpeedVector[1] - speedVector[1]) / this.VECTOR_TRANSITION_DURATION
				}
				if (this.state.targetSpeedVector !== targetSpeedVector) {
					this.setState({
						targetSpeedVector,
					})
				}

				// If the speedVector differs from the targetSpeedVector by more than the current step, animate the speedVector
				if (Math.abs(targetSpeedVector[0] - speedVector[0]) > Math.abs(this.vectorTransitionFrameStepX * frameTime)) {
					speedVector[0] += this.vectorTransitionFrameStepX * frameTime
				}
				if (Math.abs(targetSpeedVector[1] - speedVector[1]) > Math.abs(this.vectorTransitionFrameStepY * frameTime)) {
					speedVector[1] += this.vectorTransitionFrameStepY * frameTime
				}

				// guard against the simulation resulting in a fast-flying, horizontal or vertical text
				if (Math.abs(speedVector[1]) >= 1 || Math.abs(speedVector[1]) >= 1) {
					const normalizer = Math.max(Math.abs(speedVector[0]), Math.abs(speedVector[1]))
					speedVector = [speedVector[0] / normalizer, speedVector[1] / normalizer]
				}
				this.position = {
					x: x + speedVector[0] * this.PIXEL_SPEED * (frameTime / 17),
					y: y + speedVector[1] * this.PIXEL_SPEED * (frameTime / 17),
				}

				infoElement.style.transform = `translate3d(${this.position.x}px, ${this.position.y}px, 0.1px)`
			}
			this.lastFrameTime = timestamp
			this._nextAnimationFrameRequest = window.requestAnimationFrame(this.animatePongFrame)
		}

		/**
		 * Generate a nice, but random speedVector
		 *
		 * @private
		 */
		private randomizeDirection = () => {
			let speedVector: [number, number] = [0, 1]
			do {
				// take a random number
				const random = Math.random() * 2 - 1
				// build a speed vector so that ABS(Y) == ABS(1 - X)
				// so that length of the vector (i.e. speed) is constant
				speedVector = [random, (1 - Math.abs(random)) * (Math.random() >= 0.5 ? -1 : 1)]
			} while (Math.abs(speedVector[0]) > 0.6 || Math.abs(speedVector[1]) > 0.6) // prefer diagonal movement
			this.speedVector = speedVector
			this.setState({
				targetSpeedVector: [...speedVector] as [number, number],
			})

			return speedVector
		}

		private restartAnimation = () => {
			if (this._nextAnimationFrameRequest) {
				window.cancelAnimationFrame(this._nextAnimationFrameRequest)
			}
			this.randomizeDirection()
			this._nextAnimationFrameRequest = window.requestAnimationFrame(this.animatePongFrame)
		}

		private setInfoElement = (el: HTMLDivElement) => {
			this.setState({
				infoElement: el,
			})
		}

		render() {
			const { t, rundownPlaylist } = this.props
			return (
				<div
					className={classNames('studio-screen-saver', {
						loading: !this.state.subsReady,
					})}>
					<object
						className="studio-screen-saver__bkg"
						data="/images/screen-saver-bkg.svg"
						type="image/svg+xml"></object>
					<div className="studio-screen-saver__info" ref={this.setInfoElement}>
						<Clock className="studio-screen-saver__clock" />
						{rundownPlaylist && rundownPlaylist.expectedStart ? (
							<>
								<div className="studio-screen-saver__info__label">{t('Next scheduled show')}</div>
								<div className="studio-screen-saver__info__rundown">{rundownPlaylist.name}</div>
								<Countdown
									className="studio-screen-saver__info__countdown"
									expectedStart={rundownPlaylist.expectedStart}
								/>
							</>
						) : (
							this.props.studio?.name && (
								<div className="studio-screen-saver__info__rundown">{this.props.studio?.name}</div>
							)
						)}
					</div>
				</div>
			)
		}
	}
)
