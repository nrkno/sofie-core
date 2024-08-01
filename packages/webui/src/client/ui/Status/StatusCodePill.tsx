import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { assertNever } from '../../lib/tempLib'
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
			case StatusCode.UNKNOWN:
				return 'device-status--unknown'
			case StatusCode.GOOD:
				return 'device-status--good'
			case StatusCode.WARNING_MINOR:
				return 'device-status--minor-warning'
			case StatusCode.WARNING_MAJOR:
				return 'device-status--warning'
			case StatusCode.BAD:
				return 'device-status--bad'
			case StatusCode.FATAL:
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
				<span className="text-s dimmed field-hint">{statusMessages()}</span>
			</div>
		</div>
	)
}
