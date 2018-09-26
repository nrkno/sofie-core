import * as React from 'react'
import * as CoreIcons from '@nrk/core-icons/jsx'
import * as Escape from 'react-escape'
import * as ClassNames from 'classnames'
import * as VelocityReact from 'velocity-react'
import { mousetrapHelper } from './mousetrapHelper'
import { logger } from '../../lib/logging'
import * as _ from 'underscore'
import { translate } from 'react-i18next'
import { Translated } from './ReactMeteorData/ReactMeteorData'

interface IModalDialogAttributes {
	show?: boolean
	title: string
	secondaryText?: string
	acceptText: string
	onAccept?: (e) => void
	onSecondary?: (e) => void
	onDiscard?: (e) => void
}
export class ModalDialog extends React.Component<IModalDialogAttributes> {
	boundKeys: Array<string> = []

	constructor (args) {
		super(args)
	}

	componentDidMount () {
		this.bindKeys()
	}

	componentWillUnmount () {
		this.unbindKeys()
	}

	componentDidUpdate () {
		this.bindKeys()
	}

	bindKeys = () => {
		if (this.props.show) {
			if (this.boundKeys.indexOf('enter') < 0) {
				mousetrapHelper.bind('enter', this.preventDefault, 'keydown')
				mousetrapHelper.bind('enter', this.handleKey, 'keyup')
				this.boundKeys.push('enter')
			}
			if (this.boundKeys.indexOf('esc') < 0) {
				mousetrapHelper.bind('esc', this.preventDefault, 'keydown')
				mousetrapHelper.bind('esc', this.handleKey, 'keyup')
				this.boundKeys.push('esc')
			}
		} else {
			this.unbindKeys()
		}
	}

	unbindKeys = () => {
		this.boundKeys.forEach((key) => {
			mousetrapHelper.unbind(key, this.preventDefault, 'keydown')
			mousetrapHelper.unbind(key, this.handleKey, 'keyup')
		})
		this.boundKeys.length = 0
	}

	handleKey = (e) => {
		if (this.props.show) {
			if (e.keyCode === 13) { // Enter
				this.handleAccept(e)
			} else if (e.keyCode === 27) { // Escape
				if (this.props.secondaryText) {
					this.handleSecondary(e)
				} else {
					this.handleDiscard(e)
				}
			}
		}
	}

	handleAccept = (e) => {
		if (this.props.onAccept && typeof this.props.onAccept === 'function') {
			this.props.onAccept(e)
		}
	}

	handleSecondary = (e) => {
		if (this.props.onSecondary && typeof this.props.onSecondary === 'function') {
			this.props.onSecondary(e)
		}
	}

	handleDiscard = (e) => {
		if (this.props.onDiscard && typeof this.props.onDiscard === 'function') {
			this.props.onDiscard(e)
		} else {
			this.handleSecondary(e)
		}
	}

	render () {
		return this.props.show ?
					<Escape to='viewport'>
						<VelocityReact.VelocityTransitionGroup enter={{ animation: 'fadeIn', easing: 'ease-out', duration: 250 }} runOnMount={true}>
							<div className='glass-pane'>
								<div className='glass-pane-content'>
									<VelocityReact.VelocityTransitionGroup enter={{ animation: {
										translateY: [0, 100],
										opacity: [1, 0]
									}, easing: 'spring', duration: 250 }} runOnMount={true}>
										<div className='border-box overlay-m'>
											<div className='flex-row info vertical-align-stretch tight-s'>
												<div className='flex-col c12'>
													<h2>
														{this.props.title}
													</h2>
												</div>
												<div className='flex-col horizontal-align-right vertical-align-middle'>
													<p>
														<button className='action-btn' onClick={this.handleDiscard}>
															<CoreIcons id='nrk-close' />
														</button>
													</p>
												</div>
											</div>
											<div className='title-box-content'>
												{this.props.children}
											</div>
											<div className={ClassNames('mod', {
												'alright': !this.props.secondaryText
											})}>
												{
													this.props.secondaryText &&
													<button className='btn btn-secondary' onClick={this.handleSecondary}>{this.props.secondaryText}</button>
												}
												<button className={ClassNames('btn btn-primary', {
													'right': this.props.secondaryText !== undefined
												})} onClick={this.handleAccept}>{this.props.acceptText}</button>
											</div>
										</div>
									</VelocityReact.VelocityTransitionGroup>
								</div>
							</div>
						</VelocityReact.VelocityTransitionGroup>
					</Escape>
				: null
	}

	private preventDefault (e: KeyboardEvent) {
		e.preventDefault()
		e.stopPropagation()
	}
}

interface ModalDialogQueueItem {
	title: string
	message: string | JSX.Element
	yes?: string
	no?: string
	onAccept: (e: any) => void
	onDiscard?: (e: any) => void
	onSecondary?: (e: any) => void
}
interface IModalDialogGlobalContainerProps {
}
interface IModalDialogGlobalContainerState {
	queue: Array<ModalDialogQueueItem>
}

class ModalDialogGlobalContainer0 extends React.Component<Translated<IModalDialogGlobalContainerProps>, IModalDialogGlobalContainerState> {
	constructor (props) {
		super(props)
		if (modalDialogGlobalContainerSingleton) {
			logger.warning('modalDialogGlobalContainerSingleton called more than once!')
		}
		modalDialogGlobalContainerSingleton = this
		this.state = {
			queue: []
		}
	}
	public addQueue (q: ModalDialogQueueItem) {
		let queue = this.state.queue
		queue.push(q)
		this.setState({
			queue
		})
	}
	onAccept = (e: any) => {
		let queue = this.state.queue
		let onQueue = queue.pop()
		if (onQueue) {
			this.setState({queue})
			onQueue.onAccept(e)
		}
	}
	onDiscard = (e: any) => {
		let queue = this.state.queue
		let onQueue = queue.pop()
		if (onQueue) {
			this.setState({queue})
			if (onQueue.onDiscard) {
				onQueue.onDiscard(e)
			}
		}
	}
	onSecondary = (e: any) => {

		let queue = this.state.queue
		let onQueue = queue.pop()
		if (onQueue) {
			this.setState({queue})
			if (onQueue.onSecondary) {
				onQueue.onSecondary(e)
			}
		}
	}
	renderString = (str: string) => {
		let lines = (str || '').split('\n')

		return _.map(lines, (str: string, i) => {
			return (
				<p key={i}>
					{str.trim()}
				</p>
			)
		})
	}
	render () {
		const { t } = this.props
		let onQueue = _.first(this.state.queue)

		if (onQueue) {
			return (
			<ModalDialog title	= {onQueue.title}
				acceptText		= {onQueue.yes || t('Yes')}
				secondaryText	= {onQueue.no || t('No')}
				onAccept		= {this.onAccept}
				onDiscard		= {this.onDiscard}
				onSecondary		= {this.onSecondary}
				show			= {true}
			>
				{
					_.isString(onQueue.message) ?
					this.renderString(onQueue.message) :
					onQueue.message
				}
			</ModalDialog>)

		} else return null
	}
}
export const ModalDialogGlobalContainer = translate()(ModalDialogGlobalContainer0)
let modalDialogGlobalContainerSingleton: ModalDialogGlobalContainer0
/**
 * Display a ModalDialog, callback on user input
 * @param q ModalDialogQueueItem
 * Example:
 * 	doModalDialog({
 * 		title: t('Order 66?'),
 * 		message: t('Do you want to do this?'),
 * 		onAccept: (event: any) => {
 * 		// Execute order 66
 * 		},
 * 	})
 */
export function doModalDialog (q: ModalDialogQueueItem) {
	if (modalDialogGlobalContainerSingleton) {
		modalDialogGlobalContainerSingleton.addQueue(q)
	} else {
		logger.error('modalDialogGlobalContainerSingleton not set!')
	}
}
