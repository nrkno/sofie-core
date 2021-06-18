import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
	ExpectedPackageWorkStatusId,
} from '../../../lib/collections/ExpectedPackageWorkStatuses'
import { assertNever, unprotectString } from '../../../lib/lib'
import { ExpectedPackageDB, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import Tooltip from 'rc-tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faRedo,
	faStopCircle,
	faChevronDown,
	faChevronRight,
	faExclamation,
	faQuestion,
} from '@fortawesome/free-solid-svg-icons'
import { MeteorCall } from '../../../lib/api/methods'
import { doUserAction, UserAction } from '../../lib/userAction'
import { Studios } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import ClassNames from 'classnames'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { withTranslation } from 'react-i18next'
import { DisplayFormattedTime } from '../RundownList/DisplayFormattedTime'

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
	openStatuses: { [statusId: string]: true }
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
				openStatuses: {},
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

			// sort:
			const keys: { packageId: string; order: number; created: number }[] = []
			Object.keys(packagesWithWorkStatuses).map((packageId) => {
				const p = packagesWithWorkStatuses[packageId]

				let order = 0
				for (const status of p.statuses) {
					if (status.status !== 'fulfilled') {
						order = 1
					}
				}
				keys.push({
					packageId,
					created: p.package?.created ?? 0,
					order,
				})
			})
			keys.sort((a, b) => {
				// Incomplete first:
				if (a.order < b.order) return 1
				if (a.order > b.order) return -1

				if (a.created < b.created) return 1
				if (a.created > b.created) return -1

				if (a.packageId < b.packageId) return 1
				if (a.packageId > b.packageId) return -1

				return 0
			})

			return keys.map(({ packageId }) => {
				const p = packagesWithWorkStatuses[packageId]
				console.log(p)
				const viewed = this.isPackageViewed(packageId)

				const statuses = p.statuses.sort((a, b) => {
					if ((a.displayRank ?? 999) > (b.displayRank ?? 999)) return 1
					if ((a.displayRank ?? 999) < (b.displayRank ?? 999)) return -1

					return 0
				})
				return (
					<React.Fragment key={packageId}>
						{p.package ? (
							<React.Fragment key={packageId}>
								<tr
									className={ClassNames('package')}
									onClick={(e) => {
										e.preventDefault()
										this.toggleViewPackage(packageId)
									}}
								>
									<td></td>
									<td>{this.getPackageStatus(p)}</td>
									<td>
										{viewed ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
										&nbsp;
										{this.getPackageName(p.package)}
									</td>
									<td>
										<DisplayFormattedTime displayTimestamp={p.package.created} t={t} />
									</td>
									<td></td>
								</tr>
								{viewed
									? statuses.map((status) => {
											const statusViewed = this.isStatusViewed(status._id)
											return (
												<React.Fragment key={unprotectString(status._id)}>
													<tr
														key={unprotectString(status._id)}
														className="package-job"
														onClick={(e) => {
															e.preventDefault()
															this.toggleViewStatus(status._id)
														}}
													>
														<td></td>
														<td colSpan={2}>
															<span className="package-job__required">
																{status.requiredForPlayout ? (
																	<Tooltip overlay={t('This step is required for playout')} placement="top">
																		<span>
																			<FontAwesomeIcon icon={faExclamation} />
																		</span>
																	</Tooltip>
																) : null}
															</span>
															<span className="package-job__status">
																<JobStatus status={status} />
															</span>
															<span className="package-job__description">
																{statusViewed ? (
																	<FontAwesomeIcon icon={faChevronDown} />
																) : (
																	<FontAwesomeIcon icon={faChevronRight} />
																)}
																&nbsp;
																<span>{status.label}</span>
															</span>
														</td>
														<td>
															<Tooltip overlay={t('Restart')} placement="top">
																<button className="action-btn" onClick={(e) => this.restartExpectation(e, status)}>
																	<FontAwesomeIcon icon={faRedo} />
																</button>
															</Tooltip>
															&nbsp;&nbsp;
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
														<td></td>
													</tr>
													{statusViewed ? (
														<tr key={`${status._id}_view`} className="package-job-details">
															<td></td>
															<td colSpan={4}>
																<table>
																	<tbody>
																		<tr>
																			<td>{t('Work description')}</td>
																			<td>{status.description}</td>
																		</tr>
																		<tr>
																			<td>{t('Work status')}</td>
																			<td>{status.status}</td>
																		</tr>
																		<tr>
																			<td>{t('Work status reason')}</td>
																			<td>
																				<Tooltip
																					overlay={t('Technical reason: {{reason}}', {
																						reason: status.statusReason.tech,
																					})}
																					placement="bottom"
																				>
																					<span>{status.statusReason.user ?? status.statusReason?.toString()}</span>
																				</Tooltip>
																			</td>
																		</tr>
																		<tr>
																			<td>{t('Last updated')}</td>
																			<td>
																				<DisplayFormattedTime displayTimestamp={status.modified} t={t} />
																			</td>
																		</tr>
																	</tbody>
																</table>
															</td>
														</tr>
													) : null}
												</React.Fragment>
											)
									  })
									: null}
							</React.Fragment>
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
			const { t } = this.props
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

			const labelRequiredProgress = requiredProgress < 1 ? `${Math.floor(requiredProgress * 100)}%` : t('Ready')
			const labelAllProgress = allProgress < 1 ? `${Math.floor(allProgress * 100)}%` : t('Done')

			return (
				<>
					<Tooltip overlay={t('The progress of steps required for playout')} placement="top">
						{this.getPackageStatusIcon(requiredProgress, labelRequiredProgress)}
					</Tooltip>
					<Tooltip overlay={t('The progress of all steps')} placement="top">
						{this.getPackageStatusIcon(allProgress, labelAllProgress)}
					</Tooltip>
				</>
			)
		}
		getPackageStatusIcon(progress: number, label: string) {
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
						<div className="label">{label}</div>
					</div>
				)
			} else {
				return (
					<div className="package-progress">
						<svg width="100%" viewBox="-50 -50 100 100">
							<circle cx="0" cy="0" r="50" fill="#00BA1E"></circle>
						</svg>
						<div className="label label-done">{label}</div>
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
		toggleViewPackage(packageId: string): void {
			if (!this.state.openPackages[packageId]) {
				this.state.openPackages[packageId] = true
			} else {
				delete this.state.openPackages[packageId]
			}
			this.setState({
				openPackages: this.state.openPackages,
			})
		}
		isPackageViewed(packageId: string): boolean {
			return this.state.openPackages[packageId] || false
		}
		toggleViewStatus(statusId: ExpectedPackageWorkStatusId): void {
			const key = unprotectString(statusId)
			if (!this.state.openStatuses[key]) {
				this.state.openStatuses[key] = true
			} else {
				delete this.state.openStatuses[key]
			}
			this.setState({
				openStatuses: this.state.openStatuses,
			})
		}
		isStatusViewed(statusId: ExpectedPackageWorkStatusId): boolean {
			return this.state.openStatuses[unprotectString(statusId)] || false
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
								<th colSpan={2}>{t('Status')}</th>
								<th>{t('Name')}</th>
								<th>{t('Created')}</th>
								<th></th>
								{/* <th>{t('Info')}</th> */}
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
