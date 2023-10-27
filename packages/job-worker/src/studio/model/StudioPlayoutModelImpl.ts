import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	serializeTimelineBlob,
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineObjGeneric,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JobContext } from '../../jobs'
import { ReadonlyDeep } from 'type-fest'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../lib'
import { IS_PRODUCTION } from '../../environment'
import { logger } from '../../logging'
import { StudioPlayoutModel } from './StudioPlayoutModel'
import { DatabasePersistedModel } from '../../modelBase'
import { ExpectedPackageDBFromStudioBaselineObjects } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { StudioBaselineHelper } from './StudioBaselineHelper'

/**
 * This is a model used for studio operations.
 */
export class StudioPlayoutModelImpl implements StudioPlayoutModel {
	readonly #baselineHelper: StudioBaselineHelper
	#disposed = false

	public readonly isStudio = true

	public readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	public readonly RundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>

	#TimelineHasChanged = false
	#Timeline: TimelineComplete | null
	public get Timeline(): TimelineComplete | null {
		return this.#Timeline
	}

	public constructor(
		protected readonly context: JobContext,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		rundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>,
		timeline: TimelineComplete | undefined
	) {
		context.trackCache(this)

		this.#baselineHelper = new StudioBaselineHelper(context)

		this.PeripheralDevices = peripheralDevices

		this.RundownPlaylists = rundownPlaylists
		this.#Timeline = timeline ?? null
	}

	public get DisplayName(): string {
		return `CacheForStudio`
	}

	public getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): ReadonlyDeep<DBRundownPlaylist[]> {
		return this.RundownPlaylists.filter((p) => !!p.activationId && p._id !== excludeRundownPlaylistId)
	}

	#isMultiGatewayMode: boolean | undefined = undefined
	public get isMultiGatewayMode(): boolean {
		if (this.#isMultiGatewayMode === undefined) {
			if (this.context.studio.settings.forceMultiGatewayMode) {
				this.#isMultiGatewayMode = true
			} else {
				const playoutDevices = this.PeripheralDevices.filter(
					(device) => device.type === PeripheralDeviceType.PLAYOUT
				)
				this.#isMultiGatewayMode = playoutDevices.length > 1
			}
		}
		return this.#isMultiGatewayMode
	}

	setExpectedPackagesForStudioBaseline(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void {
		this.#baselineHelper.setExpectedPackages(packages)
	}
	setExpectedPlayoutItemsForStudioBaseline(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#baselineHelper.setExpectedPlayoutItems(playoutItems)
	}

	setTimeline(timelineObjs: TimelineObjGeneric[], generationVersions: TimelineCompleteGenerationVersions): void {
		this.#Timeline = {
			_id: this.context.studioId,
			timelineHash: getRandomId(),
			generated: getCurrentTime(),
			timelineBlob: serializeTimelineBlob(timelineObjs),
			generationVersions: generationVersions,
		}
		this.#TimelineHasChanged = true
	}

	/**
	 * Discards all documents in this cache, and marks it as unusable
	 */
	dispose(): void {
		this.#disposed = true
	}

	async saveAllToDatabase(): Promise<void> {
		if (this.#disposed) {
			throw new Error('Cannot save disposed PlayoutModel')
		}

		const span = this.context.startSpan('StudioPlayoutModelImpl.saveAllToDatabase')

		// Prioritise the timeline for publication reasons
		if (this.#TimelineHasChanged && this.#Timeline) {
			await this.context.directCollections.Timelines.replace(this.#Timeline)
		}
		this.#TimelineHasChanged = false

		await this.#baselineHelper.saveAllToDatabase()

		if (span) span.end()
	}

	/**
	 * Assert that no changes should have been made to the cache, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the cache expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void {
		const span = this.context.startSpan('Cache.assertNoChanges')

		function logOrThrowError(error: Error) {
			if (!IS_PRODUCTION) {
				throw error
			} else {
				logger.error(error)
			}
		}

		if (this.#baselineHelper.hasChanges())
			logOrThrowError(
				new Error(
					`Failed no changes in cache assertion, baseline ExpectedPackages or ExpectedPlayoutItems has changes`
				)
			)

		if (this.#TimelineHasChanged)
			logOrThrowError(new Error(`Failed no changes in cache assertion, Timeline has been changed`))

		if (span) span.end()
	}
}

/**
 * Load a StudioPlayoutModel for the current Studio
 * @param context Context from the job queue
 * @returns Loaded StudioPlayoutModel
 */
export async function loadStudioPlayoutModel(
	context: JobContext
): Promise<StudioPlayoutModel & DatabasePersistedModel> {
	const span = context.startSpan('loadStudioPlayoutModel')

	const studioId = context.studioId

	const collections = await Promise.all([
		context.directCollections.PeripheralDevices.findFetch({ studioId }),
		context.directCollections.RundownPlaylists.findFetch({ studioId }),
		context.directCollections.Timelines.findOne(studioId),
	])

	const res = new StudioPlayoutModelImpl(context, ...collections)
	if (span) span.end()
	return res
}