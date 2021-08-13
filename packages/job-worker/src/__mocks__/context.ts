import {
	StudioId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DEFAULT_SETTINGS, ISettings } from '@sofie-automation/corelib/dist/settings'
import { EventsJobFunc } from '@sofie-automation/corelib/dist/worker/events'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { WrappedStudioBlueprint, WrappedShowStyleBlueprint } from '../blueprints/cache'
import {
	ProcessedStudioConfig,
	ProcessedShowStyleConfig,
	preprocessStudioConfig,
	preprocessShowStyleConfig,
} from '../blueprints/config'
import { ReadOnlyCacheBase } from '../cache/CacheBase'
import { PlaylistLock } from '../jobs/lock'
import { ReadonlyDeep } from 'type-fest'
import { ApmSpan, JobContext } from '../jobs'
import { createShowStyleCompound } from '../showStyles'
import { getMockCollections } from './collection'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { IDirectCollections } from '../db'
import {
	BlueprintManifestType,
	BlueprintResultPart,
	BlueprintResultRundown,
	BlueprintResultSegment,
	IBlueprintAdLibPiece,
	IBlueprintPart,
	IBlueprintPiece,
	IBlueprintRundown,
	IBlueprintSegment,
	IngestRundown,
	IngestSegment,
	ISegmentUserContext,
	IShowStyleContext,
	ShowStyleBlueprintManifest,
	StudioBlueprintManifest,
} from '../../../blueprints-integration/dist'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
// import _ = require('underscore')
import { defaultStudio } from './defaultCollectionObjects'

export function setupDefaultJobEnvironment(studioId?: StudioId): MockJobContext {
	const collections = getMockCollections()

	const studio: DBStudio = {
		...defaultStudio(studioId ?? protectString('mockStudio0')),
		name: 'mockStudio',
		_rundownVersionHash: 'asdf',
		blueprintId: protectString('studioBlueprint0'),
	}

	return new MockJobContext(collections, studio)
}

export class MockJobContext implements JobContext {
	#collections: Readonly<IDirectCollections>
	#settings: ISettings
	#studio: ReadonlyDeep<DBStudio>

	#studioBlueprint: StudioBlueprintManifest
	#showStyleBlueprint: ShowStyleBlueprintManifest

	constructor(collections: Readonly<IDirectCollections>, studio: ReadonlyDeep<DBStudio>) {
		this.#collections = collections
		this.#settings = clone(DEFAULT_SETTINGS)
		this.#studio = studio

		this.#studioBlueprint = MockStudioBlueprint()
		this.#showStyleBlueprint = MockShowStyleBlueprint()
	}

	get directCollections(): Readonly<IDirectCollections> {
		return this.#collections
	}

	get settings(): ReadonlyDeep<ISettings> {
		return this.#settings
	}

	get studioId(): StudioId {
		return this.#studio._id
	}
	get studio(): ReadonlyDeep<DBStudio> {
		return this.#studio
	}

	get studioBlueprint(): ReadonlyDeep<WrappedStudioBlueprint> {
		return {
			blueprintId: this.studio.blueprintId || protectString('fake'),
			blueprint: this.#studioBlueprint,
		}
	}

	trackCache(_cache: ReadOnlyCacheBase<any>): void {
		// TODO
		// throw new Error('Method not implemented.')
	}
	async lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock> {
		return new MockPlaylistLock(playlistId)
	}

	startSpan(_name: string): ApmSpan | null {
		// no-op
		return null
	}

	async queueIngestJob<T extends keyof IngestJobFunc>(
		_name: T,
		_data: Parameters<IngestJobFunc[T]>[0]
	): Promise<void> {
		throw new Error('Method not implemented.')
	}
	async queueStudioJob<T extends keyof StudioJobFunc>(
		_name: T,
		_data: Parameters<StudioJobFunc[T]>[0]
	): Promise<void> {
		throw new Error('Method not implemented.')
	}
	async queueEventJob<T extends keyof EventsJobFunc>(
		_name: T,
		_data: Parameters<EventsJobFunc[T]>[0]
	): Promise<void> {
		throw new Error('Method not implemented.')
	}

	getStudioBlueprintConfig(): ProcessedStudioConfig {
		return preprocessStudioConfig(this.studio, this.#studioBlueprint)
	}
	async getShowStyleBase(id: ShowStyleBaseId): Promise<DBShowStyleBase> {
		const style = await this.directCollections.ShowStyleBases.findOne(id)
		if (!style) throw new Error(`ShowStyleBase "${id}" Not found!`)
		return style
	}
	async getShowStyleVariant(id: ShowStyleVariantId): Promise<DBShowStyleVariant> {
		const style = await this.directCollections.ShowStyleVariants.findOne(id)
		if (!style) throw new Error(`ShowStyleVariant "${id}" Not found!`)
		return style
	}
	async getShowStyleCompound(variantId: ShowStyleVariantId, baseId?: ShowStyleBaseId): Promise<ShowStyleCompound> {
		const [variant, base0] = await Promise.all([
			this.getShowStyleVariant(variantId),
			baseId ? this.getShowStyleBase(baseId) : null,
		])

		const base = base0 ?? (await this.getShowStyleBase(variant.showStyleBaseId))

		const compound = createShowStyleCompound(base, variant)

		if (!compound) {
			throw new Error(`Failed to compile ShowStyleCompound for base "${base._id}" and variant  "${variant._id}"`)
		}

		return compound
	}
	async getShowStyleBlueprint(id: ShowStyleBaseId): Promise<WrappedShowStyleBlueprint> {
		const showStyle = await this.getShowStyleBase(id)

		return {
			blueprintId: showStyle.blueprintId,
			blueprint: this.#showStyleBlueprint,
		}
	}
	getShowStyleBlueprintConfig(showStyle: ReadonlyDeep<ShowStyleCompound>): ProcessedShowStyleConfig {
		return preprocessShowStyleConfig(showStyle, this.#showStyleBlueprint)
	}

	/**
	 * Mock methods
	 */

	setStudio(studio: ReadonlyDeep<DBStudio>): void {
		this.#studio = clone(studio)
	}

	get mutableSettings(): ISettings {
		return this.#settings
	}
}

const MockStudioBlueprint: () => StudioBlueprintManifest = () => ({
	blueprintType: BlueprintManifestType.STUDIO,
	blueprintVersion: '0.0.0',
	integrationVersion: '0.0.0',
	TSRVersion: '0.0.0',

	studioConfigManifest: [],
	studioMigrations: [],
	getBaseline: () => {
		return {
			timelineObjects: [],
		}
	},
	getShowStyleId: (_context, showStyles): string | null => {
		return showStyles[0]._id
	},
})

const MockShowStyleBlueprint: () => ShowStyleBlueprintManifest = () => ({
	blueprintType: BlueprintManifestType.SHOWSTYLE,
	blueprintVersion: '0.0.0',
	integrationVersion: '0.0.0',
	TSRVersion: '0.0.0',

	showStyleConfigManifest: [],
	showStyleMigrations: [],
	getShowStyleVariantId: (_context, variants): string | null => {
		return variants[0]._id
	},
	getRundown: (_context: IShowStyleContext, ingestRundown: IngestRundown): BlueprintResultRundown => {
		const rundown: IBlueprintRundown = {
			externalId: ingestRundown.externalId,
			name: ingestRundown.name,
			// expectedStart?:
			// expectedDuration?: number;
			metaData: ingestRundown.payload,
		}

		// Allow the rundown to specify a playlistExternalId that should be used
		const playlistId = ingestRundown.payload?.ForcePlaylistExternalId
		if (playlistId) rundown.playlistExternalId = playlistId

		return {
			rundown,
			globalAdLibPieces: [],
			baseline: { timelineObjects: [] },
		}
	},
	getSegment: (_context: ISegmentUserContext, ingestSegment: IngestSegment): BlueprintResultSegment => {
		const segment: IBlueprintSegment = {
			name: ingestSegment.name ? ingestSegment.name : ingestSegment.externalId,
			metaData: ingestSegment.payload,
		}
		const parts: BlueprintResultPart[] = []

		for (const ingestPart of ingestSegment.parts) {
			const part: IBlueprintPart = {
				externalId: ingestPart.externalId,
				title: ingestPart.name,
				metaData: ingestPart.payload,
				// autoNext?: boolean;
				// autoNextOverlap?: number;
				// prerollDuration?: number;
				// transitionPrerollDuration?: number | null;
				// transitionKeepaliveDuration?: number | null;
				// transitionDuration?: number | null;
				// disableOutTransition?: boolean;
				// expectedDuration?: number;
				// holdMode?: PartHoldMode;
				// updateStoryStatus?: boolean;
				// classes?: string[];
				// classesForNext?: string[];
				// displayDurationGroup?: string;
				// displayDuration?: number;
				// invalid?: boolean
			}
			const pieces: IBlueprintPiece[] = ingestPart.payload?.pieces ?? []
			const adLibPieces: IBlueprintAdLibPiece[] = []
			parts.push({
				part,
				pieces,
				adLibPieces,
			})
		}

		return {
			segment,
			parts,
		}
	},
	// onRundownActivate?: (context: EventContext & RundownContext) => Promise<void>,
	// onRundownFirstTake?: (context: EventContext & PartEventContext) => Promise<void>,
	// onRundownDeActivate?: (context: EventContext & RundownContext) => Promise<void>,
	// onPreTake?: (context: EventContext & PartEventContext) => Promise<void>,
	// onPostTake?: (context: EventContext & PartEventContext) => Promise<void>,
	// onTimelineGenerate?: (context: EventContext & RundownContext, timeline: Timeline.TimelineObject[]) => Promise<Timeline.TimelineObject[]>,
	// onAsRunEvent?: (context: EventContext & AsRunEventContext) => Promise<IBlueprintExternalMessageQueueObj[]>,
})

class MockPlaylistLock extends PlaylistLock {
	#locked = true

	constructor(playlistId: RundownPlaylistId) {
		super(playlistId)
	}

	get isLocked(): boolean {
		return this.#locked
	}
	async release(): Promise<void> {
		if (!this.#locked) throw new Error('Already unlocked!')
		this.#locked = false
	}
}
