import * as React from 'react'
import { translateWithTracker, Translated } from '../ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../MeteorReactComponent'
import { NotificationCenter, Notification } from './notifications'

interface IProps {

}

interface IState {

}

interface ITrackedProps {
	notifications: Array<Notification>
}

export const NotificationCenterPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state: IState) => {
	return {
		notifications: NotificationCenter.getNotifications()
	}
})(class NotificationCenterPanel extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {

})
