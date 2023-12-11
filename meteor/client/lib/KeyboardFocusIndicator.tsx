import { Meteor } from 'meteor/meteor'
import * as React from 'react'

import { getAllowStudio, getAllowConfigure, getAllowService } from '../lib/localStorage'

import { MeteorCall } from '../../lib/api/methods'
import { getCurrentTime } from '../../lib/lib'
import { catchError } from './lib'

interface IKeyboardFocusIndicatorState {
	inFocus: boolean
}
interface IKeyboardFocusIndicatorProps {
	showWhenFocused?: boolean
}

export class KeyboardFocusIndicator extends React.Component<
	React.PropsWithChildren<IKeyboardFocusIndicatorProps>,
	IKeyboardFocusIndicatorState
> {
	private keyboardFocusInterval: number | undefined

	constructor(props: IKeyboardFocusIndicatorProps) {
		super(props)

		this.state = {
			inFocus: true,
		}
	}

	componentDidMount(): void {
		this.keyboardFocusInterval = Meteor.setInterval(() => this.checkFocus(), 3000)
		document.body.addEventListener('focusin', this.checkFocus)
		document.body.addEventListener('focus', this.checkFocus)
		document.body.addEventListener('mousedown', this.checkFocus)
		document.addEventListener('visibilitychange', this.checkFocus)
	}

	componentWillUnmount(): void {
		if (this.keyboardFocusInterval !== undefined) Meteor.clearInterval(this.keyboardFocusInterval)
		document.body.removeEventListener('focusin', this.checkFocus)
		document.body.removeEventListener('focus', this.checkFocus)
		document.body.removeEventListener('mousedown', this.checkFocus)
		document.removeEventListener('visibilitychange', this.checkFocus)
	}

	private checkFocus = () => {
		const focusNow = document.hasFocus()
		if (this.state.inFocus !== focusNow) {
			this.setState({
				inFocus: focusNow,
			})
			const viewInfo = [
				window.location.href + window.location.search,
				window.innerWidth,
				window.innerHeight,
				getAllowStudio(),
				getAllowConfigure(),
				getAllowService(),
			]
			if (focusNow) {
				MeteorCall.userAction
					.guiFocused('checkFocus', getCurrentTime(), viewInfo)
					.catch(catchError('userAction.guiFocused("checkFocus")'))
			} else {
				MeteorCall.userAction
					.guiBlurred('checkFocus', getCurrentTime(), viewInfo)
					.catch(catchError('userAction.guiBlurred("checkFocus")'))
			}
		}
	}

	render(): React.ReactNode {
		if ((this.state.inFocus && !this.props.showWhenFocused) || (!this.state.inFocus && this.props.showWhenFocused)) {
			return null
		} else {
			return this.props.children
		}
	}
}
