import { useSubscription } from '../lib/ReactMeteorData/react-meteor-data.js'
import { Route, Switch, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary.js'

import StudioSettings from './Settings/StudioSettings.js'
import DeviceSettings from './Settings/DeviceSettings.js'
import ShowStyleSettings from './Settings/ShowStyleBaseSettings.js'
import SnapshotsView from './Settings/SnapshotsView.js'
import BlueprintSettings from './Settings/BlueprintSettings.js'
import SystemManagement from './Settings/SystemManagement.js'

import { MigrationView } from './Settings/Migration.js'
import { SettingsMenu } from './Settings/SettingsMenu.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export function Settings(): JSX.Element | null {
	useSubscription(CorelibPubSub.peripheralDevices, null)
	useSubscription(CorelibPubSub.studios, null)
	useSubscription(CorelibPubSub.showStyleBases, null)
	useSubscription(CorelibPubSub.showStyleVariants, null, null)
	useSubscription(CorelibPubSub.blueprints, null)

	return (
		<div className="mtl gutter has-statusbar">
			<div className="mod mvl mhs">
				<div className="row">
					<div className="col c12 rm-c3 settings-menu">
						<ErrorBoundary>
							<SettingsMenu />
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
									render={(props) => (
										<BlueprintSettings
											blueprintId={protectString(decodeURIComponent(props.match.params.blueprintId))}
										/>
									)}
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

function WelcomeToSettings(): JSX.Element {
	return <div></div>
}
