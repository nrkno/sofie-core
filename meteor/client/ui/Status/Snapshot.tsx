import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker, ReactMeteorData } from '../../lib/ReactMeteorData/react-meteor-data'
import Moment from 'react-moment'
import { translate } from 'react-i18next'
import { getCurrentTime } from '../../../lib/lib'
import { ClientAPI } from '../../../lib/api/client'
import * as _ from 'underscore'
import { ModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { UserActionsLog, UserActionsLogItem } from '../../../lib/collections/UserActionsLog'
import * as faChevronRight from '@fortawesome/fontawesome-free-solid/faChevronRight'
import * as faChevronLeft from '@fortawesome/fontawesome-free-solid/faChevronLeft'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as classNames from 'classnames'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'

interface IProps {

}
interface ITrackedProps {
	studios: Array<StudioInstallation>
}
interface IState {

}
export const SnapshotView = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {

	return {
		studios: StudioInstallations.find().fetch()
	}
})(
class SnapshotView extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props) {
		super(props)

		this.state = {
			offset: 0
		}
	}
	componentWillMount () {
		this.subscribe('studioInstallations', {
			// _id: this.props.studioId
		})
	}

	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter external-message-status'>
				<header className='mbs'>
					<h1>{t('Take Snapshot')}</h1>
				</header>
				<div className='mod mvl'>
					{
						_.map(this.props.studios, (studio) => {

							return (
								<div key={studio._id}>
									<h2>{studio.name}</h2>
									<div>
										<a href={`/snapshot/${studio._id}`} target='_blank'>{t('Download System Snapshot')}</a>
									</div>
								</div>
							)
						})

					}
				</div>
			</div>
		)
	}
})
