import * as React from 'react'
import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { WithTranslation, withTranslation } from 'react-i18next'
import { Route, Switch, Redirect, RouteComponentProps } from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary'

import StudioSettings from './Settings/StudioSettings'
import DeviceSettings from './Settings/DeviceSettings'
import ShowStyleSettings from './Settings/ShowStyleBaseSettings'
import SnapshotsView from './Settings/SnapshotsView'
import BlueprintSettings from './Settings/BlueprintSettings'
import SystemManagement from './Settings/SystemManagement'

import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { MigrationView } from './Settings/Migration'
import { PubSub } from '../../lib/api/pubsub'
import { getUser, User } from '../../lib/collections/Users'
import { Settings as MeteorSettings } from '../../lib/Settings'
import { SettingsMenu } from './Settings/SettingsMenu'
import { getAllowConfigure } from '../lib/localStorage'

class WelcomeToSettings extends React.Component {
	render(): JSX.Element {
		return <div></div>
	}
}

interface ISettingsProps extends WithTranslation, RouteComponentProps {}
export const Settings = withTranslation()(
	class Settings extends MeteorReactComponent<Translated<ISettingsProps>> {
		private user: User | null
		constructor(props: ISettingsProps & WithTranslation) {
			super(props)
			this.user = getUser()
		}

		componentDidMount(): void {
			// Subscribe to data:
			this.subscribe(PubSub.peripheralDevices, {})
			this.subscribe(PubSub.studios, {})
			this.subscribe(PubSub.showStyleBases, {})
			this.subscribe(PubSub.showStyleVariants, {})
			this.subscribe(PubSub.blueprints, {})
			if (MeteorSettings.enableUserAccounts && this.user) {
				const access = getAllowConfigure()
				if (!access) this.props.history.push('/')
			}
		}
		render(): JSX.Element {
			// const { t } = this.props
			return (
				<div className="mtl gutter has-statusbar">
					{/* <header className="mvs">
						<h1>{t('System Settings')}</h1>
					</header> */}
					<div className="mod mvl mhs">
						<div className="row">
							<div className="col c12 rm-c3 settings-menu">
								<ErrorBoundary>
									<SettingsMenu match={this.props.match} superAdmin={this.user ? this.user.superAdmin : false} />
								</ErrorBoundary>
							</div>
							<div className="col c12 rm-c9 settings-dialog">
								<ErrorBoundary>
									<Switch>
										<Route path="/settings" exact component={WelcomeToSettings} />
										<Route path="/settings/studio/:studioId" component={StudioSettings} />
										<Route path="/settings/showStyleBase/:showStyleBaseId" component={ShowStyleSettings} />
										<Route path="/settings/peripheralDevice/:deviceId" component={DeviceSettings} />
										<Route
											path="/settings/blueprint/:blueprintId"
											component={(props) => <BlueprintSettings {...props} userId={this.user && this.user._id} />}
										/>
										<Route path="/settings/tools/snapshots" component={SnapshotsView} />
										<Route path="/settings/tools/migration" component={MigrationView} />
										<Route path="/settings/tools/system" component={SystemManagement} />
										<Redirect to="/settings" />
									</Switch>
								</ErrorBoundary>
							</div>
						</div>
					</div>
				</div>
			)
		}
	}
)
