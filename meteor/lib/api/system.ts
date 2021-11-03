import { TranslationsBundle, TranslationsBundleId } from '../collections/TranslationsBundles'
import { ClientAPI } from './client'

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

export interface PerformanceTestResult {
	label: string
	description: string

	/** Average result */
	valueMean: number

	/** The highest 95% percentile */
	valueMax95: number
	/** The lowest 95% percentile */
	valueMin95: number

	valueMax: number
	valueMin: number

	/** How many times the test was run */
	count: number

	/** Baseline: This is a value for what is a "normal" result for the test. */
	baseline: number
}

export interface SystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean): Promise<any>
	cleanupOldData(actuallyRemoveOldData: boolean): Promise<CollectionCleanupResult[] | string>

	doSystemBenchmark(): Promise<SystemBenchmarkResults>
	runPerformanceTests(): Promise<PerformanceTestResult[]>

	getTranslationBundle(bundleId: TranslationsBundleId): Promise<ClientAPI.ClientResponse<TranslationsBundle>>
}

export enum SystemAPIMethods {
	'cleanupIndexes' = 'system.cleanupIndexes',
	'cleanupOldData' = 'system.cleanupOldData',
	'doSystemBenchmark' = 'system.doSystemBenchmark',
	'runPerformanceTests' = 'system.runPerformanceTests',
	'getTranslationBundle' = 'system.getTranslationBundle',
}
