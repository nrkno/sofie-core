import { TSR } from '@sofie-automation/blueprints-integration'
import { StudioId } from '../collections/Studios'

export interface NewStudiosAPI {
	insertStudio(): Promise<StudioId>
	removeStudio(studioId: StudioId): Promise<void>
}

export enum StudiosAPIMethods {
	'insertStudio' = 'studio.insertStudio',
	'removeStudio' = 'studio.removeStudio',
}
