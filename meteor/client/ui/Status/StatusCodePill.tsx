import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { assertNever } from '../../../lib/lib'
import ClassNames from 'classnames'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { statusCodeToString } from './SystemStatus'

export const StatusCodePill: React.FC<{
	connected: boolean
	statusCode: StatusCode
	messages?: string[]
}> = function ExpectedPackagesStatus(props) {
	const { t } = useTranslation()

	function statusCodeString() {
		return props.connected ? statusCodeToString(t, props.statusCode) : t('Not Connected')
	}
	function statusMessages() {
		const messages = props.messages || []
		return messages.length ? '"' + messages.join(', ') + '"' : ''
	}
	function getStatusClassName(): string {
		if (!props.connected) return 'device-status--unknown'

		switch (props.statusCode) {
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
				assertNever(props.statusCode)
				return 'unknown-' + props.statusCode
		}
	}

	return (
		<div className={ClassNames('device-status', getStatusClassName())}>
			<div className="value">
				<span className="pill device-status__label">{statusCodeString()}</span>
			</div>
			<div className="device-item__device-status-message">
				<span className="text-s dimmed">{statusMessages()}</span>
			</div>
		</div>
	)
}
