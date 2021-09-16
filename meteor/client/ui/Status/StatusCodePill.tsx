import * as React from 'react'
import * as reacti18next from 'react-i18next'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { assertNever } from '../../../lib/lib'
import ClassNames from 'classnames'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { statusCodeToString } from './SystemStatus'

interface StatusCodePillProps {
	connected: boolean
	statusCode: StatusCode
	messages?: string[]
}
export const StatusCodePill = reacti18next.withTranslation()(
	class StatusCodePill extends React.Component<StatusCodePillProps & reacti18next.WithTranslation, {}> {
		constructor(props: StatusCodePillProps & reacti18next.WithTranslation) {
			super(props)
		}
		statusCodeString() {
			const { t } = this.props

			return this.props.connected ? statusCodeToString(t, this.props.statusCode) : t('Not Connected')
		}
		statusMessages() {
			const messages = this.props.messages || []
			return messages.length ? '"' + messages.join(', ') + '"' : ''
		}
		getStatusClassName(): string {
			if (!this.props.connected) return 'device-status--unknown'

			switch (this.props.statusCode) {
				case PeripheralDeviceAPI.StatusCode.UNKNOWN:
					return 'device-status--unknown'
				case PeripheralDeviceAPI.StatusCode.GOOD:
					return 'device-status--good'
				case PeripheralDeviceAPI.StatusCode.WARNING_MINOR:
					return 'device-status--minor-warning'
				case PeripheralDeviceAPI.StatusCode.WARNING_MAJOR:
					return 'device-status--warning'
				case PeripheralDeviceAPI.StatusCode.BAD:
					return 'device-status--bad'
				case PeripheralDeviceAPI.StatusCode.FATAL:
					return 'device-status--fatal'
				default:
					assertNever(this.props.statusCode)
					return 'unknown-' + this.props.statusCode
			}
		}
		render() {
			return (
				<div className={ClassNames('device-status', this.getStatusClassName())}>
					<div className="value">
						<span className="pill device-status__label">{this.statusCodeString()}</span>
					</div>
					<div className="device-item__device-status-message">
						<span className="text-s dimmed">{this.statusMessages()}</span>
					</div>
				</div>
			)
		}
	}
)
