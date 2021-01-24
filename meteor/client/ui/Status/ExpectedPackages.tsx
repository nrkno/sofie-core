import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
} from '../../../lib/collections/ExpectedPackageWorkStatuses'
import { unprotectString } from '../../../lib/lib'
import { ExpectedPackageDB, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import * as VelocityReact from 'velocity-react'

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
				// todo: make this better:
				const packageId = unprotectString(work.fromPackages[0]?.id) || 'N/A'
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
					<div key={packageId} className="package mbs">
						{p.package ? (
							<div className="package__header">
								<div className="workflow__header__progress">
									{/* <VelocityReact.VelocityComponent
										animation={finishedOK ? iconEnterAnimation : iconLeaveAnimation}
										duration={300}
										easing="easeIn">
										<div className="big-status ok">
											<FontAwesomeIcon icon={faCheck} />
										</div>
									</VelocityReact.VelocityComponent>
									<VelocityReact.VelocityComponent
										animation={finishedError ? iconEnterAnimation : iconLeaveAnimation}
										duration={300}
										easing="easeIn">
										<div className="big-status error">
											<WarningIcon />
										</div>
									</VelocityReact.VelocityComponent>
									<VelocityReact.VelocityComponent
										animation={!finishedOK && !finishedError ? iconEnterAnimation : iconLeaveAnimation}
										duration={300}
										easing="easeIn">
										<CircularProgressbar
											value={progress * 100} // TODO: initialAnimation={true} removed, make the animation other way if needed
											text={Math.round(progress * 100) + '%'}
											strokeWidth={10}
											styles={{
												path: { stroke: `#1769ff`, strokeLinecap: 'round' },
												trail: { stroke: '#E0E3E4' },
												text: { fill: '#252627', fontSize: '170%', transform: 'translate(0, 8%)', textAnchor: 'middle' },
											}}
										/>
									</VelocityReact.VelocityComponent>
									<VelocityReact.VelocityComponent
										animation={!finishedOK && !finishedError && keyFinishedOK ? subIconEnterAnimation : subIconLeaveAnimation}
										duration={300}
										easing="easeIn">
										<div className="big-status sub-icon ok">
											<FontAwesomeIcon icon={faCheck} />
										</div>
									</VelocityReact.VelocityComponent> */}
								</div>
								<div className="package__header__summary">
									<div className="package__header__name">
										<div className="package__header__name__name">{p.package._id}</div>
										<div className="package__header__name__content">{JSON.stringify(p.package.content)}</div>
										<div className="package__header__name__version">{JSON.stringify(p.package.version)}</div>
									</div>
									{/* <div>Package: </div>
									<br />
									<div>
										Content: <pre>{}</pre>
									</div>
									<div>
										Version: <pre>{JSON.stringify(p.package.version)}</pre>
									</div>
									<div>
										Sources <pre>{JSON.stringify(p.package.sources)}</pre>
									</div> */}
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
												{status.progress ? `${Math.round(status.progress * 100)}%` : ''}
											</div>
											<div className="package__statuses__status__status">{status.status}</div>
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
