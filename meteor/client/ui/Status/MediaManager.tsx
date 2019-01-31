import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MediaWorkFlow, MediaWorkFlows } from '../../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowStep, MediaWorkFlowSteps } from '../../../lib/collections/MediaWorkFlowSteps'
import * as i18next from 'react-i18next'
import { ClientAPI } from '../../../lib/api/client'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import Moment from 'react-moment'
import { translate } from 'react-i18next'
import { getCurrentTime, extendMandadory } from '../../../lib/lib'
import { Link } from 'react-router-dom'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import { ModalDialog, doModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { callMethod, callPeripheralDeviceFunction } from '../../lib/clientAPI'
import { PubSub } from '../../../lib/api/pubsub';

interface IMediaManagerStatusProps {

}

interface MediaWorkFlowUi extends MediaWorkFlow {
	steps: MediaWorkFlowStep[]
}

interface IMediaManagerStatusTrackedProps {
	workFlows: MediaWorkFlowUi[]
}

export const MediaManagerStatus = translateWithTracker<IMediaManagerStatusProps, {}, IMediaManagerStatusTrackedProps>((props: IMediaManagerStatusProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		workFlows: MediaWorkFlows.find({}).fetch().map(i => extendMandadory<MediaWorkFlow, MediaWorkFlowUi>(i, {
			steps: MediaWorkFlowSteps.find({
				workFlowId: i._id
			}).fetch()
		}))
	}
})(class MediaManagerStatus extends MeteorReactComponent<Translated<IMediaManagerStatusProps & IMediaManagerStatusTrackedProps>, {}> {
	componentWillMount () {
		// Subscribe to data:
		this.subscribe(PubSub.mediaWorkFlows, {})
		this.subscribe(PubSub.mediaWorkFlowSteps, {})
	}

	renderWorkFlows () {
		return this.props.workFlows.map(i =>
			<div className='workflow' key={i._id}>
				<div className='workflow__name'>{i.name || 'Unnamed Workflow'}</div>
				{i.steps.map(j => <div className='workflow__step' key={j._id}>{j.action} {j.status} {j.progress} {j.messages && j.messages.join(', ')}</div>)}
			</div>
		)
	}

	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter system-status'>
				<header className='mbs'>
					<h1>{t('Media Manager Status')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderWorkFlows()}
				</div>
			</div>
		)
	}
})
