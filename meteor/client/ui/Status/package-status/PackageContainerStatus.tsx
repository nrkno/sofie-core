import * as React from 'react'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import Tooltip from 'rc-tooltip'
import { withTranslation } from 'react-i18next'
import { PackageContainerStatusDB } from '../../../../lib/collections/PackageContainerStatus'
import { StatusCodePill } from '../StatusCodePill'
import { doUserAction, UserAction } from '../../../lib/userAction'
import { MeteorCall } from '../../../../lib/api/methods'

interface IPackageContainerStatusProps {
	packageContainerStatus: PackageContainerStatusDB
}

export const PackageContainerStatus = withTranslation()(
	class PackageContainerStatus extends React.Component<Translated<IPackageContainerStatusProps>, {}> {
		constructor(props) {
			super(props)

			this.state = {}
		}

		restartPackageContainer(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
			doUserAction(this.props.t, e, UserAction.PACKAGE_MANAGER_RESTART_PACKAGE_CONTAINER, (e) =>
				MeteorCall.userAction.packageManagerRestartPackageContainer(
					e,
					this.props.packageContainerStatus.deviceId,
					this.props.packageContainerStatus.containerId
				)
			)
		}

		render() {
			const { t } = this.props
			const packageContainerStatus = this.props.packageContainerStatus

			return (
				<>
					<tr className="packageContainer">
						<td></td>
						<td>{packageContainerStatus.containerId}</td>
						<td>
							<StatusCodePill connected={true} statusCode={packageContainerStatus.status.status} />
						</td>
						<td>
							<Tooltip overlay={packageContainerStatus.status.statusReason.tech} placement="top">
								<span>{packageContainerStatus.status.statusReason.user}</span>
							</Tooltip>
						</td>
						<td>
							<button className="btn btn-secondary mls" onClick={(e) => this.restartPackageContainer(e)}>
								{t('Restart')}
							</button>
						</td>
					</tr>
					{Object.entries(packageContainerStatus.status.monitors).map(([monitorId, monitor]) => {
						return (
							<tr className="packageContainer-monitor" key={monitorId}>
								<td></td>
								<td>{monitorId}</td>
								<td>
									<StatusCodePill connected={true} statusCode={monitor.status} />
								</td>
								<td>
									<Tooltip overlay={monitor.statusReason.tech} placement="top">
										<span>{monitor.statusReason.user}</span>
									</Tooltip>
								</td>
								<td></td>
							</tr>
						)
					})}
				</>
			)
		}
	}
)
