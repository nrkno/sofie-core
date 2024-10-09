import {
	BlueprintManifestType,
	IBlueprintConfig,
	IOutputLayer,
	ISourceLayer,
	SourceLayerType,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketId, ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { assertNever, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	wrapDefaultObject,
	updateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	APIBlueprint,
	APIBucket,
	APIBucketComplete,
	APIOutputLayer,
	APIPeripheralDevice,
	APIShowStyleBase,
	APIShowStyleVariant,
	APISourceLayer,
	APIStudio,
	APIStudioSettings,
} from '../../../lib/rest/v1'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { Blueprints, ShowStyleBases, Studios } from '../../../collections'
import {
	DEFAULT_MINIMUM_TAKE_SPAN,
	DEFAULT_FALLBACK_PART_DURATION,
} from '@sofie-automation/shared-lib/dist/core/constants'
import { Bucket } from '@sofie-automation/meteor-lib/dist/collections/Buckets'
import { ForceQuickLoopAutoNext } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

/*
This file contains functions that convert between the internal Sofie-Core types and types exposed to the external API.
When making changes to this file, be wary of breaking changes to the API.
*/

export async function showStyleBaseFrom(
	apiShowStyleBase: APIShowStyleBase,
	existingId?: ShowStyleBaseId
): Promise<DBShowStyleBase | undefined> {
	const blueprint = await Blueprints.findOneAsync(protectString(apiShowStyleBase.blueprintId))
	if (!blueprint) return undefined
	if (blueprint.blueprintType !== BlueprintManifestType.SHOWSTYLE) return undefined

	let showStyleBase: DBShowStyleBase | undefined
	if (existingId) showStyleBase = await ShowStyleBases.findOneAsync(existingId)

	const newOutputLayers = apiShowStyleBase.outputLayers.reduce<Record<string, IOutputLayer>>((acc, op) => {
		acc[op.id] = { _id: op.id, name: op.name, _rank: op.rank, isPGM: op.isPgm }
		return acc
	}, {} as Record<string, IOutputLayer>)
	const outputLayers = showStyleBase
		? updateOverrides(showStyleBase.outputLayersWithOverrides, newOutputLayers)
		: wrapDefaultObject({})

	const newSourceLayers = apiShowStyleBase.sourceLayers.reduce<Record<string, ISourceLayer>>((acc, op) => {
		acc[op.id] = sourceLayerFrom(op)
		return acc
	}, {} as Record<string, ISourceLayer>)
	const sourceLayers = showStyleBase
		? updateOverrides(showStyleBase.sourceLayersWithOverrides, newSourceLayers)
		: wrapDefaultObject({})

	const blueprintConfig = showStyleBase
		? updateOverrides(showStyleBase.blueprintConfigWithOverrides, apiShowStyleBase.config as IBlueprintConfig)
		: wrapDefaultObject({})

	return {
		_id: existingId ?? getRandomId(),
		name: apiShowStyleBase.name,
		blueprintId: protectString(apiShowStyleBase.blueprintId),
		blueprintConfigPresetId: apiShowStyleBase.blueprintConfigPresetId,
		organizationId: null,
		outputLayersWithOverrides: outputLayers,
		sourceLayersWithOverrides: sourceLayers,
		blueprintConfigWithOverrides: blueprintConfig,
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,
	}
}

export function APIShowStyleBaseFrom(showStyleBase: DBShowStyleBase): APIShowStyleBase {
	return {
		name: showStyleBase.name,
		blueprintId: unprotectString(showStyleBase.blueprintId),
		blueprintConfigPresetId: showStyleBase.blueprintConfigPresetId,
		outputLayers: Object.values<IOutputLayer | undefined>(
			applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj
		).map((layer) => APIOutputLayerFrom(layer!)),
		sourceLayers: Object.values<ISourceLayer | undefined>(
			applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
		).map((layer) => APISourceLayerFrom(layer!)),
		config: applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj,
	}
}

export function showStyleVariantFrom(
	apiShowStyleVariant: APIShowStyleVariant,
	existingId?: ShowStyleVariantId
): DBShowStyleVariant | undefined {
	const blueprintConfig = wrapDefaultObject({})
	blueprintConfig.overrides = Object.entries<any>(apiShowStyleVariant.config).map(([key, value]) =>
		literal<ObjectOverrideSetOp>({
			op: 'set',
			path: key,
			value,
		})
	)
	return {
		_id: existingId ?? getRandomId(),
		_rank: apiShowStyleVariant.rank,
		showStyleBaseId: protectString(apiShowStyleVariant.showStyleBaseId),
		name: apiShowStyleVariant.name,
		blueprintConfigWithOverrides: blueprintConfig,
		_rundownVersionHash: '',
	}
}

export function APIShowStyleVariantFrom(showStyleVariant: DBShowStyleVariant): APIShowStyleVariant {
	return {
		name: showStyleVariant.name,
		rank: showStyleVariant._rank,
		showStyleBaseId: unprotectString(showStyleVariant.showStyleBaseId),
		config: applyAndValidateOverrides(showStyleVariant.blueprintConfigWithOverrides).obj,
	}
}

export function sourceLayerFrom(apiSourceLayer: APISourceLayer): ISourceLayer {
	let layerType: SourceLayerType
	switch (apiSourceLayer.layerType) {
		case 'audio':
			layerType = SourceLayerType.AUDIO
			break
		case 'camera':
			layerType = SourceLayerType.CAMERA
			break
		case 'graphics':
			layerType = SourceLayerType.GRAPHICS
			break
		case 'live-speak':
			layerType = SourceLayerType.LIVE_SPEAK
			break
		case 'local':
			layerType = SourceLayerType.LOCAL
			break
		case 'lower-third':
			layerType = SourceLayerType.LOWER_THIRD
			break
		case 'remote':
			layerType = SourceLayerType.REMOTE
			break
		case 'script':
			layerType = SourceLayerType.SCRIPT
			break
		case 'splits':
			layerType = SourceLayerType.SPLITS
			break
		case 'transition':
			layerType = SourceLayerType.TRANSITION
			break
		case 'unknown':
			layerType = SourceLayerType.UNKNOWN
			break
		case 'vt':
			layerType = SourceLayerType.VT
			break
		case 'studio-screen':
			layerType = SourceLayerType.STUDIO_SCREEN
			break
		default:
			layerType = SourceLayerType.UNKNOWN
			assertNever(apiSourceLayer.layerType)
	}

	return {
		_id: apiSourceLayer.id,
		name: apiSourceLayer.name,
		abbreviation: apiSourceLayer.abbreviation,
		_rank: apiSourceLayer.rank,
		type: layerType,
		exclusiveGroup: apiSourceLayer.exclusiveGroup,
	}
}

export function APISourceLayerFrom(sourceLayer: ISourceLayer): APISourceLayer {
	let layerType: APISourceLayer['layerType']
	switch (sourceLayer.type) {
		case SourceLayerType.AUDIO:
			layerType = 'audio'
			break
		case SourceLayerType.CAMERA:
			layerType = 'camera'
			break
		case SourceLayerType.GRAPHICS:
			layerType = 'graphics'
			break
		case SourceLayerType.LIVE_SPEAK:
			layerType = 'live-speak'
			break
		case SourceLayerType.LOCAL:
			layerType = 'local'
			break
		case SourceLayerType.LOWER_THIRD:
			layerType = 'lower-third'
			break
		case SourceLayerType.REMOTE:
			layerType = 'remote'
			break
		case SourceLayerType.SCRIPT:
			layerType = 'script'
			break
		case SourceLayerType.SPLITS:
			layerType = 'splits'
			break
		case SourceLayerType.TRANSITION:
			layerType = 'transition'
			break
		case SourceLayerType.UNKNOWN:
			layerType = 'unknown'
			break
		case SourceLayerType.VT:
			layerType = 'vt'
			break
		case SourceLayerType.STUDIO_SCREEN:
			layerType = 'studio-screen'
			break
		default:
			layerType = 'unknown'
			assertNever(sourceLayer.type)
	}

	return {
		id: sourceLayer._id,
		name: sourceLayer.name,
		abbreviation: sourceLayer.abbreviation,
		rank: sourceLayer._rank,
		layerType,
		exclusiveGroup: sourceLayer.exclusiveGroup,
	}
}

export async function studioFrom(apiStudio: APIStudio, existingId?: StudioId): Promise<DBStudio | undefined> {
	let blueprint: Blueprint | undefined
	if (apiStudio.blueprintId) {
		blueprint = await Blueprints.findOneAsync(protectString(apiStudio.blueprintId))
		if (!blueprint) return undefined
		if (blueprint.blueprintType !== BlueprintManifestType.STUDIO) return undefined
	}

	let studio: DBStudio | undefined
	if (existingId) studio = await Studios.findOneAsync(existingId)

	const blueprintConfig = studio
		? updateOverrides(studio.blueprintConfigWithOverrides, apiStudio.config as IBlueprintConfig)
		: wrapDefaultObject({})

	return {
		_id: existingId ?? getRandomId(),
		name: apiStudio.name,
		blueprintId: blueprint?._id,
		blueprintConfigPresetId: apiStudio.blueprintConfigPresetId,
		blueprintConfigWithOverrides: blueprintConfig,
		settings: studioSettingsFrom(apiStudio.settings),
		supportedShowStyleBase: apiStudio.supportedShowStyleBase?.map((id) => protectString<ShowStyleBaseId>(id)) ?? [],
		organizationId: null,
		mappingsWithOverrides: wrapDefaultObject({}),
		routeSetsWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		routeSetExclusivityGroupsWithOverrides: wrapDefaultObject({}),
		packageContainersWithOverrides: wrapDefaultObject({}),
		previewContainerIds: [],
		thumbnailContainerIds: [],
		peripheralDeviceSettings: {
			playoutDevices: wrapDefaultObject({}),
			ingestDevices: wrapDefaultObject({}),
			inputDevices: wrapDefaultObject({}),
		},
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,
	}
}

export function APIStudioFrom(studio: DBStudio): APIStudio {
	const studioSettings = APIStudioSettingsFrom(studio.settings)

	return {
		name: studio.name,
		blueprintId: unprotectString(studio.blueprintId),
		blueprintConfigPresetId: studio.blueprintConfigPresetId,
		config: applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj,
		settings: studioSettings,
		supportedShowStyleBase: studio.supportedShowStyleBase.map((id) => unprotectString(id)),
	}
}

export function studioSettingsFrom(apiStudioSettings: APIStudioSettings): IStudioSettings {
	return {
		frameRate: apiStudioSettings.frameRate,
		mediaPreviewsUrl: apiStudioSettings.mediaPreviewsUrl,
		slackEvaluationUrls: apiStudioSettings.slackEvaluationUrls?.join(','),
		supportedMediaFormats: apiStudioSettings.supportedMediaFormats?.join(','),
		supportedAudioStreams: apiStudioSettings.supportedAudioStreams?.join(','),
		enablePlayFromAnywhere: apiStudioSettings.enablePlayFromAnywhere,
		forceMultiGatewayMode: apiStudioSettings.forceMultiGatewayMode,
		multiGatewayNowSafeLatency: apiStudioSettings.multiGatewayNowSafeLatency,
		allowRundownResetOnAir: apiStudioSettings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: apiStudioSettings.preserveOrphanedSegmentPositionInRundown,
		minimumTakeSpan: apiStudioSettings.minimumTakeSpan ?? DEFAULT_MINIMUM_TAKE_SPAN,
		enableQuickLoop: apiStudioSettings.enableQuickLoop,
		forceQuickLoopAutoNext: forceQuickLoopAutoNextFrom(apiStudioSettings.forceQuickLoopAutoNext),
		fallbackPartDuration: apiStudioSettings.fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION,
	}
}

export function APIStudioSettingsFrom(settings: IStudioSettings): APIStudioSettings {
	return {
		frameRate: settings.frameRate,
		mediaPreviewsUrl: settings.mediaPreviewsUrl,
		slackEvaluationUrls: settings.slackEvaluationUrls?.split(','),
		supportedMediaFormats: settings.supportedMediaFormats?.split(','),
		supportedAudioStreams: settings.supportedAudioStreams?.split(','),
		enablePlayFromAnywhere: settings.enablePlayFromAnywhere,
		forceMultiGatewayMode: settings.forceMultiGatewayMode,
		multiGatewayNowSafeLatency: settings.multiGatewayNowSafeLatency,
		allowRundownResetOnAir: settings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: settings.preserveOrphanedSegmentPositionInRundown,
		minimumTakeSpan: settings.minimumTakeSpan,
		enableQuickLoop: settings.enableQuickLoop,
		forceQuickLoopAutoNext: APIForceQuickLoopAutoNextFrom(settings.forceQuickLoopAutoNext),
		fallbackPartDuration: settings.fallbackPartDuration,
	}
}

export function forceQuickLoopAutoNextFrom(
	forceQuickLoopAutoNext: APIStudioSettings['forceQuickLoopAutoNext']
): ForceQuickLoopAutoNext | undefined {
	if (!forceQuickLoopAutoNext) return undefined
	switch (forceQuickLoopAutoNext) {
		case 'disabled':
			return ForceQuickLoopAutoNext.DISABLED
		case 'enabled_forcing_min_duration':
			return ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION
		case 'enabled_when_valid_duration':
			return ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION
		default:
			assertNever(forceQuickLoopAutoNext)
			return undefined
	}
}

export function APIForceQuickLoopAutoNextFrom(
	forceQuickLoopAutoNext: ForceQuickLoopAutoNext | undefined
): APIStudioSettings['forceQuickLoopAutoNext'] {
	if (!forceQuickLoopAutoNext) return undefined
	switch (forceQuickLoopAutoNext) {
		case ForceQuickLoopAutoNext.DISABLED:
			return 'disabled'
		case ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION:
			return 'enabled_forcing_min_duration'
		case ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION:
			return 'enabled_when_valid_duration'
		default:
			assertNever(forceQuickLoopAutoNext)
	}
}

export function APIPeripheralDeviceFrom(device: PeripheralDevice): APIPeripheralDevice {
	let status: APIPeripheralDevice['status'] = 'unknown'
	switch (device.status.statusCode) {
		case StatusCode.BAD:
			status = 'bad'
			break
		case StatusCode.FATAL:
			status = 'fatal'
			break
		case StatusCode.GOOD:
			status = 'good'
			break
		case StatusCode.WARNING_MAJOR:
			status = 'warning_major'
			break
		case StatusCode.WARNING_MINOR:
			status = 'marning_minor'
			break
		case StatusCode.UNKNOWN:
			status = 'unknown'
			break
		default:
			assertNever(device.status.statusCode)
	}

	let deviceType: APIPeripheralDevice['deviceType'] = 'unknown'
	switch (device.type) {
		case PeripheralDeviceType.INEWS:
			deviceType = 'inews'
			break
		case PeripheralDeviceType.LIVE_STATUS:
			deviceType = 'live_status'
			break
		case PeripheralDeviceType.MEDIA_MANAGER:
			deviceType = 'media_manager'
			break
		case PeripheralDeviceType.MOS:
			deviceType = 'mos'
			break
		case PeripheralDeviceType.PACKAGE_MANAGER:
			deviceType = 'package_manager'
			break
		case PeripheralDeviceType.PLAYOUT:
			deviceType = 'playout'
			break
		case PeripheralDeviceType.SPREADSHEET:
			deviceType = 'spreadsheet'
			break
		case PeripheralDeviceType.INPUT:
			deviceType = 'input'
			break
		default:
			assertNever(device.type)
	}

	return {
		id: unprotectString(device._id),
		name: device.name,
		status,
		messages: device.status.messages ?? [],
		deviceType,
		connected: device.connected,
	}
}

export function APIBlueprintFrom(blueprint: Blueprint): APIBlueprint | undefined {
	if (!blueprint.blueprintType) return undefined

	return {
		id: unprotectString(blueprint._id),
		name: blueprint.name,
		blueprintType: blueprint.blueprintType,
		blueprintVersion: blueprint.blueprintVersion,
	}
}

export function APIOutputLayerFrom(outputLayer: IOutputLayer): APIOutputLayer {
	return {
		id: outputLayer._id,
		name: outputLayer.name,
		rank: outputLayer._rank,
		isPgm: outputLayer.isPGM,
	}
}

export function bucketFrom(apiBucket: APIBucket, existingId?: BucketId): Bucket {
	return {
		_id: existingId ?? getRandomId(),
		studioId: protectString(apiBucket.studioId),
		name: apiBucket.name,
		_rank: 0,
		width: undefined,
		buttonWidthScale: 1,
		buttonHeightScale: 1,
	}
}

export function APIBucketFrom(bucket: Bucket): APIBucketComplete {
	return {
		id: unprotectString(bucket._id),
		name: bucket.name,
		studioId: unprotectString(bucket.studioId),
	}
}
