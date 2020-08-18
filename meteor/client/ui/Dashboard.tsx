import * as React from 'react'
import { withTranslation } from 'react-i18next'
import { MeteorCall } from '../../lib/api/methods'
import { NoticeLevel, Notification, NotificationCenter } from '../lib/notifications/notifications'
import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { statusCodeToString } from './Status/SystemStatus'

const PackageInfo = require('../../package.json')

interface IState {
	systemStatus?: number
}
interface IProps {}
export default withTranslation()(
	class Dashboard extends React.Component<Translated<IProps>, IState> {
		constructor(props) {
			super(props)

			this.state = {}
		}

		componentDidMount() {
			const { t } = this.props

			MeteorCall.systemStatus
				.getSystemStatus()
				.then((status) => {
					this.setState({
						systemStatus: status._status,
					})
				})
				.catch(() => {
					// console.error(err)
					NotificationCenter.push(
						new Notification(
							'systemStatus_failed',
							NoticeLevel.CRITICAL,
							t('Could not get system status. Please consult system administrator.'),
							'Dashboard'
						)
					)
					return
				})
		}

		render() {
			const { t } = this.props

			return (
				<div>
					<div className="mtl gutter">
						<h1>{t('Welcome to the Sofie Automation system')}</h1>
					</div>
					<div className="mtl gutter version-info">
						<p>
							{t('Sofie Automation version')}: {PackageInfo.versionExtended || PackageInfo.version || 'UNSTABLE'},{' '}
							{t('Sofie status')}: {statusCodeToString(t, this.state.systemStatus || 0)}
						</p>
					</div>
				</div>
			)
		}
	}
)
