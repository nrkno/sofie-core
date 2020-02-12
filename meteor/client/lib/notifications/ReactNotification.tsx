import * as _ from 'underscore'
import * as React from 'react'
import { Random } from 'meteor/random'
import { NoticeLevel, NotificationCenter, Notification, NotificationAction } from './notifications'
import { getCurrentTime } from '../../../lib/lib'

export interface IProps {
	level?: NoticeLevel
	source?: string
	actions?: NotificationAction[]
	rank?: number
}

export class ReactNotification extends React.Component<IProps> {
	private _notification: Notification
	private _notificationId: string

	componentDidMount () {
		this.buildNotification()
	}

	componentWillUnmount () {
		NotificationCenter.drop(this._notificationId)
	}

	componentDidUpdate (prevProps: IProps) {
		if (!_.isEqual(this.props, prevProps)) {
			NotificationCenter.drop(this._notificationId)
			this.buildNotification()
		}
	}

	render () {
		return null
	}

	private buildNotification () {
		this._notificationId = Random.id()
		this._notification = new Notification(
			this._notificationId,
			this.props.level || NoticeLevel.TIP,
			(this.props.children as React.ReactElement<HTMLElement>) || null,
			this.props.source || 'ReactNotification',
			getCurrentTime(),
			true,
			this.props.actions,
			this.props.rank
		)
		NotificationCenter.push(this._notification)
	}
}
