import * as _ from 'underscore'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { StatusCode } from '../../server/systemStatus'
import { Studio, Studios, DBStudio } from '../../lib/collections/Studios'
import { ShowStyleBase, ShowStyleBases, DBShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, DBShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { StudioBlueprintManifest, BlueprintManifestType, Timeline, IStudioContext, IStudioConfigContext, IBlueprintShowStyleBase, IngestRundown, BlueprintManifestBase } from 'tv-automation-sofie-blueprints-integration'
import { CURRENT_SYSTEM_VERSION } from '../../server/migration/databaseMigration'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import { uploadBlueprint } from '../../server/api/blueprints/api'

let dbI: number = 0
export function setupMockPeripheralDevice (type: PeripheralDeviceAPI.DeviceType, studio: Studio, doc?: Partial<PeripheralDevice>) {
	doc = doc || {}

	const defaultDevice: PeripheralDevice = {
		_id: 'mockDevice' + (dbI++),
		name: 'mockDevice',
		studioId: studio._id,
		type: type,
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
	const device = _.extend(defaultDevice, doc)
	PeripheralDevices.insert(device)
	return device
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
		outputLayers: [],
		sourceLayers: [],
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
		code = code.replace(new RegExp(constant, 'g'), _.isString(newConstant) ? `'${newConstant}'` : newConstant )
	})
	return `{default: (${code})()}`
}
export function setupMockStudioBlueprint (showStyleBaseId: string): Blueprint {

	const PackageInfo = require('../../package.json')

	const BLUEPRINT_TYPE: BlueprintManifestType	= BlueprintManifestType.STUDIO
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
			getBaseline: (context: IStudioContext): Timeline.TimelineObject[] => {
				return []
			},
			getShowStyleId: (context: IStudioConfigContext, showStyles: Array<IBlueprintShowStyleBase>, ingestRundown: IngestRundown): string | null => {
				return SHOW_STYLE_ID
			}
		}
	})

	const blueprintId = 'mockBlueprint' + (dbI++)
	const blueprintName = 'mockBlueprint'

	return uploadBlueprint (blueprintId, code, blueprintName)
}

// const studioBlueprint
// const showStyleBlueprint
// const showStyleVariant
