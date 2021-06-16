import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
} from '../../../lib/collections/ExpectedPackageWorkStatuses'
import { assertNever, unprotectString } from '../../../lib/lib'
import { ExpectedPackageDB, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import Tooltip from 'rc-tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo, faStopCircle, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { MeteorCall } from '../../../lib/api/methods'
import { doUserAction, UserAction } from '../../lib/userAction'
import { Studios } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import ClassNames from 'classnames'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { withTranslation } from 'react-i18next'

interface IExpectedPackagesStatusProps {}

interface IIExpectedPackagesStatusTrackedProps {
	expectedPackageWorkStatuses: ExpectedPackageWorkStatus[]
	expectedPackages: ExpectedPackageDB[]
}

interface IPackageManagerStatusState {
	expanded: {
		[expectedPackaStatuseId: string]: boolean
	}
	openPackages: { [packageId: string]: true }
}

export const ExpectedPackagesStatus = translateWithTracker<
	IExpectedPackagesStatusProps,
	{},
	IIExpectedPackagesStatusTrackedProps
>(() => {
	return {
		expectedPackageWorkStatuses: ExpectedPackageWorkStatuses.find({}).fetch(),
		expectedPackages: ExpectedPackages.find({}).fetch(),
	}
})(
	class PackageManagerStatus extends MeteorReactComponent<
		Translated<IExpectedPackagesStatusProps & IIExpectedPackagesStatusTrackedProps>,
		IPackageManagerStatusState
	> {
		constructor(props) {
			super(props)

			this.state = {
				expanded: {},
				openPackages: {},
			}
		}

		componentDidMount() {
			// Subscribe to data:
			this.subscribe(PubSub.expectedPackageWorkStatuses, {
				studioId: 'studio0', // hack
			})
			this.subscribe(PubSub.expectedPackages, {
				studioId: 'studio0', // hack
			})
		}

		renderExpectedPackageStatuses() {
			const { t } = this.props

			const packageRef: { [packageId: string]: ExpectedPackageDB } = {}
			for (const expPackage of this.props.expectedPackages) {
				packageRef[unprotectString(expPackage._id)] = expPackage
			}

			const packagesWithWorkStatuses: {
				[packageId: string]: {
					package: ExpectedPackageDB | undefined
					statuses: ExpectedPackageWorkStatus[]
				}
			} = {}
			for (const work of this.props.expectedPackageWorkStatuses) {
				// todo: make this better:
				const key = unprotectString(work.fromPackages[0]?.id) || 'unknown_work_' + work._id
				// const referencedPackage = packageRef[packageId]
				let packageWithWorkStatus = packagesWithWorkStatuses[key]
				if (!packageWithWorkStatus) {
					packagesWithWorkStatuses[key] = packageWithWorkStatus = {
						package: packageRef[key] || undefined,
						statuses: [],
					}
				}
				packageWithWorkStatus.statuses.push(work)
			}

			for (const id of Object.keys(packagesWithWorkStatuses)) {
				packagesWithWorkStatuses[id].statuses.sort(compareWorkStatus)
			}

			return Object.keys(packagesWithWorkStatuses).map((packageId) => {
				const p = packagesWithWorkStatuses[packageId]
				const viewed = this.isPackageViewed(packageId)
				return (
					<React.Fragment key={packageId}>
						{p.package ? (
							<>
								<tr className={ClassNames('package')}>
									<td>{this.getPackageStatus(p)}</td>
									<td>{this.getPackageName(p.package)}</td>
									<td>
										<a
											href="#"
											onClick={(e) => {
												e.preventDefault()
												this.toggleViewPackage(packageId)
											}}
										>
											{t('{{jobCount}} jobs', { jobCount: p.statuses.length })}
											&nbsp;
											{viewed ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
										</a>
									</td>
								</tr>
								{viewed
									? p.statuses.map((status) => {
											return (
												<tr key={unprotectString(status._id)} className="package-job">
													<td colSpan={2}>
														<span className="package-job__status">
															<Tooltip overlay={status.statusReason} placement="top">
																<JobStatus status={status} />
															</Tooltip>
														</span>
														<span className="package-job__description">
															<Tooltip overlay={status.description} placement="top">
																<span>{status.label}</span>
															</Tooltip>
														</span>
													</td>
													<td>
														<Tooltip overlay={t('Restart')} placement="top">
															<button className="action-btn" onClick={(e) => this.restartExpectation(e, status)}>
																<FontAwesomeIcon icon={faRedo} />
															</button>
														</Tooltip>
														<Tooltip overlay={t('Abort')} placement="top">
															<button
																className="action-btn"
																// disabled={status.status !== 'fullfilled'}
																onClick={(e) => this.abortExpectation(e, status)}
															>
																<FontAwesomeIcon icon={faStopCircle} />
															</button>
														</Tooltip>
													</td>
												</tr>
											)
									  })
									: null}
							</>
						) : (
							<tr className="package">
								<td colSpan={99}>{t('Unknown Package "{{packageId}}"', { packageId })}</td>
							</tr>
						)}
					</React.Fragment>
				)
			})
		}
		getPackageStatus(p: { package: ExpectedPackageDB | undefined; statuses: ExpectedPackageWorkStatus[] }) {
			const getProgress = (onlyRequired: boolean) => {
				let count = 0
				let progress = 0
				for (const status of p.statuses) {
					if (onlyRequired && !status.requiredForPlayout) {
						continue
					}
					count++
					if (status.status === 'fulfilled') {
						progress += 1
					} else if (status.status === 'working') {
						progress += status.progress || 0.1
					} else {
						progress += 0
					}
				}
				if (count) {
					return progress / count
				} else {
					return 1
				}
			}

			const requiredProgress = getProgress(true)
			const allProgress = getProgress(false)

			return (
				<>
					{this.getPackageStatusIcon(requiredProgress)}
					{this.getPackageStatusIcon(allProgress)}
				</>
			)
		}
		getPackageStatusIcon(progress: number) {
			const { t } = this.props

			const svgCircleSector = (x: number, y: number, radius: number, v: number, color: string) => {
				if (v >= 1) {
					return <circle cx={x} cy={y} r={radius} fill={color}></circle>
				}
				if (v <= 0) return null

				const x0 = x + radius * Math.sin(v * Math.PI * 2)
				const y0 = y - radius * Math.cos(v * Math.PI * 2)

				const flags = v > 0.5 ? '1,1' : '0,1'
				return (
					<path
						d={`M${x},${y}
						L${x},${y - radius}
						A${radius},${radius} 0 ${flags} ${x0},${y0}
						z`}
						fill={color}
					></path>
				)
			}

			if (progress < 1) {
				return (
					<div className="package-progress">
						<svg width="100%" viewBox="-50 -50 100 100">
							<circle cx="0" cy="0" r="50" fill="#A2F8B0"></circle>
							{svgCircleSector(0, 0, 50, progress, '#00BA1E')}
							<circle cx="0" cy="0" r="35" fill="#fff"></circle>
						</svg>
						<div className="label">{Math.floor(progress * 100)}%</div>
					</div>
				)
			} else {
				return (
					<div className="package-progress">
						<svg width="100%" viewBox="-50 -50 100 100">
							<circle cx="0" cy="0" r="50" fill="#00BA1E"></circle>
						</svg>
						<div className="label label-done">{t('Done')}</div>
					</div>
				)
			}
		}
		getPackageName(p: ExpectedPackageDB): string {
			const p2: ExpectedPackage.Any = p as any
			if (p2.type === ExpectedPackage.PackageType.MEDIA_FILE) {
				return p2.content.filePath || unprotectString(p._id)
			} else if (p2.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
				return p2.content.guid || p2.content.title || unprotectString(p._id)
			} else {
				assertNever(p2)
				return unprotectString(p._id)
			}
		}
		toggleViewPackage(packageId: string) {
			if (!this.state.openPackages[packageId]) {
				this.state.openPackages[packageId] = true
			} else {
				delete this.state.openPackages[packageId]
			}
			this.setState({
				openPackages: this.state.openPackages,
			})
		}
		isPackageViewed(packageId: string) {
			return this.state.openPackages[packageId] || false
		}
		renderExpectedPackageStatusesSummary() {
			const packageRef: { [packageId: string]: ExpectedPackageDB } = {}
			for (const expPackage of this.props.expectedPackages) {
				packageRef[unprotectString(expPackage._id)] = expPackage
			}

			const packagesWithWorkStatuses: {
				[packageId: string]: {
					package: ExpectedPackageDB | undefined
					statuses: ExpectedPackageWorkStatus[]
				}
			} = {}
			for (const work of this.props.expectedPackageWorkStatuses) {
				// todo: make this better:
				const packageId = unprotectString(work.fromPackages[0]?.id) || 'N/A'
				// const referencedPackage = packageRef[packageId]
				let packageWithWorkStatus = packagesWithWorkStatuses[packageId]
				if (!packageWithWorkStatus) {
					packagesWithWorkStatuses[packageId] = packageWithWorkStatus = {
						package: packageRef[packageId] || undefined,
						statuses: [],
					}
				}
				packageWithWorkStatus.statuses.push(work)
			}

			for (const id of Object.keys(packagesWithWorkStatuses)) {
				packagesWithWorkStatuses[id].statuses.sort(compareWorkStatus)
			}

			return Object.keys(packagesWithWorkStatuses).map((packageId) => {
				const p = packagesWithWorkStatuses[packageId]
				const name = p.package
					? JSON.stringify(p.package.content) + ', ' + JSON.stringify(p.package.version)
					: `Unknown package "${packageId}"`
				return (
					<div key={packageId} className="package-summary">
						<div className="package-summary__name">
							<Tooltip overlay={name} placement="top">
								<div>{name}</div>
							</Tooltip>
						</div>

						<div className="package-summary__statuses">
							{p.statuses.map((status) => {
								const progressStr =
									status.status === 'working' && status.progress ? ` ${Math.round(status.progress * 100)}%` : ''

								const reason = `${status.label}: ${status.status}${progressStr}, ${status.statusReason}`

								return (
									<div key={unprotectString(status._id)} className={'package-summary__statuses__status'}>
										<Tooltip overlay={reason} placement="top">
											<div
												className={ClassNames('status', `status-${status.status}`)}
												style={
													status.status === 'working' && status.progress
														? {
																height: `${Math.round(status.progress * 100)}%`,
														  }
														: {}
												}
											/>
										</Tooltip>
										<div className="package-summary__statuses__status__reason">{reason}</div>
									</div>
								)
							})}
						</div>
					</div>
				)
			})
		}
		restartExpectation(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, status: ExpectedPackageWorkStatus): void {
			doUserAction(this.props.t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e) =>
				MeteorCall.userAction.packageManagerRestartExpectation(e, status.deviceId, unprotectString(status._id))
			)
		}
		restartAllExpectations(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
			const studio = Studios.findOne()
			if (!studio) throw new Meteor.Error(404, `No studio found!`)

			doUserAction(this.props.t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e) =>
				MeteorCall.userAction.packageManagerRestartAllExpectations(e, studio._id)
			)
		}
		abortExpectation(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, status: ExpectedPackageWorkStatus): void {
			doUserAction(this.props.t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e) =>
				MeteorCall.userAction.packageManagerAbortExpectation(e, status.deviceId, unprotectString(status._id))
			)
		}

		render() {
			const { t } = this.props

			return (
				<div className="mhl gutter package-statuses">
					<header className="mbs">
						<h1>{t('Package Status')}</h1>
					</header>
					<div className="mod mvl alright">
						<button className="btn btn-secondary mls" onClick={(e) => this.restartAllExpectations(e)}>
							{t('Restart All')}
						</button>
					</div>
					{/* <div className="mod mvl">{this.renderExpectedPackageStatusesSummary()}</div> */}

					<table className="mod mvl package-statuses-list">
						<tbody>
							<tr className="package-statuses__header">
								<th>{t('Status')}</th>
								<th>{t('Name')}</th>
								<th></th>
								{/* <th>{t('Info')}</th> */}
								{/* <th>{t('Created')}</th> */}
							</tr>
							{this.renderExpectedPackageStatuses()}
						</tbody>
					</table>

					<div></div>
				</div>
			)
		}
	}
)

function compareWorkStatus(a: ExpectedPackageWorkStatus, b: ExpectedPackageWorkStatus): number {
	if ((a.displayRank || 0) > (b.displayRank || 0)) return 1
	if ((a.displayRank || 0) < (b.displayRank || 0)) return -1

	if (a.requiredForPlayout && !b.requiredForPlayout) return 1
	if (!a.requiredForPlayout && b.requiredForPlayout) return -1

	if (a.label > b.label) return 1
	if (a.label < b.label) return -1

	return 0
}

interface IJobStatusProps {
	status: ExpectedPackageWorkStatus
}
interface JobStatusState {
	open: boolean
}
const JobStatus = withTranslation()(
	class JobStatus extends React.Component<Translated<IJobStatusProps>, JobStatusState> {
		constructor(props) {
			super(props)

			this.state = {
				open: false,
			}
		}
		getProgressbar() {
			const { t } = this.props

			let progress: number
			let label: string
			if (this.props.status.status === 'fulfilled') {
				progress = 1
				label = t('Done')
			} else if (this.props.status.status === 'working') {
				progress = this.props.status.progress || 0
				label = Math.floor(progress * 100) + '%'
			} else {
				progress = 0
				label = this.props.status.status
			}

			return (
				<div
					className="job-status"
					style={{
						width: '10em',
					}}
				>
					<div
						className="job-status__progress"
						style={{
							width: progress * 100 + '%',
						}}
					></div>
					<div className="job-status__label">{label}</div>
				</div>
			)
		}
		render() {
			return <>{this.getProgressbar()}</>
		}
	}
)
