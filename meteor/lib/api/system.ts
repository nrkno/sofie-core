import { MethodContext } from './methods'

export interface CollectionCleanupResult {
	collectionName: string
	docsToRemove: number
}

export interface NewSystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean): Promise<any>
	cleanupOldData(actuallyRemoveOldData: boolean): Promise<CollectionCleanupResult[] | string>
}

export enum SystemAPIMethods {
	'cleanupIndexes' = 'system.cleanupIndexes',
	'cleanupOldData' = 'system.cleanupOldData',
}
