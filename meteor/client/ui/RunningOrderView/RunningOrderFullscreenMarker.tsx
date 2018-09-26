import * as _ from 'underscore'
import * as React from 'react'
import * as $ from 'jquery'
import * as VelocityReact from 'velocity-react'

import Lottie from 'react-lottie'

// @ts-ignore Not recognized by Typescript
import * as Stage1 from './RunningOrder_Fullscreen_Stage_01.json'
// @ts-ignore Not recognized by Typescript
import * as Stage2 from './RunningOrder_Fullscreen_Stage_02.json'
import { translate, InjectedTranslateProps } from 'react-i18next'

interface IState {
	isFullscreen: boolean
	hasTriedToFullscreen: boolean
	hover: boolean
}

export const RunningOrderFullscreenMarker = translate()(class RunningOrderFullscreenMarker extends React.Component<{} & InjectedTranslateProps, IState> {

	throttledRefreshFullScreenState: () => void

	constructor (props) {
		super(props)

		this.state = {
			isFullscreen: this.checkFullScreen(),
			hasTriedToFullscreen: false,
			hover: false
		}

		this.throttledRefreshFullScreenState = _.throttle(this.refreshFullScreenState, 500)
	}

	componentDidMount () {
		$(window).on('resize', this.throttledRefreshFullScreenState)
	}

	componentWillUnmount () {
		$(window).off('resize', this.throttledRefreshFullScreenState)
	}

	checkFullScreen () {
		// @ts-ignore TypeScript doesn't have vendor-prefixed fullscreen flags
		return document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen ||
				screen.height === window.innerHeight ||
				false // This will return true or false depending on if it's full screen or not.
	}

	refreshFullScreenState = () => {
		if (this.state.isFullscreen !== this.checkFullScreen()) {
			this.setState({
				isFullscreen: this.checkFullScreen()
			})
		}
	}

	requestFullscreen () {
		const docElm = document.documentElement
		if (docElm.requestFullscreen) {
			return docElm.requestFullscreen()
			// @ts-ignore TS doesn't understand Gecko vendor prefixes
		} else if (docElm.mozRequestFullScreen) {
			// @ts-ignore TS doesn't understand Gecko vendor prefixes
			return docElm.mozRequestFullScreen()
		} else if (docElm.webkitRequestFullScreen) {
			// @ts-ignore TS doesn't understand Webkit special/old ALLOW_KEYBOARD_INPUT
			return docElm.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT)
		}
	}

	onClick = (e: React.MouseEvent<HTMLDivElement>) => {
		// @ts-ignore TS doesn't have requestFullscreen promise
		const promise = this.requestFullscreen()
		this.setState({
			isFullscreen: true,
			hasTriedToFullscreen: true
		})
	}

	onMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			hover: true
		})
	}

	onMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			hover: false
		})
	}

	render () {
		const stage1Options = {
			loop: true,
			autoplay: true,
			animationData: Stage1,
			rendererSettings: {
				preserveAspectRatio: 'xMidYMid meet'
			}
		}

		const stage2Options = {
			loop: true,
			autoplay: true,
			animationData: Stage2,
			rendererSettings: {
				preserveAspectRatio: 'xMidYMid meet'
			}
		}

		const { t } = this.props

		return <VelocityReact.VelocityTransitionGroup enter={{
			animation: 'fadeIn', easing: 'ease-out', duration: 250
		}} leave={{
			animation: 'fadeOut', easing: 'ease-in', duration: 500, delay: 100
		}} runOnMount={true}>
			{ (!this.state.isFullscreen && !this.state.hasTriedToFullscreen) &&
				<div className='running-order__fullscreen-marker' onClick={this.onClick}>
					<div className='running-order__fullscreen-marker__emblem' onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
						{ this.state.hover ?
							<Lottie options={stage2Options} isStopped={false} isPaused={false} /> :
							<Lottie options={stage1Options} isStopped={false} isPaused={false} /> }
						<div className='running-order__fullscreen-marker__label'>
							<p>
								{ t('Click Anywhere to go Fullscreen...') }
							</p>
						</div>
					</div>
			</div> }
		</VelocityReact.VelocityTransitionGroup>
	}
})
