import React, { useEffect } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Route, Switch, Redirect, useHistory } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary'

import StudioSettings from './StudioSettings'
import DeviceSettings from './DeviceSettings'
import ShowStyleSettings from './ShowStyleBaseSettings'
import SnapshotsView from './SnapshotsView'
import BlueprintSettings from './BlueprintSettings'
import SystemManagement from './SystemManagement'

import { MigrationView } from './Migration'
import { PubSub } from '../../../lib/api/pubsub'
import { getUser } from '../../../lib/collections/Users'
import { Settings as MeteorSettings } from '../../../lib/Settings'
import { SettingsMenu } from './SettingsMenu'
import { getAllowConfigure } from '../../lib/localStorage'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

export function SettingsView(): JSX.Element | null {
	const user = useTracker(() => getUser(), [], null)

	const history = useHistory()

	useSubscription(PubSub.peripheralDevices, {})
	useSubscription(PubSub.studios, {})
	useSubscription(PubSub.showStyleBases, {})
	useSubscription(PubSub.showStyleVariants, {})
	useSubscription(PubSub.blueprints, {})

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
