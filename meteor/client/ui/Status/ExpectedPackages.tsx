import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
} from '../../../lib/collections/ExpectedPackageWorkStatuses'
import { unprotectString } from '../../../lib/lib'
import { ExpectedPackageDB, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import Tooltip from 'rc-tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo, faStopCircle } from '@fortawesome/free-solid-svg-icons'
import { MeteorCall } from '../../../lib/api/methods'
import { doUserAction, UserAction } from '../../lib/userAction'
import { Studios } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import ClassNames from 'classnames'

interface IExpectedPackagesStatusProps {}

interface IIExpectedPackagesStatusTrackedProps {
	expectedPackageWorkStatuses: ExpectedPackageWorkStatus[]
	expectedPackages: ExpectedPackageDB[]
}

interface IPackageManagerStatusState {
	expanded: {
		[expectedPackaStatuseId: string]: boolean
	}
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
				return (
					<div key={packageId} className="package mbs">
						{p.package ? (
							<div className="package__header">
								<div className="package__header__summary">
									<div className="package__header__name">
										<div className="package__header__name__name">{p.package._id}</div>
										<div className="package__header__name__content">{JSON.stringify(p.package.content)}</div>
										<div className="package__header__name__version">{JSON.stringify(p.package.version)}</div>
									</div>
								</div>
							</div>
						) : (
							<div className="workflow__header">Unknown package "{packageId}"</div>
						)}

						<div className="package__statuses">
							{p.statuses.map((status) => {
								return (
									<div className="package__statuses__status" key={unprotectString(status._id)}>
										<div className="package__statuses__status__labels">
											<div className="package__statuses__status__label">{status.label}</div>
											<div className="package__statuses__status__progress">
												{status.status === 'fulfilled'
													? '100%'
													: status.status === 'working' && status.progress
													? `${Math.round(status.progress * 100)}%`
													: '-'}
											</div>
											<div className="package__statuses__status__status">{status.status}</div>
											<div className="package__statuses__status__actions">
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
											</div>
										</div>
										<div className="package__statuses__status__descriptions">
											<div className="package__statuses__status__description">{status.description}</div>
											<div className="package__statuses__status__reason">{status.statusReason}</div>
										</div>
									</div>
								)
							})}
						</div>
					</div>
				)
			})
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
					<div className="mod mvl">{this.renderExpectedPackageStatusesSummary()}</div>
					<div className="mod mvl">{this.renderExpectedPackageStatuses()}</div>
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
