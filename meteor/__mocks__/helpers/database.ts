import * as _ from 'underscore'
import {
	PeripheralDevices,
	PeripheralDevice,
	PeripheralDeviceType,
	PeripheralDeviceCategory,
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDeviceSubType,
} from '../../lib/collections/PeripheralDevices'
import { Studio, Studios, DBStudio } from '../../lib/collections/Studios'
import {
	PieceLifespan,
	IOutputLayer,
	ISourceLayer,
	SourceLayerType,
	StudioBlueprintManifest,
	BlueprintManifestType,
	IngestRundown,
	BlueprintManifestBase,
	ShowStyleBlueprintManifest,
	IShowStyleContext,
	BlueprintResultRundown,
	BlueprintResultSegment,
	IngestSegment,
	IBlueprintAdLibPiece,
	IBlueprintRundown,
	IBlueprintSegment,
	BlueprintResultPart,
	IBlueprintPart,
	IBlueprintPiece,
	TriggerType,
	PlayoutActions,
	StatusCode,
	IBlueprintPieceType,
	IBlueprintActionManifest,
} from '@sofie-automation/blueprints-integration'
import { ShowStyleBase, ShowStyleBases, DBShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, DBShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Blueprint } from '../../lib/collections/Blueprints'
import { ICoreSystem, CoreSystem, SYSTEM_ID, stripVersion } from '../../lib/collections/CoreSystem'
import { internalUploadBlueprint } from '../../server/api/blueprints/api'
import {
	literal,
	getCurrentTime,
	protectString,
	unprotectString,
	getRandomId,
	getRandomString,
	Complete,
	normalizeArray,
} from '../../lib/lib'
import { DBRundown, Rundowns } from '../../lib/collections/Rundowns'
import { DBSegment, Segments } from '../../lib/collections/Segments'
import { DBPart, Parts } from '../../lib/collections/Parts'
import { EmptyPieceTimelineObjectsBlob, Piece, Pieces, PieceStatusCode } from '../../lib/collections/Pieces'
import { DBRundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { AdLibPiece, AdLibPieces } from '../../lib/collections/AdLibPieces'
import { restartRandomId } from '../random'
import { MongoMock } from '../mongo'
import {
	defaultRundownPlaylist,
	defaultRundown,
	defaultSegment,
	defaultPart,
	defaultPiece,
	defaultAdLibPiece,
	defaultStudio,
} from '../defaultCollectionObjects'
import { PackageInfo } from '../../server/coreSystem'
import { DBTriggeredActions, TriggeredActions } from '../../lib/collections/TriggeredActions'
import { Workers, WorkerStatus } from '../../lib/collections/Workers'
import { WorkerThreadStatuses } from '../../lib/collections/WorkerThreads'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import {
	applyAndValidateOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { UIShowStyleBase } from '../../lib/api/showStyles'
import {
	BlueprintId,
	OrganizationId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TSR_VERSION } from '@sofie-automation/shared-lib/dist/tsr'

export enum LAYER_IDS {
	SOURCE_CAM0 = 'cam0',
	SOURCE_VT0 = 'vt0',
	SOURCE_TRANSITION0 = 'transition0',
	SOURCE_GRAPHICS0 = 'graphics0',
	OUTPUT_PGM = 'pgm',
}

function getBlueprintDependencyVersions(): { TSR_VERSION: string; INTEGRATION_VERSION: string } {
	const INTEGRATION_VERSION =
		require('../../node_modules/@sofie-automation/blueprints-integration/package.json').version

	return {
		INTEGRATION_VERSION,
		TSR_VERSION,
	}
}

let dbI: number = 0
export function setupMockPeripheralDevice(
	category: PeripheralDeviceCategory,
	type: PeripheralDeviceType,
	subType: PeripheralDeviceSubType,
	studio?: Pick<Studio, '_id'>,
	doc?: Partial<PeripheralDevice>
) {
	doc = doc || {}

	const defaultDevice: PeripheralDevice = {
		_id: protectString('mockDevice' + dbI++),
		name: 'mockDevice',
		organizationId: null,
		studioId: studio ? studio._id : undefined,
		settings: {},

		category: category,
		type: type,
		subType: subType,

		created: 1234,
		status: {
			statusCode: StatusCode.GOOD,
		},
		lastSeen: 1234,
		lastConnected: 1234,
		connected: true,
		connectionId: 'myConnectionId',
		token: 'mockToken',
		configManifest: {
			deviceConfig: [],
		},
		versions: {
			'@sofie-automation/server-core-integration': stripVersion(PackageInfo.version),
		},
	}
	const device: PeripheralDevice = _.extend(defaultDevice, doc)
	PeripheralDevices.insert(device)
	return device
}
export function setupMockCore(doc?: Partial<ICoreSystem>): ICoreSystem {
	// Reset everything mongo, to keep the ids predictable
	restartRandomId()
	MongoMock.deleteAllData()

	doc = doc || {}

	const defaultCore: ICoreSystem = {
		_id: SYSTEM_ID,
		name: 'mock Core',
		created: 0,
		modified: 0,
		version: '0.0.0',
		previousVersion: '0.0.0',
		serviceMessages: {},
	}
	const coreSystem = _.extend(defaultCore, doc)
	CoreSystem.remove(SYSTEM_ID)
	CoreSystem.insert(coreSystem)
	return coreSystem
}
export function setupMockTriggeredActions(
	showStyleBaseId: ShowStyleBaseId | null = null,
	num: number = 3,
	doc?: Partial<DBTriggeredActions>
): DBTriggeredActions[] {
	doc = doc || {}
	const mocks: DBTriggeredActions[] = []
	for (let i = 0; i < num; i++) {
		const mock: DBTriggeredActions = {
			_id: protectString(`mockTriggeredAction_${showStyleBaseId ?? 'core'}` + i),
			_rank: i * 1000,
			showStyleBaseId,
			blueprintUniqueId: null,
			actionsWithOverrides: wrapDefaultObject({
				'0': {
					action: PlayoutActions.adlib,
					filterChain: [
						{
							object: 'adLib',
							field: 'global',
							value: true,
						},
						{
							object: 'adLib',
							field: 'pick',
							value: i,
						},
					],
				},
			}),
			triggersWithOverrides: wrapDefaultObject({
				'0': {
					type: TriggerType.hotkey,
					keys: `Key${String.fromCharCode(65 + i)}`, // KeyA and so on
				},
			}),
			...doc,
		}
		mocks.push(mock)
		TriggeredActions.insert(mock)
	}
	return mocks
}
export function setupMockStudio(doc?: Partial<DBStudio>): Studio {
	doc = doc || {}

	const studio: DBStudio = {
		...defaultStudio(protectString('mockStudio' + dbI++)),
		name: 'mockStudio',
		_rundownVersionHash: 'asdf',
		...doc,
	}
	Studios.insert(studio)
	return studio
}
export function setupMockShowStyleBase(blueprintId: BlueprintId, doc?: Partial<ShowStyleBase>): ShowStyleBase {
	doc = doc || {}

	const defaultShowStyleBase: DBShowStyleBase = {
		_id: protectString('mockShowStyleBase' + dbI++),
		name: 'mockShowStyleBase',
		organizationId: null,
		outputLayersWithOverrides: wrapDefaultObject(
			normalizeArray(
				[
					literal<IOutputLayer>({
						_id: LAYER_IDS.OUTPUT_PGM,
						_rank: 0,
						isPGM: true,
						name: 'PGM',
					}),
				],
				'_id'
			)
		),
		sourceLayersWithOverrides: wrapDefaultObject(
			normalizeArray(
				[
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_CAM0,
						_rank: 0,
						name: 'Camera',
						type: SourceLayerType.CAMERA,
						exclusiveGroup: 'main',
					}),
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_VT0,
						_rank: 1,
						name: 'VT',
						type: SourceLayerType.VT,
						exclusiveGroup: 'main',
					}),
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_TRANSITION0,
						_rank: 2,
						name: 'Transition',
						type: SourceLayerType.TRANSITION,
					}),
					literal<ISourceLayer>({
						_id: LAYER_IDS.SOURCE_GRAPHICS0,
						_rank: 3,
						name: 'Graphic',
						type: SourceLayerType.GRAPHICS,
					}),
				],
				'_id'
			)
		),
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		blueprintId: blueprintId,
		// hotkeyLegend?: Array<HotkeyDefinition>
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
	}
	const showStyleBase = _.extend(defaultShowStyleBase, doc)
	ShowStyleBases.insert(showStyleBase)
	return showStyleBase
}
export function setupMockShowStyleVariant(
	showStyleBaseId: ShowStyleBaseId,
	doc?: Partial<ShowStyleVariant>
): ShowStyleVariant {
	doc = doc || {}

	const defaultShowStyleVariant: DBShowStyleVariant = {
		_id: protectString('mockShowStyleVariant' + dbI++),
		name: 'mockShowStyleVariant',
		showStyleBaseId: showStyleBaseId,
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		_rank: 0,
	}
	const showStyleVariant = _.extend(defaultShowStyleVariant, doc)
	ShowStyleVariants.insert(showStyleVariant)

	return showStyleVariant
}

export function packageBlueprint<T extends BlueprintManifestBase>(
	constants: { [constant: string]: string | number },
	blueprintFcn: () => T
): string {
	let code = blueprintFcn.toString()
	_.each(constants, (newConstant, constant) => {
		if (_.isString(newConstant)) {
			newConstant = newConstant.replace(/^\^/, '') || '0.0.0' // fix the version, the same way the bleprint does it
			newConstant = `'${newConstant}'`
		} else {
			newConstant = `${newConstant}`
		}

		code = code.replace(new RegExp(constant, 'g'), newConstant)
	})
	return `({default: (${code})()})`
}
export async function setupMockStudioBlueprint(
	showStyleBaseId: ShowStyleBaseId,
	organizationId: OrganizationId | null = null
): Promise<Blueprint> {
	const { INTEGRATION_VERSION, TSR_VERSION } = getBlueprintDependencyVersions()

	const BLUEPRINT_TYPE = BlueprintManifestType.STUDIO
	const SHOW_STYLE_ID: string = unprotectString(showStyleBaseId)

	const code = packageBlueprint<StudioBlueprintManifest>(
		{
			// Constants to into code:
			BLUEPRINT_TYPE,
			INTEGRATION_VERSION,
			TSR_VERSION,
			SHOW_STYLE_ID,
		},
		function (): StudioBlueprintManifest {
			return {
				blueprintType: BLUEPRINT_TYPE,
				blueprintVersion: '0.0.0',
				integrationVersion: INTEGRATION_VERSION,
				TSRVersion: TSR_VERSION,

				configPresets: {
					main: {
						name: 'Main',
						config: {},
					},
				},

				studioConfigManifest: [],
				studioMigrations: [],
				getBaseline: () => {
					return {
						timelineObjects: [],
					}
				},
				getShowStyleId: (): string | null => {
					return SHOW_STYLE_ID
				},
			}
		}
	)

	const blueprintId: BlueprintId = protectString('mockBlueprint' + dbI++)
	const blueprintName = 'mockBlueprint'

	return internalUploadBlueprint(blueprintId, code, blueprintName, true, organizationId)
}
export async function setupMockShowStyleBlueprint(
	showStyleVariantId: ShowStyleVariantId,
	organizationId?: OrganizationId | null
): Promise<Blueprint> {
	const { INTEGRATION_VERSION, TSR_VERSION } = getBlueprintDependencyVersions()

	const BLUEPRINT_TYPE = BlueprintManifestType.SHOWSTYLE
	const SHOW_STYLE_VARIANT_ID: string = unprotectString(showStyleVariantId)

	const code = packageBlueprint<ShowStyleBlueprintManifest>(
		{
			// Constants to into code:
			BLUEPRINT_TYPE,
			INTEGRATION_VERSION,
			TSR_VERSION,
			SHOW_STYLE_VARIANT_ID,
		},
		function (): ShowStyleBlueprintManifest {
			return {
				blueprintType: BLUEPRINT_TYPE,
				blueprintVersion: '0.0.0',
				integrationVersion: INTEGRATION_VERSION,
				TSRVersion: TSR_VERSION,

				configPresets: {
					main: {
						name: 'Main',
						config: {},

						variants: {
							main: {
								name: 'Default',
								config: {},
							},
						},
					},
				},

				showStyleConfigManifest: [],
				showStyleMigrations: [],
				getShowStyleVariantId: (): string | null => {
					return SHOW_STYLE_VARIANT_ID
				},
				getRundown: (_context: IShowStyleContext, ingestRundown: IngestRundown): BlueprintResultRundown => {
					const rundown: IBlueprintRundown = {
						externalId: ingestRundown.externalId,
						name: ingestRundown.name,
						// expectedStart?:
						// expectedDuration?: number;
						metaData: ingestRundown.payload,
						timing: {
							type: 'none' as any,
						},
					}

					// Allow the rundown to specify a playlistExternalId that should be used
					const playlistId = ingestRundown.payload?.ForcePlaylistExternalId
					if (playlistId) rundown.playlistExternalId = playlistId

					return {
						rundown,
						globalAdLibPieces: [],
						globalActions: [],
						baseline: { timelineObjects: [] },
					}
				},
				getSegment: (_context: unknown, ingestSegment: IngestSegment): BlueprintResultSegment => {
					const segment: IBlueprintSegment = {
						name: ingestSegment.name ? ingestSegment.name : ingestSegment.externalId,
						metaData: ingestSegment.payload,
						isHidden: ingestSegment.payload?.hidden,
					}
					const parts: BlueprintResultPart[] = []

					_.each(ingestSegment.parts, (ingestPart) => {
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
						const actions: IBlueprintActionManifest[] = []
						parts.push({
							part,
							pieces,
							adLibPieces,
							actions,
						})
					})
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
			}
		}
	)

	const blueprintId: BlueprintId = protectString('mockBlueprint' + dbI++)
	const blueprintName = 'mockBlueprint'

	return internalUploadBlueprint(blueprintId, code, blueprintName, true, organizationId)
}
export interface DefaultEnvironment {
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantId: ShowStyleVariantId
	studioBlueprint: Blueprint
	showStyleBlueprint: Blueprint
	showStyleBase: ShowStyleBase
	triggeredActions: DBTriggeredActions[]
	showStyleVariant: ShowStyleVariant
	studio: Studio
	core: ICoreSystem
	systemTriggeredActions: DBTriggeredActions[]

	workers: WorkerStatus[]
	workerThreadStatuses: WorkerThreadStatus[]

	ingestDevice: PeripheralDevice
}
export async function setupDefaultStudioEnvironment(
	organizationId: OrganizationId | null = null
): Promise<DefaultEnvironment> {
	const core = setupMockCore({})
	const systemTriggeredActions = setupMockTriggeredActions()

	const showStyleBaseId: ShowStyleBaseId = getRandomId()
	const showStyleVariantId: ShowStyleVariantId = getRandomId()

	const studioBlueprint = await setupMockStudioBlueprint(showStyleBaseId, organizationId)
	const showStyleBlueprint = await setupMockShowStyleBlueprint(showStyleVariantId, organizationId)

	const showStyleBase = setupMockShowStyleBase(showStyleBlueprint._id, {
		_id: showStyleBaseId,
		organizationId: organizationId,
	})
	const triggeredActions = setupMockTriggeredActions(showStyleBase._id)
	const showStyleVariant = setupMockShowStyleVariant(showStyleBase._id, { _id: showStyleVariantId })

	const studio = setupMockStudio({
		blueprintId: studioBlueprint._id,
		supportedShowStyleBase: [showStyleBaseId],
		organizationId: organizationId,
	})
	const ingestDevice = setupMockPeripheralDevice(
		PeripheralDeviceCategory.INGEST,
		PeripheralDeviceType.MOS,
		PERIPHERAL_SUBTYPE_PROCESS,
		studio,
		{ organizationId: organizationId }
	)
	const { worker, workerThreadStatuses } = setupMockWorker()

	return {
		showStyleBaseId,
		showStyleVariantId,
		studioBlueprint,
		showStyleBlueprint,
		showStyleBase,
		triggeredActions,
		showStyleVariant,
		studio,
		core,
		systemTriggeredActions: systemTriggeredActions,
		ingestDevice,
		workers: [worker],
		workerThreadStatuses,
	}
}
export function setupDefaultRundownPlaylist(
	env: DefaultEnvironment,
	rundownId0?: RundownId,
	customRundownFactory?: (env: DefaultEnvironment, playlistId: RundownPlaylistId, rundownId: RundownId) => RundownId
): { rundownId: RundownId; playlistId: RundownPlaylistId } {
	const rundownId: RundownId = rundownId0 || getRandomId()

	const playlist: DBRundownPlaylist = defaultRundownPlaylist(protectString('playlist_' + rundownId), env.studio._id)

	const playlistId = RundownPlaylists.insert(playlist)

	return {
		rundownId: (customRundownFactory || setupDefaultRundown)(env, playlistId, rundownId),
		playlistId,
	}
}
export function setupEmptyEnvironment() {
	const core = setupMockCore({})

	return {
		core,
	}
}
export function setupDefaultRundown(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const outputLayerIds = Object.keys(applyAndValidateOverrides(env.showStyleBase.outputLayersWithOverrides).obj)
	const sourceLayerIds = Object.keys(applyAndValidateOverrides(env.showStyleBase.sourceLayersWithOverrides).obj)

	const rundown: DBRundown = {
		peripheralDeviceId: env.ingestDevice._id,
		organizationId: null,
		studioId: env.studio._id,
		showStyleBaseId: env.showStyleBase._id,
		showStyleVariantId: env.showStyleVariant._id,
		timing: {
			type: 'none' as any,
		},

		playlistId: playlistId,

		_id: rundownId,
		externalId: 'MOCK_RUNDOWN_' + rundownId,
		name: 'Default Rundown',

		created: getCurrentTime(),
		modified: getCurrentTime(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		externalNRCSName: 'mock',
	}
	Rundowns.insert(rundown)

	RundownPlaylists.update(playlistId, {
		$push: {
			rundownIdsInOrder: rundown._id,
		},
	})

	const segment0: DBSegment = {
		_id: protectString(rundownId + '_segment0'),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundown._id,
		name: 'Segment 0',
		externalModified: 1,
	}
	Segments.insert(segment0)
	/* tslint:disable:ter-indent*/
	//
	const part00: DBPart = {
		_id: protectString(rundownId + '_part0_0'),
		segmentId: segment0._id,
		rundownId: rundown._id,
		_rank: 0,
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',
		expectedDurationWithPreroll: undefined,
	}
	Parts.insert(part00)

	const piece000: Piece = {
		_id: protectString(rundownId + '_piece000'),
		externalId: 'MOCK_PIECE_000',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 000',
		status: PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	Pieces.insert(piece000)

	const piece001: Piece = {
		_id: protectString(rundownId + '_piece001'),
		externalId: 'MOCK_PIECE_001',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 001',
		status: PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	Pieces.insert(piece001)

	const adLibPiece000: AdLibPiece = {
		_id: protectString(rundownId + '_adLib000'),
		_rank: 0,
		expectedDuration: 1000,
		lifespan: PieceLifespan.WithinPart,
		externalId: 'MOCK_ADLIB_000',
		partId: part00._id,
		rundownId: segment0.rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'AdLib 0',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	AdLibPieces.insert(adLibPiece000)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
		expectedDurationWithPreroll: undefined,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		lifespan: PieceLifespan.WithinPart,
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	Pieces.insert(piece010)

	const segment1: DBSegment = {
		_id: protectString(rundownId + '_segment1'),
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 1',
		externalModified: 1,
	}
	Segments.insert(segment1)

	const part10: DBPart = {
		_id: protectString(rundownId + '_part1_0'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 0,
		externalId: 'MOCK_PART_1_0',
		title: 'Part 1 0',
		expectedDurationWithPreroll: undefined,
	}
	Parts.insert(part10)

	const part11: DBPart = {
		_id: protectString(rundownId + '_part1_1'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_1_1',
		title: 'Part 1 1',
		expectedDurationWithPreroll: undefined,
	}
	Parts.insert(part11)

	const part12: DBPart = {
		_id: protectString(rundownId + '_part1_2'),
		segmentId: segment1._id,
		rundownId: segment1.rundownId,
		_rank: 2,
		externalId: 'MOCK_PART_1_2',
		title: 'Part 1 2',
		expectedDurationWithPreroll: undefined,
	}
	Parts.insert(part12)

	const segment2: DBSegment = {
		_id: protectString(rundownId + '_segment2'),
		_rank: 2,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 2',
		externalModified: 1,
	}
	Segments.insert(segment2)

	const globalAdLib0: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib0'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_0',
		lifespan: PieceLifespan.OutOnRundownEnd,
		rundownId: segment0.rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'Global AdLib 0',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	const globalAdLib1: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib1'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_1',
		lifespan: PieceLifespan.OutOnRundownEnd,
		rundownId: segment0.rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'Global AdLib 1',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	RundownBaselineAdLibPieces.insert(globalAdLib0)
	RundownBaselineAdLibPieces.insert(globalAdLib1)

	return rundownId
}
export function setupRundownWithAutoplayPart0(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const outputLayerIds = Object.keys(applyAndValidateOverrides(env.showStyleBase.outputLayersWithOverrides).obj)
	const sourceLayerIds = Object.keys(applyAndValidateOverrides(env.showStyleBase.sourceLayersWithOverrides).obj)

	const rundown: DBRundown = defaultRundown(
		unprotectString(rundownId),
		env.studio._id,
		env.ingestDevice._id,
		playlistId,
		env.showStyleBase._id,
		env.showStyleVariant._id
	)
	rundown._id = rundownId
	Rundowns.insert(rundown)

	const segment0: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment0'), rundown._id),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		name: 'Segment 0',
	}
	Segments.insert(segment0)
	/* tslint:disable:ter-indent*/
	//
	const part00: DBPart = {
		...defaultPart(protectString(rundownId + '_part0_0'), rundown._id, segment0._id),
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',

		expectedDuration: 20,
		expectedDurationWithPreroll: 20,
		autoNext: true,
	}
	Parts.insert(part00)

	const piece000: Piece = {
		...defaultPiece(protectString(rundownId + '_piece000'), rundown._id, part00.segmentId, part00._id),
		externalId: 'MOCK_PIECE_000',
		name: 'Piece 000',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
	}
	Pieces.insert(piece000)

	const piece001: Piece = {
		...defaultPiece(protectString(rundownId + '_piece001'), rundown._id, part00.segmentId, part00._id),
		externalId: 'MOCK_PIECE_001',
		name: 'Piece 001',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
	}
	Pieces.insert(piece001)

	const adLibPiece000: AdLibPiece = {
		...defaultAdLibPiece(protectString(rundownId + '_adLib000'), segment0.rundownId, part00._id),
		expectedDuration: 1000,
		externalId: 'MOCK_ADLIB_000',
		status: PieceStatusCode.UNKNOWN,
		name: 'AdLib 0',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
	}

	AdLibPieces.insert(adLibPiece000)

	const part01: DBPart = {
		...defaultPart(protectString(rundownId + '_part0_1'), rundown._id, segment0._id),
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
	}
	Parts.insert(part01)

	const piece010: Piece = {
		...defaultPiece(protectString(rundownId + '_piece010'), rundown._id, part01.segmentId, part01._id),
		externalId: 'MOCK_PIECE_010',
		name: 'Piece 010',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
	}
	Pieces.insert(piece010)

	const segment1: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment1'), rundown._id),
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		name: 'Segment 1',
	}
	Segments.insert(segment1)

	const part10: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_0'), rundown._id, segment1._id),
		_rank: 0,
		externalId: 'MOCK_PART_1_0',
		title: 'Part 1 0',
	}
	Parts.insert(part10)

	const part11: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_1'), rundown._id, segment1._id),
		_rank: 1,
		externalId: 'MOCK_PART_1_1',
		title: 'Part 1 1',
	}
	Parts.insert(part11)

	const part12: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_2'), rundown._id, segment1._id),
		_rank: 2,
		externalId: 'MOCK_PART_1_2',
		title: 'Part 1 2',
	}
	Parts.insert(part12)

	const segment2: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment2'), rundown._id),
		_rank: 2,
		externalId: 'MOCK_SEGMENT_2',
		name: 'Segment 2',
	}
	Segments.insert(segment2)

	const globalAdLib0: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib0'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_0',
		lifespan: PieceLifespan.OutOnRundownChange,
		rundownId: segment0.rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'Global AdLib 0',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	const globalAdLib1: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib1'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_1',
		lifespan: PieceLifespan.OutOnRundownChange,
		rundownId: segment0.rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'Global AdLib 1',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	RundownBaselineAdLibPieces.insert(globalAdLib0)
	RundownBaselineAdLibPieces.insert(globalAdLib1)

	return rundownId
}

export function setupMockWorker(doc?: Partial<WorkerStatus>): {
	worker: WorkerStatus
	workerThreadStatuses: WorkerThreadStatus[]
} {
	doc = doc || {}

	const worker: WorkerStatus = {
		_id: getRandomId(),
		name: 'Mock Worker',
		instanceId: getRandomString(),
		createdTime: Date.now(),
		startTime: Date.now(),
		lastUpdatedTime: Date.now(),
		connected: true,
		status: 'OK',

		...doc,
	}
	Workers.insert(worker)

	const workerThreadStatus0: WorkerThreadStatus = {
		_id: getRandomId(),
		workerId: worker._id,
		instanceId: getRandomString(),
		name: 'thread 0',
		statusCode: StatusCode.GOOD,
		reason: 'OK',
	}
	WorkerThreadStatuses.insert(workerThreadStatus0)
	const workerThreadStatus1: WorkerThreadStatus = {
		_id: getRandomId(),
		workerId: worker._id,
		instanceId: getRandomString(),
		name: 'thread 1',
		statusCode: StatusCode.GOOD,
		reason: 'OK',
	}
	WorkerThreadStatuses.insert(workerThreadStatus1)

	return { worker, workerThreadStatuses: [workerThreadStatus0, workerThreadStatus1] }
}

// const studioBlueprint
// const showStyleBlueprint
// const showStyleVariant

export function convertToUIShowStyleBase(showStyleBase: ShowStyleBase): UIShowStyleBase {
	return literal<Complete<UIShowStyleBase>>({
		_id: showStyleBase._id,
		name: showStyleBase.name,
		hotkeyLegend: showStyleBase.hotkeyLegend,
		sourceLayers: applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj,
		outputLayers: applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj,
	})
}
