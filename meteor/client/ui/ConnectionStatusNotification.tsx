import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as VelocityReact from 'velocity-react'
import Moment from 'react-moment'
import * as CoreIcons from '@nrk/core-icons/jsx'
import * as ClassNames from 'classnames'

import { translateWithTracker, Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { MomentFromNow } from '../lib/Moment'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'

interface IProps {
}
interface IState {
	dismissed: boolean
}
interface ITrackedProps {
	connected: boolean
	status: string
	reason: string
	retryTime: number
}

export const ConnectionStatusNotification = translateWithTracker<IProps, IState, ITrackedProps>((props, state) => {
	const connected = Meteor.status().connected
	const status = Meteor.status().status
	const reason = Meteor.status().reason
	const retryTime = Meteor.status().retryTime

	return {
		connected,
		status,
		reason,
		retryTime
	}
})(class extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			dismissed: false
		}
	}

	componentWillReceiveProps (nextProps) {
		if ((nextProps.connected !== this.props.connected) || (nextProps.status !== this.props.status)) {
			this.setState({
				dismissed: false
			})
		}
	}

	dimissNotification () {
		this.setState({
			dismissed: true
		})
	}

	getStatusText (): string | React.ReactChild | null {
		const { t } = this.props
		switch (this.props.status) {
			case 'connecting':
				return <span>{t('Connecting to Sofie Automation Server...')}</span>
			case 'failed':
				return <span>{t('Cannot connect to the Sofie Automation Server') + ': ' + this.props.reason}</span>
			case 'waiting':
				return <span>{t('Reconnecting to the Sofie Automation Server')} <MomentFromNow unit='seconds'>{this.props.retryTime}</MomentFromNow></span>
			case 'offline':
				return <span>{t('Your machine is offline and cannot connect to the Sofie Automation Server.')}</span>
			case 'connected':
				return <span>{t('Connected to Sofie Automation Server.')}</span>
		}
		return null
	}

	tryReconnect () {
		if (!this.props.connected) {
			Meteor.reconnect()
		}
	}

	render () {
		// this.props.connected
		return <ErrorBoundary><VelocityReact.VelocityTransitionGroup enter={{ animation: {
			'translateY': [0, '200%'],
			'translateX': ['-50%', '-50%'],
			'opacity': [1, 0]
		}, easing: 'spring', duration: 500 }} leave={{ animation: 'fadeOut', easing: 'ease-in', duration: 500 }}>
			{(!this.props.connected && !this.state.dismissed) ? (
					<div className={ClassNames('row text-s tight-s status-notification connection-status-notification',
						{
							'warn': this.props.status === 'failed' || this.props.status === 'offline' || this.props.status === 'waiting',
							'bghl': this.props.status === 'connecting',
							'info': this.props.status === 'connected'
						}
					)}
					onClick={(e) => {
						// console.log('Reconnecting...')
						this.tryReconnect()
					}}>
						<p className='right'>
							<button className='action-btn' onClick={(e) => this.dimissNotification()}>
								<CoreIcons id='nrk-close' />
							</button>
						</p>
						<p className=''>
							{this.getStatusText()}
						</p>
						<p>
						</p>
					</div>
				) : undefined }
			</VelocityReact.VelocityTransitionGroup></ErrorBoundary>
	}
})
