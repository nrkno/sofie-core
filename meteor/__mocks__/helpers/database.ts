import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { StatusCode } from '../../server/systemStatus/systemStatus'
import { Studio, Studios, DBStudio } from '../../lib/collections/Studios'
import {
	PieceLifespan,
	getPieceGroupId,
	IOutputLayer,
	ISourceLayer,
	SourceLayerType,
	StudioBlueprintManifest,
	BlueprintManifestType,
	Timeline, IStudioContext,
	IStudioConfigContext,
	IBlueprintShowStyleBase,
	IngestRundown,
	BlueprintManifestBase,
	ShowStyleBlueprintManifest,
	IBlueprintShowStyleVariant,
	ShowStyleContext,
	BlueprintResultRundown,
	BlueprintResultSegment,
	IngestSegment,
	SegmentContext,
	IBlueprintAdLibPiece,
	IBlueprintRundown,
	IBlueprintSegment,
	BlueprintResultPart,
	IBlueprintPart,
	IBlueprintPiece
} from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleBase, ShowStyleBases, DBShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, DBShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { CURRENT_SYSTEM_VERSION } from '../../server/migration/databaseMigration'
import { Blueprint } from '../../lib/collections/Blueprints'
import { ICoreSystem, CoreSystem, SYSTEM_ID } from '../../lib/collections/CoreSystem'
import { uploadBlueprint } from '../../server/api/blueprints/api'
import { literal, getCurrentTime } from '../../lib/lib'
import { TSRTimelineObjBase } from 'timeline-state-resolver-types'
import { Rundown, DBRundown, Rundowns } from '../../lib/collections/Rundowns'
import { DBSegment, Segments } from '../../lib/collections/Segments'
import { DBPart, Parts } from '../../lib/collections/Parts'
import { Piece, Pieces } from '../../lib/collections/Pieces'
import { RundownAPI } from '../../lib/api/rundown'

export enum LAYER_IDS {
	SOURCE_CAM0 = 'cam0',
	SOURCE_VT0 = 'vt0',
	OUTPUT_PGM = 'pgm'
}

let dbI: number = 0
export function setupMockPeripheralDevice (
	category: PeripheralDeviceAPI.DeviceCategory,
	type: PeripheralDeviceAPI.DeviceType,
	subType: PeripheralDeviceAPI.DeviceSubType,
	studio: Studio,
	doc?: Partial<PeripheralDevice>
) {
	doc = doc || {}

	const defaultDevice: PeripheralDevice = {
		_id: 'mockDevice' + (dbI++),
		name: 'mockDevice',
		studioId: studio._id,

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
		token: 'mockToken'
	}
	const device = _.extend(defaultDevice, doc) as PeripheralDevice
	PeripheralDevices.insert(device)
	return device
}
export function setupMockCore (doc?: Partial<ICoreSystem>): ICoreSystem {
	doc = doc || {}

	const defaultCore: ICoreSystem = {
		_id: SYSTEM_ID,
		name: 'mock Core',
		created: 0,
		modified: 0,
		version: '0.0.0',
		previousVersion: '0.0.0',
		storePath: '',
		serviceMessages: {}
	}
	const coreSystem = _.extend(defaultCore, doc)
	CoreSystem.remove(SYSTEM_ID)
	CoreSystem.insert(coreSystem)
	return coreSystem
}
export function setupMockStudio (doc?: Partial<DBStudio>): Studio {
	doc = doc || {}

	const defaultStudio: DBStudio = {
		_id: 'mockStudio' + (dbI++),
		name: 'mockStudio',
		// blueprintId?: string
		mappings: {},
		supportedShowStyleBase: [],
		config: [],
		// testToolsConfig?: ITestToolsConfig
		settings: {
			mediaPreviewsUrl: '',
			sofieUrl: ''
		},
		_rundownVersionHash: 'asdf'
	}
	const studio = _.extend(defaultStudio, doc)
	Studios.insert(studio)
	return studio
}
export function setupMockShowStyleBase (blueprintId: string, doc?: Partial<DBStudio>): ShowStyleBase {
	doc = doc || {}

	const defaultShowStyleBase: DBShowStyleBase = {
		_id: 'mockShowStyleBase' + (dbI++),
		name: 'mockShowStyleBase',
		outputLayers: [
			literal<IOutputLayer>({
				_id: LAYER_IDS.OUTPUT_PGM,
				_rank: 0,
				isPGM: true,
				name: 'PGM'
			})
		],
		sourceLayers: [
			literal<ISourceLayer>({
				_id: LAYER_IDS.SOURCE_CAM0,
				_rank: 0,
				name: 'Camera',
				onPGMClean: true,
				type: SourceLayerType.CAMERA,
				unlimited: false
			}),
			literal<ISourceLayer>({
				_id: LAYER_IDS.SOURCE_VT0,
				_rank: 1,
				name: 'VT',
				onPGMClean: true,
				type: SourceLayerType.VT,
				unlimited: false
			})
		],
		config: [],
		blueprintId: blueprintId,
		// hotkeyLegend?: Array<HotkeyDefinition>
		// runtimeArguments?: Array<IBlueprintRuntimeArgumentsItem>
		_rundownVersionHash: ''
	}
	const showStyleBase = _.extend(defaultShowStyleBase, doc)
	ShowStyleBases.insert(showStyleBase)
	return showStyleBase
}
export function setupMockShowStyleVariant (showStyleBaseId: string, doc?: Partial<DBStudio>): ShowStyleVariant {
	doc = doc || {}

	const defaultShowStyleVariant: DBShowStyleVariant = {
		_id: 'mockShowStyleVariant' + (dbI++),
		name: 'mockShowStyleVariant',
		showStyleBaseId: showStyleBaseId,
		config: [],
		_rundownVersionHash: ''
	}
	const showStyleVariant = _.extend(defaultShowStyleVariant, doc)
	ShowStyleVariants.insert(showStyleVariant)

	return showStyleVariant
}

function packageBlueprint<T extends BlueprintManifestBase> (constants: {[constant: string]: string}, blueprintFcn: () => T): string {
	let code = blueprintFcn.toString()
	_.each(constants, (newConstant, constant) => {

		newConstant = newConstant.replace(/^\^/,'') || '0.0.0' // fix the version, the same way the bleprint does it

		code = code.replace(new RegExp(constant, 'g'), _.isString(newConstant) ? `'${newConstant}'` : newConstant)
	})
	return `{default: (${code})()}`
}
export function setupMockStudioBlueprint (showStyleBaseId: string): Blueprint {

	const PackageInfo = require('../../package.json')

	const BLUEPRINT_TYPE						= BlueprintManifestType.STUDIO
	const INTEGRATION_VERSION: string			= PackageInfo.dependencies['tv-automation-sofie-blueprints-integration']
	const TSR_VERSION: string					= PackageInfo.dependencies['timeline-state-resolver-types']
	const CORE_VERSION: string					= CURRENT_SYSTEM_VERSION
	const SHOW_STYLE_ID: string					= showStyleBaseId

	const code = packageBlueprint<StudioBlueprintManifest>({
		// Constants to into code:
		BLUEPRINT_TYPE,
		INTEGRATION_VERSION,
		TSR_VERSION,
		CORE_VERSION,
		SHOW_STYLE_ID
	}, function (): StudioBlueprintManifest {
		return {
			blueprintType: BLUEPRINT_TYPE,
			blueprintVersion: '0.0.0',
			integrationVersion: INTEGRATION_VERSION,
			TSRVersion: TSR_VERSION,
			minimumCoreVersion: CORE_VERSION,

			studioConfigManifest: [],
			studioMigrations: [],
			getBaseline: (context: IStudioContext): TSRTimelineObjBase[] => {
				return []
			},
			getShowStyleId: (context: IStudioConfigContext, showStyles: Array<IBlueprintShowStyleBase>, ingestRundown: IngestRundown): string | null => {
				return SHOW_STYLE_ID
			}
		}
	})

	const blueprintId = 'mockBlueprint' + (dbI++)
	const blueprintName = 'mockBlueprint'

	return uploadBlueprint(blueprintId, code, blueprintName)
}
export function setupMockShowStyleBlueprint (showStyleVariantId: string): Blueprint {

	const PackageInfo = require('../../package.json')

	const BLUEPRINT_TYPE						= BlueprintManifestType.SHOWSTYLE
	const INTEGRATION_VERSION: string			= PackageInfo.dependencies['tv-automation-sofie-blueprints-integration']
	const TSR_VERSION: string					= PackageInfo.dependencies['timeline-state-resolver-types']
	const CORE_VERSION: string					= CURRENT_SYSTEM_VERSION
	const SHOW_STYLE_VARIANT_ID: string			= showStyleVariantId

	const code = packageBlueprint<ShowStyleBlueprintManifest>({
		// Constants to into code:
		BLUEPRINT_TYPE,
		INTEGRATION_VERSION,
		TSR_VERSION,
		CORE_VERSION,
		SHOW_STYLE_VARIANT_ID
	}, function (): ShowStyleBlueprintManifest {
		return {
			blueprintType: BLUEPRINT_TYPE,
			blueprintVersion: '0.0.0',
			integrationVersion: INTEGRATION_VERSION,
			TSRVersion: TSR_VERSION,
			minimumCoreVersion: CORE_VERSION,

			showStyleConfigManifest: [],
			showStyleMigrations: [],
			getShowStyleVariantId: (
				context: IStudioConfigContext,
				showStyleVariants: Array<IBlueprintShowStyleVariant>,
				ingestRundown: IngestRundown
			): string | null => {
				return SHOW_STYLE_VARIANT_ID
			},
			getRundown: (context: ShowStyleContext, ingestRundown: IngestRundown): BlueprintResultRundown => {
				const rundown: IBlueprintRundown = {
					externalId: ingestRundown.externalId,
					name: ingestRundown.name,
					// expectedStart?:
					// expectedDuration?: number;
					metaData: ingestRundown.payload
				}
				return {
					rundown,
					globalAdLibPieces: [],
					baseline: []
				}
			},
			getSegment: (context: SegmentContext, ingestSegment: IngestSegment): BlueprintResultSegment => {

				const segment: IBlueprintSegment = {
					name: ingestSegment.name ? ingestSegment.name : ingestSegment.externalId,
					metaData: ingestSegment.payload
				}
				const parts: BlueprintResultPart[] = []

				_.each(ingestSegment.parts, ingestPart => {
					// console.log(ingestPart.payload, ingestPart.externalId)
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
						typeVariant: 'abc',
						// subTypeVariant?: string;
						// holdMode?: PartHoldMode;
						// updateStoryStatus?: boolean;
						// classes?: string[];
						// classesForNext?: string[];
						// displayDurationGroup?: string;
						// displayDuration?: number;
						// invalid?: boolean
					}
					const pieces: IBlueprintPiece[] = []
					const adLibPieces: IBlueprintAdLibPiece[] = []
					parts.push({
						part,
						pieces,
						adLibPieces
					})
				})
				return {
					segment,
					parts
				}
			},
			// getPart?: (context: PartContext, ingestPart: IngestPart) => BlueprintResultPart | null,
			// onRundownActivate?: (context: EventContext & RundownContext) => Promise<void>,
			// onRundownFirstTake?: (context: EventContext & PartEventContext) => Promise<void>,
			// onRundownDeActivate?: (context: EventContext & RundownContext) => Promise<void>,
			// onPreTake?: (context: EventContext & PartEventContext) => Promise<void>,
			// onPostTake?: (context: EventContext & PartEventContext) => Promise<void>,
			// onTimelineGenerate?: (context: EventContext & RundownContext, timeline: Timeline.TimelineObject[]) => Promise<Timeline.TimelineObject[]>,
			// onAsRunEvent?: (context: EventContext & AsRunEventContext) => Promise<IBlueprintExternalMessageQueueObj[]>,
		}
	})

	const blueprintId = 'mockBlueprint' + (dbI++)
	const blueprintName = 'mockBlueprint'

	return uploadBlueprint(blueprintId, code, blueprintName)
}
export interface DefaultEnvironment {
	showStyleBaseId: string
	showStyleVariantId: string
	studioBlueprint: Blueprint
	showStyleBlueprint: Blueprint
	showStyleBase: ShowStyleBase
	showStyleVariant: ShowStyleVariant
	studio: Studio
	core: ICoreSystem

	ingestDevice: PeripheralDevice
}
export function setupDefaultStudioEnvironment (): DefaultEnvironment {

	const core = setupMockCore({})

	const showStyleBaseId = Random.id()
	const showStyleVariantId = Random.id()

	const studioBlueprint = setupMockStudioBlueprint(showStyleBaseId)
	const showStyleBlueprint = setupMockShowStyleBlueprint(showStyleVariantId)

	const showStyleBase = setupMockShowStyleBase(showStyleBlueprint._id, { _id: showStyleBaseId })
	const showStyleVariant = setupMockShowStyleVariant(showStyleBase._id, { _id: showStyleVariantId })

	const studio = setupMockStudio({
		blueprintId: studioBlueprint._id,
		supportedShowStyleBase: [showStyleBaseId]
	})
	const ingestDevice = setupMockPeripheralDevice(
		PeripheralDeviceAPI.DeviceCategory.INGEST,
		PeripheralDeviceAPI.DeviceType.MOS,
		PeripheralDeviceAPI.SUBTYPE_PROCESS,
		studio
	)

	return {
		showStyleBaseId,
		showStyleVariantId,
		studioBlueprint,
		showStyleBlueprint,
		showStyleBase,
		showStyleVariant,
		studio,
		core,
		ingestDevice
	}
}
export function setupDefaultRundown (env: DefaultEnvironment, rundownId0?: string): string {
	const rundown: DBRundown = {

		peripheralDeviceId: env.ingestDevice._id,
		studioId: env.studio._id,
		showStyleBaseId: env.showStyleBase._id,
		showStyleVariantId: env.showStyleVariant._id,


		_id: rundownId0 || Random.id(),
		externalId: 'MOCK_EXTERNAL_ID',
		name: 'Default Rundown',

		created: getCurrentTime(),
		modified: getCurrentTime(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: ''
		},

		active: false,
		rehearsal: false,
		currentPartId: null,
		nextPartId: null,
		previousPartId: null,

		dataSource: 'mock'
	}
	const rundownId = Rundowns.insert(rundown)

	const segment0: DBSegment = {
		_id: rundownId + '_segment0',
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundown._id,
		name: 'Segment 0'
	}
	Segments.insert(segment0)
	/* tslint:disable:ter-indent*/
	//
		const part00: DBPart = {
			_id: rundownId + '_part0_0',
			segmentId: segment0._id,
			rundownId: rundown._id,
			_rank: 0,
			externalId: 'MOCK_PART_0_0',
			title: 'Part 0 0',
			typeVariant: '',

			duration: 20
		}
		Parts.insert(part00)

			const piece000: Piece = {
				_id: rundownId + '_piece000',
				externalId: 'MOCK_PIECE_000',
				rundownId: rundown._id,
				partId: part00._id,
				name: 'Piece 000',
				status: RundownAPI.PieceStatusCode.OK,
				enable: {
					start: 0
				},
				sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
				outputLayerId: env.showStyleBase.outputLayers[0]._id
			}
			Pieces.insert(piece000)

			const piece001: Piece = {
				_id: rundownId + '_piece001',
				externalId: 'MOCK_PIECE_001',
				rundownId: rundown._id,
				partId: part00._id,
				name: 'Piece 001',
				status: RundownAPI.PieceStatusCode.OK,
				enable: {
					start: 0
				},
				sourceLayerId: env.showStyleBase.sourceLayers[1]._id,
				outputLayerId: env.showStyleBase.outputLayers[0]._id
			}
			Pieces.insert(piece001)

		const part01: DBPart = {
			_id: rundownId + '_part0_1',
			segmentId: segment0._id,
			rundownId: segment0.rundownId,
			_rank: 1,
			externalId: 'MOCK_PART_0_1',
			title: 'Part 0 1',
			typeVariant: ''
		}
		Parts.insert(part01)

			const piece010: Piece = {
				_id: rundownId + '_piece010',
				externalId: 'MOCK_PIECE_010',
				rundownId: rundown._id,
				partId: part00._id,
				name: 'Piece 010',
				status: RundownAPI.PieceStatusCode.OK,
				enable: {
					start: 0
				},
				sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
				outputLayerId: env.showStyleBase.outputLayers[0]._id
			}
			Pieces.insert(piece010)

	const segment1: DBSegment = {
		_id: rundownId + '_segment1',
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 1'
	}
	Segments.insert(segment1)

		const part10: DBPart = {
			_id: rundownId + '_part1_0',
			segmentId: segment0._id,
			rundownId: segment0.rundownId,
			_rank: 10,
			externalId: 'MOCK_PART_1_0',
			title: 'Part 1 0',
			typeVariant: ''
		}
		Parts.insert(part10)

		const part11: DBPart = {
			_id: rundownId + '_part1_1',
			segmentId: segment0._id,
			rundownId: segment0.rundownId,
			_rank: 11,
			externalId: 'MOCK_PART_1_1',
			title: 'Part 1 1',
			typeVariant: ''
		}
		Parts.insert(part11)

		const part12: DBPart = {
			_id: rundownId + '_part1_2',
			segmentId: segment0._id,
			rundownId: segment0.rundownId,
			_rank: 12,
			externalId: 'MOCK_PART_1_2',
			title: 'Part 1 2',
			typeVariant: ''
		}
		Parts.insert(part12)

	const segment2: DBSegment = {
		_id: rundownId + '_segment2',
		_rank: 2,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundown._id,
		name: 'Segment 2'
	}
	Segments.insert(segment2)

	return rundownId
}

// const studioBlueprint
// const showStyleBlueprint
// const showStyleVariant
