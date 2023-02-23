import React, { useCallback, useEffect, useRef, useState } from 'react'
import { PeripheralDevices, PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'

import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { doModalDialog } from '../../lib/ModalDialog'
import { Meteor } from 'meteor/meteor'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'
import { useTranslation } from 'react-i18next'
import { MeteorCall } from '../../../lib/api/methods'
import { eventContextForLog } from '../../lib/clientAPI'

interface IDevicePackageManagerSettingsProps {
	deviceId: PeripheralDeviceId
}

export const DevicePackageManagerSettings: React.FC<IDevicePackageManagerSettingsProps> =
	function DevicePackageManagerSettings({ deviceId }: IDevicePackageManagerSettingsProps) {
		const { t } = useTranslation()
		const device = useTracker(() => PeripheralDevices.findOne(deviceId), [deviceId], undefined)
		const reloadingNow = useRef(false)
		const [status, setStatus] = useState<Status | undefined>(undefined)

		const reloadStatus = useCallback(
			(e: string, silent: boolean = false) => {
				if (reloadingNow.current) return // if there is a method currently being executed, skip

				reloadingNow.current = true

				// TODO: this now logs as a user-action, which Johan doesn't like
				MeteorCall.client
					.callBackgroundPeripheralDeviceFunction(this.props.deviceId, 1000, 'getExpetationManagerStatus')
					.then((result: Status) => {
						reloadingNow.current = false

						setStatus(result)
					})
					.catch((error) => {
						reloadingNow.current = false

						if (!silent) {
							doModalDialog({
								message: t('There was an error: {{error}}', { error: error.toString() }),
								title: t('Error'),
								warning: true,
								onAccept: () => {
									// Do nothing
								},
							})
						}
					})
			},
			[setStatus]
		)

		useEffect(() => {
			const reloadInterval = Meteor.setInterval(() => {
				if (this.props.device) {
					reloadStatus('Status Auto-Refresh', true)
				}
			}, 1000)

			return () => {
				Meteor.clearInterval(reloadInterval)
			}
		}, [reloadStatus])

		function killApp(e: string, appId: string) {
			const { t } = this.props

			MeteorCall.client
				.callPeripheralDeviceFunction(e, this.props.deviceId, 1000, 'debugKillApp', appId)
				.then(() => {
					this.reloadStatus(true)
				})
				.catch((error) => {
					doModalDialog({
						message: t('There was an error: {{error}}', { error: error.toString() }),
						title: t('Error'),
						warning: true,
						onAccept: () => {
							// Do nothing
						},
					})
				})
		}

		if (!device) {
			return <Spinner />
		}

		return (
			<div>
				<div className="row">
					<h2 className="mhn mtn">{t('Package Manager status')}</h2>
				</div>
				<div className="row">
					<div className="col c12 rl-c6">
						<button className="btn btn-secondary btn-tight" onClick={(e) => reloadStatus(eventContextForLog(e)[0])}>
							{t('Reload statuses')}
						</button>
					</div>
				</div>
				{status ? (
					<div>
						{status.updated ? (
							<div className="row">
								<div className="col c12">
									{t('Updated')}: {new Date(status.updated).toLocaleString()}
								</div>
							</div>
						) : null}
						<div className="row">
							<div className="col c12 rl-c6">
								<h3 className="">{t('Package Manager')}</h3>
								<table className="table">
									<tbody>
										{Object.entries(status.packageManager || {}).map(([key, value]) => {
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
								<div>Id: {status.expectationManager?.id}</div>
								{status.expectationManager?.updated ? (
									<div>
										{t('Updated')}: {new Date(status.expectationManager.updated).toLocaleString()}
									</div>
								) : null}
								<div>
									<h4 className="">{t('Statistics')}</h4>
									<table className="table">
										<tbody>
											{Object.entries(status.expectationManager?.expectationStatistics || {}).map(([key, value]) => {
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
									<h4 className="">{t('Times')}</h4>
									<table className="table">
										<tbody>
											{Object.entries(status.expectationManager?.times || {}).map(([key, value]) => {
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
									<TableFromObjectArray dataObjs={status.expectationManager?.workerAgents} />
								</div>
							</div>
						</div>
						<div className="row">
							<div className="col c12">
								<h4 className="">{t('Work-in-progress')}</h4>
								<TableFromObjectArray dataObjs={status.expectationManager?.worksInProgress} />
							</div>
						</div>
						<div className="row">
							<div>
								<h3 className="">{t('WorkForce')}</h3>
								<div className="col c12 rl-c12">
									<h4 className="">{t('Connected Workers')}</h4>
									<TableFromObjectArray
										dataObjs={status.workforce?.workerAgents}
										rowFcn={(workerAgent) => (
											<button
												className="btn btn-secondary btn-tight"
												onClick={(e) => killApp(eventContextForLog(e)[0], workerAgent.id)}
											>
												{t('Kill (debug)')}
											</button>
										)}
									/>
								</div>
							</div>
							<div>
								<h4 className="">{t('Connected Expectation Managers')}</h4>
								<TableFromObjectArray dataObjs={status.workforce?.expectationManagers} />
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
										{status.workforce?.appContainers?.map((appContainer) => {
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
	}

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
