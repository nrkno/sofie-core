import { StudioId } from '../collections/Studios'
import { RecordedFileId } from '../collections/RecordedFiles'

export interface NewSystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean): Promise<any>
}

export enum SystemAPIMethods {
	'cleanupIndexes' = 'system.cleanupIndexes',
}
