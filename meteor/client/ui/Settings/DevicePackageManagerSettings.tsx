import * as React from 'react'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'

import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { doModalDialog } from '../../lib/ModalDialog'
import { Meteor } from 'meteor/meteor'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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

			PeripheralDeviceAPI.executeFunction(this.props.deviceId, 'getExpetationManagerStatus')
				.then((result) => {
					this.setState({
						status: result,
					})
				})
				.catch((error) => {
					if (!silent) {
						doModalDialog({
							message: t('There was an error: {{error}}', { error: error.toString() }),
							title: t(''),
							onAccept: () => {
								// Do nothing
							},
						})
					}
				})
		}

		killApp(appId: string) {
			const { t } = this.props

			PeripheralDeviceAPI.executeFunction(this.props.deviceId, 'debugKillApp', appId)
				.then(() => {
					this.reloadStatus(true)
				})
				.catch((error) => {
					doModalDialog({
						message: t('There was an error: {{error}}', { error: error.toString() }),
						title: t(''),
						onAccept: () => {
							// Do nothing
						},
					})
				})
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
								{this.state.status.updated ? (
									<div className="row">
										<div className="col c12">
											{t('Updated')}: {new Date(this.state.status.updated).toLocaleString()}
										</div>
									</div>
								) : null}
								<div className="row">
									<div className="col c12 rl-c6">
										<h3 className="">{t('Package Manager')}</h3>
										<table className="table">
											<tbody>
												{Object.entries(this.state.status.packageManager || {}).map(([key, value]) => {
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
										<div>Id: {this.state.status.expectationManager?.id}</div>
										{this.state.status.expectationManager?.updated ? (
											<div>
												{t('Updated')}: {new Date(this.state.status.expectationManager.updated).toLocaleString()}
											</div>
										) : null}
										<div>
											<h4 className="">{t('Statistics')}</h4>
											<table className="table">
												<tbody>
													{Object.entries(this.state.status.expectationManager?.expectationStatistics || {}).map(
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
											<h4 className="">{t('Times')}</h4>
											<table className="table">
												<tbody>
													{Object.entries(this.state.status.expectationManager?.times || {}).map(([key, value]) => {
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
										<div>
											<h4 className="">{t('Connected Workers')}</h4>
											<TableFromObjectArray dataObjs={this.state.status.expectationManager?.workerAgents} />
										</div>
									</div>
								</div>
								<div className="row">
									<div className="col c12">
										<h4 className="">{t('Work-in-progress')}</h4>
										<TableFromObjectArray dataObjs={this.state.status.expectationManager?.worksInProgress} />
									</div>
								</div>
								<div className="row">
									<div>
										<h3 className="">{t('WorkForce')}</h3>
										<div className="col c12 rl-c12">
											<h4 className="">{t('Connected Workers')}</h4>
											<TableFromObjectArray
												dataObjs={this.state.status.workforce?.workerAgents}
												rowFcn={(workerAgent) => (
													<button className="btn btn-secondary btn-tight" onClick={() => this.killApp(workerAgent.id)}>
														{t('Kill (debug)')}
													</button>
												)}
											/>
										</div>
									</div>
									<div>
										<h4 className="">{t('Connected Expectation Managers')}</h4>
										<TableFromObjectArray dataObjs={this.state.status.workforce?.expectationManagers} />
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
												{this.state.status.workforce?.appContainers?.map((appContainer) => {
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

// Note: These interfaces are copied from Package Manager. To be replaced with shared types later..
interface Status {
	packageManager?: PackageManagerStatus
	workforce?: WorkforceStatus
	expectationManager?: ExpectationManagerStatus
	updated?: number
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
	updated: number
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
	times: { [key: string]: number }
	workerAgents: {
		workerId: string
	}[]
	worksInProgress: {
		id: string
		lastUpdated: number
		workerId: string
		cost: number
		expectationId: string
	}[]
}

interface TableFromObjectArrayData<T> {
	dataObjs: { [key: string]: T }[] | undefined
	rowFcn?: (dataObj: T) => JSX.Element
}

const TableFromObjectArray: React.FC<TableFromObjectArrayData<any>> = function TableFromObject({ dataObjs, rowFcn }) {
	if (!dataObjs) return <i>No data</i>
	if (typeof dataObjs !== 'object') return <i>{dataObjs}</i>

	const setOfKeys = new Set<string>()
	for (const dataObj of Object.values(dataObjs)) {
		for (const key of Object.keys(dataObj)) {
			setOfKeys.add(key)
		}
	}
	const keys = Array.from(setOfKeys.keys())

	function displayValue(val: any) {
		if (typeof val === 'object') return JSON.stringify(val)
		return val
	}

	return (
		<table className="table">
			<tbody>
				<tr>
					{keys.map((key) => {
						return <th key={key}>{key}</th>
					})}
				</tr>
				{dataObjs.map((dataObj, index) => {
					if (typeof dataObj === 'object') {
						return (
							<tr key={dataObj.id || `__index${index}`}>
								{keys.map((key) => {
									const value = dataObj[key]
									let returnValue
									if (Array.isArray(value)) {
										returnValue = <TableFromObjectArray dataObjs={value} />
									} else if (typeof value === 'object') {
										try {
											returnValue = JSON.stringify(value)
										} catch (e) {
											returnValue = `>Error parsing: ${stringifyError(e, true)}<`
										}
									} else if (value === true) {
										returnValue = 'true'
									} else if (value === false) {
										returnValue = 'false'
									} else {
										returnValue = `${value}`
									}
									return <td key={key}>{returnValue}</td>
								})}

								{rowFcn ? <td>{rowFcn(dataObj)}</td> : null}
							</tr>
						)
					} else {
						return (
							<tr key={`__index${index}`}>
								<td colSpan={keys.length}>{displayValue(dataObj)}</td>
							</tr>
						)
					}
				})}
			</tbody>
		</table>
	)
}
