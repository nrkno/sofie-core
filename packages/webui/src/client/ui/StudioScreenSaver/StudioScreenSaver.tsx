import * as React from 'react'
import { Translated, useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime } from '../../lib/systemTime.js'
import { invalidateAfter } from '../../lib/invalidatingTime.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import classNames from 'classnames'
import { Clock } from './Clock.js'
import { Countdown } from './Countdown.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { UIStudios } from '../Collections.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists } from '../../collections/index.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { withTranslation } from 'react-i18next'
import { relativeToSiteRootUrl } from '../../url.js'

interface IProps {
	// the studio to be displayed in the screen saver
	studioId: StudioId
	screenName?: string
	ownBackground?: boolean
}

interface ITrackedProps {
	studio: Pick<UIStudio, 'name'> | undefined
	rundownPlaylist: Pick<DBRundownPlaylist, '_id' | 'studioId' | 'name' | 'timing'> | undefined
	subsReady: boolean
}

interface IState {
	// the info-box that is being animated by the screen-saver
	infoElement: HTMLDivElement | undefined
	// the target speed vector, the actual speed vector is supposed to transform to
	targetSpeedVector: [number, number]
	// the current size of the info-box element
	infoElementSize: {
		width: number | undefined
		height: number | undefined
	}
}

interface FindNextPlaylistResult {
	studio: Pick<UIStudio, 'name'> | undefined
	rundownPlaylist: Pick<DBRundownPlaylist, '_id' | 'studioId' | 'name' | 'timing'> | undefined
}
export const findNextPlaylist = (studioId: StudioId): FindNextPlaylistResult => {
	invalidateAfter(5000)
	const now = getCurrentTime()

	return {
		studio: UIStudios.findOne(studioId, {
			fields: {
				name: 1,
			},
		}) as Pick<UIStudio, 'name'> | undefined,
		rundownPlaylist: (
			RundownPlaylists.find(
				{
					studioId: studioId,
				},
				{
					fields: {
						name: 1,
						timing: 1,
						studioId: 1,
					},
				}
			).fetch() as Pick<DBRundownPlaylist, '_id' | 'studioId' | 'name' | 'timing'>[]
		)
			.sort(PlaylistTiming.sortTimings)
			.find((rundownPlaylist) => {
				const expectedStart = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
				const expectedDuration = PlaylistTiming.getExpectedDuration(rundownPlaylist.timing)
				if (expectedStart && expectedStart > now) {
					// is expected to start next
					return true
				} else if (
					expectedStart &&
					expectedDuration &&
					expectedStart <= now &&
					expectedStart + expectedDuration > now
				) {
					// should be live right now
					return true
				}
				return false
			}),
	}
}

/**
 * This component renders a **nice**, animated screen saver with information about upcoming
 * shows planned in the studio and the time remaining to the expectedStart time of said show.
 */
export function StudioScreenSaver(props: Readonly<IProps>): JSX.Element {
	const subReadyStudio = useSubscription(MeteorPubSub.uiStudio, props.studioId)
	const subReadyPlaylist = useSubscription(CorelibPubSub.rundownPlaylists, [], [props.studioId])
	const subsReady = subReadyStudio && subReadyPlaylist

	const data = useTracker(() => findNextPlaylist(props.studioId), [props.studioId])

	return (
		<StudioScreenSaverContent
			{...props}
			studio={data?.studio}
			rundownPlaylist={data?.rundownPlaylist}
			subsReady={subsReady}
		/>
	)
}
const StudioScreenSaverContent = withTranslation()(
	class StudioScreenSaverContent extends React.Component<Translated<IProps & ITrackedProps>, IState> {
		private _nextAnimationFrameRequest: number | undefined
		private readonly SPEED = 0.5 // non-unit value
		private readonly FRAME_MARGIN: [number, number, number, number] = [10, 28, 10, 10] // margin, specified in vmin CSS units
		private FRAME_PIXEL_MARGIN: [number, number, number, number] = [0, 0, 0, 0] // margin, calculated to pixels on resize
		private PIXEL_SPEED = 0.5

		private position: {
			x: number
			y: number
		} = {
			x: 0,
			y: 0,
		}
		private speedVector: [number, number] = [0, 0]

		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)
			this.state = {
				infoElement: undefined,
				targetSpeedVector: [0, 0],
				infoElementSize: {
					width: undefined,
					height: undefined,
				},
			}
		}

		componentDidMount(): void {
			if (this.props.ownBackground) {
				document.body.classList.add('dark', 'xdark')
				document.body.setAttribute('data-bs-theme', 'dark')
			}

			window.addEventListener('resize', this.measureElement)
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

		componentWillUnmount(): void {
			if (this.props.ownBackground) {
				document.body.classList.remove('dark', 'xdark')
				document.body.removeAttribute('data-bs-theme')
			}

			if (this._nextAnimationFrameRequest) window.cancelAnimationFrame(this._nextAnimationFrameRequest)
			window.removeEventListener('resize', this.measureElement)
		}

		private static defaultPosition(size: { width?: number; height?: number }) {
			return {
				x: (window.innerWidth - (size.width || 0)) / 2,
				y: (window.innerHeight - (size.height || 0)) / 2,
			}
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
					this.position = StudioScreenSaverContent.defaultPosition(infoElementSize)

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
		private animatePongFrame = (timestamp: number) => {
			const frameTime = timestamp - this.lastFrameTime
			const { infoElement, infoElementSize } = this.state
			let { targetSpeedVector } = this.state
			const { x, y } = this.position
			const speedVector = this.speedVector
			const windowWidth = window.innerWidth
			const windowHeight = window.innerHeight
			if (infoElement && infoElementSize.width && infoElementSize.height) {
				// If the info element is within the frame margin, and the target vector is pointing outwards,
				// calculate a new target vector and calculate the step that should happen per 1ms to transition
				// the speedVector to the target in VECTOR_TRANSITION_DURATION time.
				if (
					(x < this.FRAME_PIXEL_MARGIN[3] && targetSpeedVector[0] < 0) ||
					(x + infoElementSize.width > windowWidth - this.FRAME_PIXEL_MARGIN[1] && targetSpeedVector[0] > 0)
				) {
					targetSpeedVector = [targetSpeedVector[0] * -1, targetSpeedVector[1]]
					this.vectorTransitionFrameStepX = (targetSpeedVector[0] - speedVector[0]) / this.VECTOR_TRANSITION_DURATION
				}
				if (
					(y < this.FRAME_PIXEL_MARGIN[0] && targetSpeedVector[1] < 0) ||
					(y + infoElementSize.height > windowHeight - this.FRAME_PIXEL_MARGIN[2] && targetSpeedVector[1] > 0)
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
				if (Math.abs(speedVector[0]) >= 1 || Math.abs(speedVector[1]) >= 1) {
					const normalizer = Math.max(Math.abs(speedVector[0]), Math.abs(speedVector[1]))
					speedVector[0] = speedVector[0] / normalizer
					speedVector[1] = speedVector[1] / normalizer
				}

				this.position.x = x + speedVector[0] * this.PIXEL_SPEED * (frameTime / 17)
				this.position.y = y + speedVector[1] * this.PIXEL_SPEED * (frameTime / 17)

				// if by any chance the infoElement ends up beyond the screen area, reposition it to the center
				if (
					this.position.x < 0 ||
					this.position.y < 0 ||
					this.position.x + infoElementSize.width > windowWidth ||
					this.position.y + infoElementSize.height > windowHeight
				) {
					this.position = StudioScreenSaverContent.defaultPosition(infoElementSize)
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
			let tries = 0
			do {
				// take a random number
				const random = Math.random() * 2 - 1
				// build a speed vector in which X^2 + Y^2 = 1
				// so that length of the vector (i.e. speed) is constant
				speedVector = [random, Math.sqrt(Math.abs(1 - Math.pow(random, 2))) * (Math.random() >= 0.5 ? -1 : 1)]
				tries++
			} while (tries < 100 && (Math.abs(speedVector[0]) < 0.3 || Math.abs(speedVector[1]) < 0.3)) // prefer diagonal movement, but give up if we can't achieve that quickly
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
			this.setState(
				{
					infoElement: el,
				},
				() => {
					this.measureElement()
				}
			)
		}

		render(): JSX.Element {
			const { t, rundownPlaylist } = this.props
			const expectedStart = rundownPlaylist && PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
			const hasRundown = !!expectedStart
			return (
				<div
					className={classNames('studio-screen-saver', {
						loading: !this.props.subsReady,
					})}
				>
					<object
						className="studio-screen-saver__bkg"
						data={relativeToSiteRootUrl('/images/screen-saver-bkg.svg')}
						type="image/svg+xml"
					></object>
					<div
						className={classNames('studio-screen-saver__info', {
							'studio-screen-saver__info--no-rundown': !hasRundown,
						})}
						ref={this.setInfoElement}
					>
						<Clock className="studio-screen-saver__clock" />
						{hasRundown && rundownPlaylist && expectedStart ? (
							<>
								<div className="studio-screen-saver__info__label">{t('Next scheduled show')}</div>
								<div className="studio-screen-saver__info__rundown">{rundownPlaylist.name}</div>
								<Countdown className="studio-screen-saver__info__countdown" expectedStart={expectedStart} />
							</>
						) : (
							this.props.studio?.name && (
								<div className="studio-screen-saver__info__rundown">{this.props.studio?.name}</div>
							)
						)}
						{this.props.screenName && (
							<div className="studio-screen-saver__info__screen-name">{this.props.screenName}</div>
						)}
					</div>
				</div>
			)
		}
	}
)
