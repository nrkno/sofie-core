import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	serializeTimelineBlob,
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineObjGeneric,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JobContext } from '../jobs'
import { CacheBase } from '../cache/CacheBase'
import { ReadonlyDeep } from 'type-fest'
import { Changes } from '../db/changes'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../lib'

export interface CacheForStudioBaseReadonly {
	readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	get Timeline(): TimelineComplete | null

	readonly isMultiGatewayMode: boolean
}

export interface CacheForStudioBase extends CacheForStudioBaseReadonly {
	setTimeline(timelineObjs: TimelineObjGeneric[], generationVersions: TimelineCompleteGenerationVersions): void
}

/**
 * This is a cache used for studio operations.
 */
export class CacheForStudio extends CacheBase<CacheForStudio> implements CacheForStudioBase {
	public readonly isStudio = true

	public readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	public readonly RundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>

	#TimelineHasChanged = false
	#Timeline: TimelineComplete | null
	public get Timeline(): TimelineComplete | null {
		return this.#Timeline
	}

	private constructor(
		context: JobContext,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		rundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>,
		timeline: TimelineComplete | undefined
	) {
		super(context)

		this.PeripheralDevices = peripheralDevices

		this.RundownPlaylists = rundownPlaylists
		this.#Timeline = timeline ?? null
	}

	public get DisplayName(): string {
		return `CacheForStudio`
	}

	static async create(context: JobContext): Promise<CacheForStudio> {
		const span = context.startSpan('CacheForStudio.create')

		const studioId = context.studioId

		const collections = await Promise.all([
			context.directCollections.PeripheralDevices.findFetch({ studioId }),
			context.directCollections.RundownPlaylists.findFetch({ studioId }),
			context.directCollections.Timelines.findOne(studioId),
		])

		const res = new CacheForStudio(context, ...collections)
		if (span) span.end()
		return res
	}

	public getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): ReadonlyDeep<DBRundownPlaylist[]> {
		return this.RundownPlaylists.filter((p) => !!p.activationId && p._id !== excludeRundownPlaylistId)
	}

	protected saveAllCustomHighPrioCollections(): Array<Promise<Changes>> {
		const changes: Array<Promise<Changes>> = []

		if (this.#TimelineHasChanged && this.#Timeline) {
			changes.push(
				this.context.directCollections.Timelines.replace(this.#Timeline).then(() => {
					return {
						added: 0,
						updated: 1,
						removed: 0,
					}
				})
			)
		}

		return changes
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

	setTimeline(timelineObjs: TimelineObjGeneric[], generationVersions: TimelineCompleteGenerationVersions): void {
		this.#Timeline = {
			_id: this.context.studioId,
			timelineHash: getRandomId(), // randomized on every timeline change
			generated: getCurrentTime(),
			timelineBlob: serializeTimelineBlob(timelineObjs),
			generationVersions: generationVersions,
		}
		this.#TimelineHasChanged = true
	}
}
