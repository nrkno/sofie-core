import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as VelocityAnimate from 'velocity-animate'
import * as VelocityReact from 'velocity-react'
import Moment from 'react-moment'
import * as CoreIcons from '@nrk/core-icons/jsx'
import * as ClassNames from 'classnames'

import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'

interface IPropsHeader {
	connected: boolean
	status: string
	reason: string
	retryTime: number
}

interface IStateHeader {
	dismissed: boolean
	show: boolean
}

export const ConnectionStatusNotification = withTracker((props, state) => {
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
})(translate()(class extends React.Component<IPropsHeader & InjectedTranslateProps, IStateHeader> {
	constructor (props) {
		super(props)
		this.state = {
			dismissed: false,
			show: false
		}
	}

	componentDidMount () {
		setTimeout(() => {
			this.setState({
				show: true
			})
		}, 2000)
	}

	componentWillReceiveProps (nextProps) {
		if ((nextProps.connected !== this.props.connected) || (nextProps.status !== this.props.status)) {
			this.setState({
				dismissed: false,
				show: true
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
				return <span>{t('Connecting to automation server...')}</span>
			case 'failed':
				return <span>{t('Cannot connect to the automation server') + ': ' + this.props.reason}</span>
			case 'waiting':
				return <span>{t('Reconnecing to the automation server')} <Moment fromNow unit='seconds'>{this.props.retryTime}</Moment></span>
			case 'offline':
				return <span>{t('Your machine is off-line.')}</span>
			case 'connected':
				return <span>Connected to server.</span>
		}
		return null
	}

	render () {
		// this.props.connected
		return <VelocityReact.VelocityTransitionGroup enter={{ animation: {
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
					)}>
						<p className='right'>
							<button className='action-btn' onClick={(e) => this.dimissNotification()}>
								<CoreIcons id='nrk-close' />
							</button>
						</p>
						<p>
							{this.getStatusText()}
						</p>
						<p>
						</p>
					</div>
				) : undefined }
			</VelocityReact.VelocityTransitionGroup>
	}
}))
