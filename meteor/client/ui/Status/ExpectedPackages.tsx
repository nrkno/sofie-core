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

interface IPackageManagerStatusState {}

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

			this.state = {}
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
		restartAllExpectations(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
			const studio = Studios.findOne()
			if (!studio) throw new Meteor.Error(404, `No studio found!`)

			doUserAction(this.props.t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e) =>
				MeteorCall.userAction.packageManagerRestartAllExpectations(e, studio._id)
			)
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

				return p.package ? (
					<PackageStatus key={packageId} package={p.package} statuses={p.statuses} />
				) : (
					<tr className="package">
						<td colSpan={99}>{t('Unknown Package "{{packageId}}"', { packageId })}</td>
					</tr>
				)
			})
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
interface IPackageStatusProps {
	package: ExpectedPackageDB
	statuses: ExpectedPackageWorkStatus[]
}
interface PackageStatusState {
	isOpen: boolean
}

const PackageStatus = withTranslation()(
	class PackageStatus extends React.Component<Translated<IPackageStatusProps>, PackageStatusState> {
		constructor(props) {
			super(props)

			this.state = {
				isOpen: false,
			}
		}
		toggleOpen(): void {
			this.setState({
				isOpen: !this.state.isOpen,
			})
		}
		getPackageStatus() {
			const { t } = this.props
			const getProgress = (onlyRequired: boolean) => {
				let count = 0
				let progress = 0
				for (const status of this.props.statuses) {
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
							<circle cx="0" cy="0" r="50" fill="#0000ff"></circle>
							<circle cx="0" cy="0" r="45" fill="#A2F8B0"></circle>
							{svgCircleSector(0, 0, 45, progress, '#00BA1E')}
							<circle cx="0" cy="0" r="30" fill="#fff"></circle>
						</svg>
						<div className="label">{label}</div>
					</div>
				)
			} else {
				return (
					<div className="package-progress">
						<svg width="100%" viewBox="-50 -50 100 100">
							<circle cx="0" cy="0" r="50" fill="#0000ff"></circle>
							<circle cx="0" cy="0" r="45" fill="#00BA1E"></circle>
						</svg>
						<div className="label label-done">{label}</div>
					</div>
				)
			}
		}
		getPackageName(): string {
			const p2: ExpectedPackage.Any = this.props.package as any
			if (p2.type === ExpectedPackage.PackageType.MEDIA_FILE) {
				return p2.content.filePath || unprotectString(this.props.package._id)
			} else if (p2.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
				return p2.content.guid || p2.content.title || unprotectString(this.props.package._id)
			} else {
				assertNever(p2)
				return unprotectString(this.props.package._id)
			}
		}
		render() {
			const { t } = this.props
			const statuses = this.props.statuses.sort((a, b) => {
				if ((a.displayRank ?? 999) > (b.displayRank ?? 999)) return 1
				if ((a.displayRank ?? 999) < (b.displayRank ?? 999)) return -1

				return 0
			})

			return (
				<React.Fragment>
					<tr
						className={ClassNames('package')}
						onClick={(e) => {
							e.preventDefault()
							this.toggleOpen()
						}}
					>
						<td></td>
						<td>{this.getPackageStatus()}</td>
						<td>
							{this.state.isOpen ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
							&nbsp;
							{this.getPackageName()}
						</td>
						<td>
							<DisplayFormattedTime displayTimestamp={this.props.package.created} t={t} />
						</td>
						<td></td>
					</tr>
					{this.state.isOpen
						? statuses.map((status) => {
								return (
									<PackageWorkStatus key={unprotectString(status._id)} status={status} package={this.props.package} />
								)
						  })
						: null}
				</React.Fragment>
			)
		}
	}
)
interface IPackageWorkStatusProps {
	package: ExpectedPackageDB
	status: ExpectedPackageWorkStatus
}
interface PackageWorkStatusState {
	isOpen: boolean
}
const PackageWorkStatus = withTranslation()(
	class PackageWorkStatus extends React.Component<Translated<IPackageWorkStatusProps>, PackageWorkStatusState> {
		constructor(props) {
			super(props)

			this.state = {
				isOpen: false,
			}
		}
		toggleOpen(): void {
			this.setState({
				isOpen: !this.state.isOpen,
			})
		}
		restartExpectation(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, status: ExpectedPackageWorkStatus): void {
			doUserAction(this.props.t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e) =>
				MeteorCall.userAction.packageManagerRestartExpectation(e, status.deviceId, unprotectString(status._id))
			)
		}
		abortExpectation(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, status: ExpectedPackageWorkStatus): void {
			doUserAction(this.props.t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e) =>
				MeteorCall.userAction.packageManagerAbortExpectation(e, status.deviceId, unprotectString(status._id))
			)
		}
		render() {
			const { t } = this.props
			const status = this.props.status
			return (
				<React.Fragment>
					<tr
						key={unprotectString(status._id)}
						className="package-job"
						onClick={(e) => {
							e.preventDefault()
							this.toggleOpen()
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
								<JobStatusIcon status={status} />
							</span>
							<span className="package-job__description">
								{this.state.isOpen ? (
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

					{this.state.isOpen ? (
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
		}
	}
)
interface IJobStatusIconProps {
	status: ExpectedPackageWorkStatus
}
interface JobStatusIconState {
	open: boolean
}

const JobStatusIcon = withTranslation()(
	class JobStatusIcon extends React.Component<Translated<IJobStatusIconProps>, JobStatusIconState> {
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
