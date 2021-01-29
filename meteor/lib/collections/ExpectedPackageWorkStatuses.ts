import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { TransformedCollection } from '../typings/meteor'
import { ProtectedString, registerCollection, Time } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ExpectedPackageDBBase, ExpectedPackageId } from './ExpectedPackages'
import { PeripheralDeviceId } from './PeripheralDevices'

export type ExpectedPackageWorkStatusId = ProtectedString<'ExpectedPackageStatusId'>

/**
 * ExpectedPackageWorkStatus contains statuses about Work that is being performed on expected packages
 * This collection is populated by a Package Manager-device.
 */

export interface ExpectedPackageWorkStatus extends Omit<ExpectedPackageStatusAPI.WorkStatus, 'fromPackages'> {
	_id: ExpectedPackageWorkStatusId

	studioId: ExpectedPackageDBBase['studioId']
	fromPackages: {
		id: ExpectedPackageDBBase['_id']
		contentVersionHash: string
	}[]
	// rundownId: ExpectedPackageDBBase['rundownId']
	// pieceId: ExpectedPackageDBBase['pieceId']

	/** Which PeripheralDevice this update came from */
	deviceId: PeripheralDeviceId

	modified: Time
}

export const ExpectedPackageWorkStatuses: TransformedCollection<
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatus
> = createMongoCollection<ExpectedPackageWorkStatus>('expectedPackageWorkStatuses')
registerCollection('ExpectedPackageStatuses', ExpectedPackageWorkStatuses)

registerIndex(ExpectedPackageWorkStatuses, {
	studioId: 1,
	// fromPackages: 1,
})
// registerIndex(ExpectedPackageWorkStatuses, {
// 	deviceId: 1,
// })
