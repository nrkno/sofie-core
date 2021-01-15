import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
} from '../../../lib/collections/ExpectedPackageStatuses'
import { unprotectString } from '../../../lib/lib'
import { ExpectedPackageDB, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { stat } from 'fs'

interface IExpectedPackagesStatusProps {}

interface IIExpectedPackagesStatusTrackedProps {
	expectedPackageWorkStatuses: ExpectedPackageWorkStatus[]
	expectedPackages: ExpectedPackageDB[]
}

interface IMediaManagerStatusState {
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
	class MediaManagerStatus extends MeteorReactComponent<
		Translated<IExpectedPackagesStatusProps & IIExpectedPackagesStatusTrackedProps>,
		IMediaManagerStatusState
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
			const { t, i18n, tReady } = this.props

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
				const packageId = unprotectString(work.packageId)
				const referencedPackage = packageRef[packageId]
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
				packagesWithWorkStatuses[id].statuses.sort((a, b) => {
					if ((a.displayRank || 0) > (b.displayRank || 0)) return 1
					if ((a.displayRank || 0) < (b.displayRank || 0)) return -1

					if (a.requiredForPlayout && !b.requiredForPlayout) return 1
					if (!a.requiredForPlayout && b.requiredForPlayout) return -1

					if (a.label > b.label) return 1
					if (a.label < b.label) return -1

					return 0
				})
			}

			return Object.keys(packagesWithWorkStatuses).map((packageId) => {
				const p = packagesWithWorkStatuses[packageId]
				return (
					<div key={packageId} className="package">
						{p.package ? (
							<div className="package__header">
								<div>Package: {p.package._id}</div>
								<br />
								<div>
									Content: <pre>{JSON.stringify(p.package.content)}</pre>
								</div>
								<div>
									Version: <pre>{JSON.stringify(p.package.version)}</pre>
								</div>
								<div>
									Sources <pre>{JSON.stringify(p.package.sources)}</pre>
								</div>
							</div>
						) : (
							<div className="workflow__header">Unknown package "{packageId}"</div>
						)}

						<div>
							{p.statuses.map((status) => {
								return (
									<div className="package-status" key={unprotectString(status._id)}>
										<div>Expectation "{status.label}"</div>
										<div>
											<i>{status.description}</i>
										</div>
										<div>
											Progress: <b>{Math.round((status.progress || 0) * 100)} %</b>
										</div>
										<div>
											Status: <b>{status.status}</b>
										</div>
										<div>
											Status reason: <i>{status.statusReason}</i>
										</div>
									</div>
								)
							})}
						</div>
					</div>
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
					<div className="mod mvl">{this.renderExpectedPackageStatuses()}</div>
				</div>
			)
		}
	}
)
