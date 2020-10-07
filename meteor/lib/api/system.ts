import { MethodContext } from './methods'

export interface CollectionCleanupResult {
	collectionName: string
	docsToRemove: number
}

export interface SystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean): Promise<any>
	cleanupOldData(actuallyRemoveOldData: boolean): Promise<CollectionCleanupResult[] | string>

	doSystemBenchmark(): Promise<any>
}

export enum SystemAPIMethods {
	'cleanupIndexes' = 'system.cleanupIndexes',
	'cleanupOldData' = 'system.cleanupOldData',
	'doSystemBenchmark' = 'system.doSystemBenchmark',
}
