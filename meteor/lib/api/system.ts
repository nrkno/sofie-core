import { MethodContext } from './methods'

export interface CollectionCleanupResult {
	collectionName: string
	docsToRemove: number
}

export interface BenchmarkResult {
	mongoWriteSmall: number
	mongoWriteBig: number
	mongoRead: number
	mongoIndexedRead: number
	cpuCalculations: number
	cpuStringifying: number
}
export interface SystemBenchmarkResults {
	description: string
	results: BenchmarkResult
}

export interface SystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean): Promise<any>
	cleanupOldData(actuallyRemoveOldData: boolean): Promise<CollectionCleanupResult[] | string>

	doSystemBenchmark(): Promise<SystemBenchmarkResults>
}

export enum SystemAPIMethods {
	'cleanupIndexes' = 'system.cleanupIndexes',
	'cleanupOldData' = 'system.cleanupOldData',
	'doSystemBenchmark' = 'system.doSystemBenchmark',
}
