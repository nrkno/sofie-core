import { StatusCode } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { Component } from '../../../lib/api/systemStatus'
import { status2ExternalStatus } from '../../systemStatus/systemStatus'
import { getUpgradeStatus } from './checkStatus'

export async function getUpgradeSystemStatusMessages(): Promise<Component[]> {
	const result: Component[] = []

	const upgradeStatus = await getUpgradeStatus()
	for (const studioStatus of upgradeStatus.studios) {
		let status = StatusCode.GOOD
		const messages: string[] = []
		if (studioStatus.invalidReason) {
			status = StatusCode.WARNING_MAJOR
			messages.push('Invalid configuration')
		} else if (studioStatus.changes.length) {
			status = StatusCode.WARNING_MINOR
			messages.push('Configuration changed')
		}

		result.push(
			literal<Component>({
				name: `studio-blueprints-upgrade-${studioStatus.studioId}`,
				status: status2ExternalStatus(status),
				updated: new Date().toISOString(),
				_status: status,
				_internal: {
					statusCodeString: StatusCode[status],
					messages: messages,
					versions: {},
				},
			})
		)
	}
	for (const showStyleStatus of upgradeStatus.showStyleBases) {
		let status = StatusCode.GOOD
		const messages: string[] = []
		if (showStyleStatus.invalidReason) {
			status = StatusCode.WARNING_MAJOR
			messages.push('Invalid configuration')
		} else if (showStyleStatus.changes.length) {
			status = StatusCode.WARNING_MINOR
			messages.push('Configuration changed')
		}

		result.push(
			literal<Component>({
				name: `showStyleBase-blueprints-upgrade-${showStyleStatus.showStyleBaseId}`,
				status: status2ExternalStatus(status),
				updated: new Date().toISOString(),
				_status: status,
				_internal: {
					statusCodeString: StatusCode[status],
					messages: messages,
					versions: {},
				},
			})
		)
	}

	return result
}
