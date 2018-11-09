import * as React from 'react'
import * as _ from 'underscore'
import { translate } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import {
	Route,
	Switch,
	Redirect,
	NavLink
} from 'react-router-dom'

import { RecordingsList, RecordingsStudioSelect } from './RecordingsList'
import { RecordingView } from './RecordingView'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'

interface IStatusMenuProps {
	match?: any
}
interface IStatusMenuState {
}
const StatusMenu = translate()(class StatusMenu extends React.Component<Translated<IStatusMenuProps>, IStatusMenuState> {

	render () {
		const { t } = this.props

		return (
			<div className='tight-xs htight-xs text-s'>
				<NavLink
					activeClassName='selectable-selected'
					className='testTools-menu__testTools-menu-item selectable clickable'
					to={'/testTools/recordings'}>
					<h3>{t('Recordings')}</h3>
				</NavLink>
			</div>
		)
	}
})

interface IStatusProps {
	match?: any
}
class Status extends MeteorReactComponent<Translated<IStatusProps>> {
	componentWillMount () {
		// Subscribe to data:

		this.subscribe('studioInstallations', {})
		this.subscribe('showStyles', {})
	}
	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter'>
				{ /* <header className='mvs'>
					<h1>{t('Status')}</h1>
				</header> */ }
				<div className='mod mvl mhs'>
					<div className='flex-row hide-m-up'>
						<div className='flex-col c12 rm-c1 status-menu'>
							<StatusMenu match={this.props.match} />
						</div>
					</div>
					<div className='flex-row'>
						<div className='flex-col c12 rm-c1 show-m-up status-menu'>
							<StatusMenu match={this.props.match} />
						</div>
						<div className='flex-col c12 rm-c11 status-dialog'>
							<Switch>
							<Route path='/testTools/recordings/:studioId/:recordingId' component={RecordingView} />
							<Route path='/testTools/recordings/:studioId' component={RecordingsList} />
							<Route path='/testTools/recordings' component={RecordingsStudioSelect} />
								<Redirect to='/testTools/recordings' />
							</Switch>
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default translate()(Status)
