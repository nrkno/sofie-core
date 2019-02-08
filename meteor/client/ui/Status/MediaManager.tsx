import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as CoreIcons from '@nrk/core-icons'
import * as faChevronDown from '@fortawesome/fontawesome-free-solid/faChevronDown'
import * as faChevronRight from '@fortawesome/fontawesome-free-solid/faChevronRight'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as VelocityReact from 'velocity-react'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as ClassNames from 'classnames'
import ReactCircularProgressbar from 'react-circular-progressbar'
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
import * as _ from 'underscore'
import { ModalDialog, doModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { callMethod, callPeripheralDeviceFunction } from '../../lib/clientAPI'
import { PubSub } from '../../../lib/api/pubsub';
import { Spinner } from '../../lib/Spinner';
import { sofieWarningIcon as WarningIcon } from '../../lib/notifications/warningIcon';

interface IMediaManagerStatusProps {

}

interface MediaWorkFlowUi extends MediaWorkFlow {
	steps: MediaWorkFlowStep[]
}

interface IMediaManagerStatusTrackedProps {
	workFlows: MediaWorkFlowUi[]
}

interface IMediaManagerStatusState {
	expanded: {
		[key: string]: boolean
	}
}

namespace MediaManagerAPI {
	export enum WorkFlowSource {
		EXPECTED_MEDIA_ITEM = 'expected_media_item',
		SOURCE_STORAGE_REMOVE = 'source_storage_remove',
		LOCAL_MEDIA_ITEM = 'local_media_item',
		TARGET_STORAGE_REMOVE = 'local_storage_remove'
	}
	
	export enum MediaFlowType {
		WATCH_FOLDER = 'watch_folder',
		LOCAL_INGEST = 'local_ingest',
		EXPECTED_ITEMS = 'expected_items'
	}
	
	export enum WorkStepStatus {
		IDLE = 'idle',
		WORKING = 'working',
		DONE = 'done',
		ERROR = 'error',
		CANCELED = 'canceled',
		BLOCKED = 'blocked'
	}
	
	export enum WorkStepAction {
		COPY = 'copy',
		DELETE = 'delete',
		GENERATE_PREVIEW = 'generate_preview',
		GENERATE_THUMBNAIL = 'generate_thumbnail',
		GENERATE_METADATA = 'generate_metadata'
	}
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
})(class MediaManagerStatus extends MeteorReactComponent<Translated<IMediaManagerStatusProps & IMediaManagerStatusTrackedProps>, IMediaManagerStatusState> {
	constructor (props) {
		super(props)

		this.state = {
			expanded: {}
		}
	}
	
	componentWillMount () {
		// Subscribe to data:
		this.subscribe(PubSub.mediaWorkFlows, {})
		this.subscribe(PubSub.mediaWorkFlowSteps, {})
	}

	actionLabel (action: string): string {
		const {t} = this.props
		switch (action) {
			case MediaManagerAPI.WorkStepAction.COPY:
				return t('File copy')
			case MediaManagerAPI.WorkStepAction.DELETE:
				return t('File delete')
			case MediaManagerAPI.WorkStepAction.GENERATE_METADATA:
				return t('Scan file')
			case MediaManagerAPI.WorkStepAction.GENERATE_THUMBNAIL:
				return t('Generate thumbnail')
			case MediaManagerAPI.WorkStepAction.GENERATE_PREVIEW:
				return t('Generate preview')
			default:
				return t('Unknown action: {{action}}', { action }) 
		}
	}

	workFlowStatusLabel (success: boolean, finished: boolean, currentTask: MediaWorkFlowStep | undefined): React.ReactChild {
		const { t } = this.props
		if (success && finished) {
			return <React.Fragment><CoreIcons id='nrk-check' />{t('Done')}</React.Fragment>
		} else if (!success && finished) {
			return <React.Fragment>
				<WarningIcon />{t('Failed')}
			</React.Fragment>
		} else if (!finished && currentTask && currentTask.status === MediaManagerAPI.WorkStepStatus.WORKING) {
			return <React.Fragment><Spinner className='working-spinner' size='medium' />{t('Working')}</React.Fragment>
		} else if (!finished && !currentTask) {
			return t('Pending')
		} else {
			return t('Unknown')
		}
	}

	workStepStatusLabel (step: MediaWorkFlowStep): string {
		const { t } = this.props
		switch (step.status) {
			case MediaManagerAPI.WorkStepStatus.BLOCKED:
				return t('Blocked')
			case MediaManagerAPI.WorkStepStatus.CANCELED:
				return t('Canceled')
			case MediaManagerAPI.WorkStepStatus.DONE:
				return t('Done')
			case MediaManagerAPI.WorkStepStatus.ERROR:
				return t('Error')
			case MediaManagerAPI.WorkStepStatus.IDLE:
				return t('Idle')
			case MediaManagerAPI.WorkStepStatus.WORKING:
				if (step.progress) {
					return t('Step progress: {{progress}}', {progress: Math.round(step.progress * 100) + '%'})
				} else {
					return t('Processing')
				}
			default:
				return t('Unknown: {{status}}', {state: step.status})
		}
	}

	toggleExpanded (id: string) {
		this.state.expanded[id] = !this.state.expanded[id] 
		this.setState({
			expanded: this.state.expanded
		})
	}

	renderWorkFlows () {
		const { t } = this.props

		const iconEnterAnimation = {
			translateY: ['0%', '-100%']
		}

		const iconLeaveAnimation = {
			translateY: ['100%', '0%']
		}

		return this.props.workFlows.sort((a, b) => b.created - a.created).map(i => {
			const expanded = this.state.expanded[i._id] === true
			const finishedOK = i.success && i.finished
			const finishedError = !i.success && i.finished
			const currentTask = i.steps.sort((a, b) => b.priority - a.priority).find(i => ((i.status === MediaManagerAPI.WorkStepStatus.WORKING) || (i.status === MediaManagerAPI.WorkStepStatus.ERROR)))
			const progress = (
				i.steps.map(i => {
					switch (i.status) {
						case MediaManagerAPI.WorkStepStatus.DONE:
							return 1
						case MediaManagerAPI.WorkStepStatus.WORKING:
							return i.progress || 0
						default:
							return 0
					}
				}).reduce((memo, i) => memo + i, 0)
			) / i.steps.length
	
			return <div className={ClassNames('workflow mbs', {
				'expanded': expanded,
				
				'ok': finishedOK,
				'error': finishedError
			})} key={i._id}>
				<div className='workflow__header pas'>
					<div className='workflow__header__progress'>
						<VelocityReact.VelocityComponent animation={finishedOK ? iconEnterAnimation : iconLeaveAnimation} duration={300} easing='easeIn'>
							<div className='big-status ok'>
								<FontAwesomeIcon icon={faCheck} />
							</div>
						</VelocityReact.VelocityComponent>
						<VelocityReact.VelocityComponent animation={finishedError ? iconEnterAnimation : iconLeaveAnimation} duration={300} easing='easeIn'>
							<div className='big-status error'>
								<WarningIcon />
							</div>
						</VelocityReact.VelocityComponent>
						<VelocityReact.VelocityComponent animation={(!finishedOK && !finishedError) ? iconEnterAnimation : iconLeaveAnimation} duration={300} easing='easeIn'>
							<ReactCircularProgressbar initialAnimation={true} percentage={progress * 100}
								text={Math.round(progress * 100) + '%'}
								strokeWidth={10}
								styles={{
									path: { stroke: `#1769ff`, strokeLinecap: 'round' },
									trail: { stroke: '#E0E3E4' },
									text: { fill: '#252627', fontSize: '170%', transform: 'translate(0, 8%)', textAnchor: 'middle' },
							}} />
						</VelocityReact.VelocityComponent>
					</div>
					<div className='workflow__header__summary'>
						<div className='workflow__header__name'>{i.name || 'Unnamed Workflow'}</div>
						<div className='workflow__header__expand' onClick={() => this.toggleExpanded(i._id)}>
							{expanded ? t('Collapse') : t('Details')}
							{expanded ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
						</div>
						<div className='workflow__header__status'>{this.workFlowStatusLabel(i.success, i.finished, currentTask)}</div>
						<div className='workflow__header__current-task workflow__step'>
							{currentTask && <React.Fragment>
								<div className='workflow__step__action pts'>{this.actionLabel(currentTask.action)}</div>
								<div className='workflow__step__status pts'>{this.workStepStatusLabel(currentTask)}</div>
							</React.Fragment>}
						</div>
					</div>
				</div>
				<VelocityReact.VelocityTransitionGroup enter={{
					animation: 'slideDown', easing: 'ease-out', duration: 150, maxHeight: 0, overflow: 'hidden'
				}} leave={{
					animation: 'slideUp', easing: 'ease-in', duration: 150, overflow: 'hidden'
				}}>	
					{expanded && <div>
						{i.steps.sort((a, b) => b.priority - a.priority).map(j => 
							<div className={ClassNames('workflow__step', {
								'ok': j.status === MediaManagerAPI.WorkStepStatus.DONE,
								'error': j.status === MediaManagerAPI.WorkStepStatus.ERROR,
								'working': j.status === MediaManagerAPI.WorkStepStatus.WORKING
							})} key={j._id}>
								<div className='workflow__step__action pas'>{this.actionLabel(j.action)}</div>
								<div className='workflow__step__status pas'>{this.workStepStatusLabel(j)}</div>
								<div className='workflow__step__progress progress-bar'>
									<div className='pb-indicator' style={{
										'width': ((j.progress || 0) * 100) + '%'
									}} />
								</div>
								{j.messages && j.messages.length > 0 && (
									<ul className='workflow__step__messages pas man'>
										{j.messages.map((k, key) => <li key={key}>{k}</li>)}
									</ul>
								)}
							</div>
						)}
					</div>}
				</VelocityReact.VelocityTransitionGroup>
			</div>
		})
	}

	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter media-manager-status'>
				<header className='mbs'>
					<h1>{t('Media Transfer Status')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderWorkFlows()}
				</div>
			</div>
		)
	}
})
