import * as React from 'react'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice, PeripheralDevices, PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'

import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { doModalDialog } from '../../lib/ModalDialog'
import { Meteor } from 'meteor/meteor'

interface IDevicePackageManagerSettingsProps {
	deviceId: PeripheralDeviceId
}
interface IDevicePackageManagerSettingsState {
	status: Status | undefined
}
interface IDevicePackageManagerSettingsTrackedProps {
	device?: PeripheralDevice
	// subDevices?: PeripheralDevice[]
}
export const DevicePackageManagerSettings = translateWithTracker<
	IDevicePackageManagerSettingsProps,
	IDevicePackageManagerSettingsState,
	IDevicePackageManagerSettingsTrackedProps
>((props: IDevicePackageManagerSettingsProps) => {
	return {
		device: PeripheralDevices.findOne(props.deviceId),
	}
})(
	class DevicePackageManagerSettings extends MeteorReactComponent<
		Translated<IDevicePackageManagerSettingsProps & IDevicePackageManagerSettingsTrackedProps>,
		IDevicePackageManagerSettingsState
	> {
		private reloadInterval: number | null = null
		constructor(props) {
			super(props)
			this.state = {
				status: undefined,
			}
		}
		componentDidMount() {
			if (!this.reloadInterval) {
				this.reloadInterval = Meteor.setInterval(() => {
					if (this.props.device) {
						this.reloadStatus(true)
					}
				}, 1000)
			}
		}
		componentWillUnmount() {
			if (this.reloadInterval) {
				Meteor.clearInterval(this.reloadInterval)
				this.reloadInterval = null
			}
		}
		reloadStatus(silent: boolean = false) {
			const { t } = this.props

			PeripheralDeviceAPI.executeFunction(
				this.props.deviceId,
				(error, result) => {
					if (error) {
						if (!silent) {
							doModalDialog({
								message: t('There was an error: {{error}}', { error: error.toString() }),
								title: t(''),
								onAccept: () => {
									// Do nothing
								},
							})
						}
					} else {
						this.setState({
							status: result,
						})
					}
				},
				'getExpetationManagerStatus'
			)
		}

		killApp(appId: string) {
			const { t } = this.props

			PeripheralDeviceAPI.executeFunction(
				this.props.deviceId,
				(error) => {
					if (error) {
						doModalDialog({
							message: t('There was an error: {{error}}', { error: error.toString() }),
							title: t(''),
							onAccept: () => {
								// Do nothing
							},
						})
					} else {
						this.reloadStatus(true)
					}
				},
				'debugKillApp',
				appId
			)
		}

		render() {
			const { t } = this.props
			if (this.props.device) {
				return (
					<div>
						<div className="row">
							<h2 className="mhn mtn">{t('Package Manager status')}</h2>
						</div>
						<div className="row">
							<div className="col c12 rl-c6">
								<button className="btn btn-secondary btn-tight" onClick={() => this.reloadStatus()}>
									{t('Reload statuses')}
								</button>
							</div>
						</div>
						{this.state.status ? (
							<div>
								<div className="row">
									<div className="col c12 rl-c6">
										<h3 className="">{t('Package Manager')}</h3>
										<table className="table">
											<tbody>
												{Object.entries(this.state.status.packageManager).map(([key, value]) => {
													return (
														<tr key={key}>
															<td>{key}</td>
															<td>{JSON.stringify(value)}</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>
									<div className="col c12 rl-c6">
										<h3 className="">{t('Expectation Manager')}</h3>
										Id: {this.state.status.expectationManager.id}
										<div>
											<h4 className="">{t('Statistics')}</h4>
											<table className="table">
												<tbody>
													{Object.entries(this.state.status.expectationManager.expectationStatistics).map(
														([key, value]) => {
															return (
																<tr key={key}>
																	<td>{key}</td>
																	<td>{JSON.stringify(value)}</td>
																</tr>
															)
														}
													)}
												</tbody>
											</table>
										</div>
										<div>
											<h4 className="">{t('Connected Workers')}</h4>
											<table className="table">
												<tbody>
													{this.state.status.expectationManager.workerAgents.map((value, index) => {
														return (
															<tr key={index}>
																<td>{JSON.stringify(value)}</td>
															</tr>
														)
													})}
												</tbody>
											</table>
										</div>
									</div>
								</div>
								<div className="row">
									<div>
										<h3 className="">{t('WorkForce')}</h3>
										<div className="col c12 rl-c12">
											<h4 className="">{t('Connected Workers')}</h4>
											<table className="table">
												<tbody>
													{this.state.status.workforce.workerAgents.map((workerAgent) => {
														return (
															<tr key={workerAgent.id}>
																<td>{workerAgent.id}</td>
																<td>
																	<button
																		className="btn btn-secondary btn-tight"
																		onClick={() => this.killApp(workerAgent.id)}
																	>
																		{t('Kill (debug)')}
																	</button>
																</td>
															</tr>
														)
													})}
												</tbody>
											</table>
										</div>
									</div>
									<div>
										<h4 className="">{t('Connected Expectation Managers')}</h4>
										<table className="table">
											<tbody>
												<tr>
													<th>Id</th>
													<th>URL</th>
												</tr>
												{this.state.status.workforce.expectationManagers.map((expMan) => {
													return (
														<tr key={expMan.id}>
															<td>{expMan.id}</td>
															<td>{expMan.url}</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>
									<div>
										<h4 className="">{t('Connected App Containers')}</h4>
										<table className="table">
											<tbody>
												<tr>
													<th>Id</th>
													<th>Initialized</th>
													<th>Available apps</th>
												</tr>
												{this.state.status.workforce.appContainers.map((appContainer) => {
													return (
														<tr key={appContainer.id}>
															<td>{appContainer.id}</td>
															<td>{appContainer.initialized ? 'true' : 'false'}</td>
															<td>
																<ul>
																	{appContainer.availableApps.map((availableApp, index) => {
																		return <li key={index}>{availableApp.appType}</li>
																	})}
																</ul>
															</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						) : (
							<div>{t('No status loaded')}</div>
						)}
					</div>
				)
			} else {
				return <Spinner />
			}
		}
	}
)

interface Status {
	packageManager: PackageManagerStatus
	workforce: WorkforceStatus
	expectationManager: ExpectationManagerStatus
}
interface PackageManagerStatus {
	workforceURL: string
	lastUpdated: number
	countExpectedPackages: number
	countPackageContainers: number
	countExpectations: number
	countPackageContainerExpectations: number
}

interface WorkforceStatus {
	workerAgents: {
		id: string
	}[]
	expectationManagers: {
		id: string
		url?: string
	}[]
	appContainers: {
		id: string
		initialized: boolean

		availableApps: {
			appType: string
		}[]
	}[]
}
interface ExpectationManagerStatus {
	id: string
	expectationStatistics: {
		countTotal: number

		countNew: number
		countWaiting: number
		countReady: number
		countWorking: number
		countFulfilled: number
		countRemoved: number
		countRestarted: number
		countAborted: number

		countNoAvailableWorkers: number
		countError: number
	}
	workerAgents: {
		workerId: string
	}[]
}
