import React, { useEffect } from 'react'
import { useSubscription, useTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Route, Switch, Redirect, useHistory } from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary'

import StudioSettings from './Settings/StudioSettings'
import DeviceSettings from './Settings/DeviceSettings'
import ShowStyleSettings from './Settings/ShowStyleBaseSettings'
import SnapshotsView from './Settings/SnapshotsView'
import BlueprintSettings from './Settings/BlueprintSettings'
import SystemManagement from './Settings/SystemManagement'

import { MigrationView } from './Settings/Migration'
import { getUser } from '../../lib/collections/Users'
import { Settings as MeteorSettings } from '../../lib/Settings'
import { SettingsMenu } from './Settings/SettingsMenu'
import { getAllowConfigure } from '../lib/localStorage'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export function Settings(): JSX.Element | null {
	const user = useTracker(() => getUser(), [], null)

	const history = useHistory()

	useSubscription(CorelibPubSub.peripheralDevices, null)
	useSubscription(CorelibPubSub.studios, null)
	useSubscription(CorelibPubSub.showStyleBases, null)
	useSubscription(CorelibPubSub.showStyleVariants, null, null)
	useSubscription(CorelibPubSub.blueprints, null)

	useEffect(() => {
		if (MeteorSettings.enableUserAccounts && user) {
			const access = getAllowConfigure()
			if (!access) history.push('/')
		}
	}, [user])

	return (
		<div className="mtl gutter has-statusbar">
			<div className="mod mvl mhs">
				<div className="row">
					<div className="col c12 rm-c3 settings-menu">
						<ErrorBoundary>
							<SettingsMenu superAdmin={user?.superAdmin ?? false} />
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
											userId={user?._id}
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
