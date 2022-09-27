import { MappingExt, StudioId } from '../collections/Studios'
import { ProtectedString } from '../lib'

export interface NewStudiosAPI {
	insertStudio(): Promise<StudioId>
	removeStudio(studioId: StudioId): Promise<void>
}

export enum StudiosAPIMethods {
	'insertStudio' = 'studio.insertStudio',
	'removeStudio' = 'studio.removeStudio',
}

export type DBDeviceMappingId = ProtectedString<'DBDeviceMapping'>
export interface DBDeviceMapping {
	_id: DBDeviceMappingId
	studioId: StudioId
	mappings: MappingExt
}
