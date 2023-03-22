import { BlueprintManifestType, ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { assertNever, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	APIOutputLayerFrom,
	APIShowStyleBase,
	APIShowStyleVariant,
	APISourceLayer,
	APIStudio,
	APIStudioSettings,
} from '../../../lib/api/rest'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../lib/collections/Studios'
import { Blueprints, Studios } from '../../collections'

export function showStyleBaseFrom(
	apiShowStyleBase: APIShowStyleBase,
	existingId?: ShowStyleBaseId
): ShowStyleBase | undefined {
	const blueprint = Blueprints.findOne(protectString(apiShowStyleBase.blueprintId))
	if (!blueprint) return undefined
	if (blueprint.blueprintType !== BlueprintManifestType.SHOWSTYLE) return undefined

	const outputLayers = wrapDefaultObject({})
	outputLayers.overrides = Object.entries(apiShowStyleBase.outputLayers).map(([key, value]) =>
		literal<ObjectOverrideSetOp>({
			op: 'set',
			path: key,
			value,
		})
	)
	const sourceLayers = wrapDefaultObject({})
	sourceLayers.overrides = Object.entries(apiShowStyleBase.sourceLayers).map(([key, value]) =>
		literal<ObjectOverrideSetOp>({
			op: 'set',
			path: key,
			value,
		})
	)
	const blueprintConfig = wrapDefaultObject({})
	blueprintConfig.overrides = Object.entries(apiShowStyleBase.config).map(([key, value]) =>
		literal<ObjectOverrideSetOp>({
			op: 'set',
			path: key,
			value,
		})
	)
	return {
		_id: existingId ?? getRandomId(),
		name: apiShowStyleBase.name,
		blueprintId: protectString(apiShowStyleBase.blueprintId),
		organizationId: null,
		outputLayersWithOverrides: outputLayers,
		sourceLayersWithOverrides: sourceLayers,
		blueprintConfigWithOverrides: blueprintConfig,
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
	}
}

export function APIShowStyleBaseFrom(showStyleBase: ShowStyleBase): APIShowStyleBase {
	return {
		name: showStyleBase.name,
		blueprintId: unprotectString(showStyleBase.blueprintId),
		outputLayers: Object.values(applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj).map(
			(layer) => APIOutputLayerFrom(layer!)
		),
		sourceLayers: Object.values(applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj).map(
			(layer) => APISourceLayerFrom(layer!)
		),
		config: applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj,
	}
}

export function showStyleVariantFrom(
	apiShowStyleVariant: APIShowStyleVariant,
	existingId?: ShowStyleVariantId
): ShowStyleVariant | undefined {
	const blueprintConfig = wrapDefaultObject({})
	blueprintConfig.overrides = Object.entries(apiShowStyleVariant.config).map(([key, value]) =>
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

export function APIShowStyleVariantFrom(showStyleVariant: ShowStyleVariant): APIShowStyleVariant {
	return {
		name: showStyleVariant.name,
		rank: showStyleVariant._rank,
		showStyleBaseId: unprotectString(showStyleVariant.showStyleBaseId),
		config: applyAndValidateOverrides(showStyleVariant.blueprintConfigWithOverrides).obj,
	}
}

export function APISourceLayerFrom(sourceLayer: ISourceLayer): APISourceLayer {
	let layerType: APISourceLayer['layerType'] = 'unknown'
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

export function studioFrom(apiStudio: APIStudio, existingId?: StudioId): Studio | undefined {
	let blueprint: Blueprint | undefined
	if (apiStudio.blueprintId) {
		blueprint = Blueprints.findOne(protectString(apiStudio.blueprintId))
		if (!blueprint) return undefined
		if (blueprint.blueprintType !== BlueprintManifestType.STUDIO) return undefined
	}

	let studio: DBStudio | undefined
	if (existingId) studio = Studios.findOne(existingId)

	const blueprintConfig = studio ? studio.blueprintConfigWithOverrides : wrapDefaultObject({})
	blueprintConfig.overrides = Object.entries(apiStudio.config).map(([key, value]) =>
		literal<ObjectOverrideSetOp>({
			op: 'set',
			path: key,
			value,
		})
	)
	const blueprintConfigWithOverrides = applyAndValidateOverrides(blueprintConfig)

	// remove any overrides that don't make a change from the default value
	blueprintConfig.overrides = blueprintConfig.overrides.filter((ov) => {
		const preserveOp = blueprintConfigWithOverrides.preserve.find((pr) => pr.path === ov.path)
		const unusedOp = blueprintConfigWithOverrides.unused.find((un) => un.path === ov.path)
		return preserveOp && preserveOp !== unusedOp
	})

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
		routeSets: {},
		_rundownVersionHash: '',
		routeSetExclusivityGroups: {},
		packageContainers: {},
		previewContainerIds: [],
		thumbnailContainerIds: [],
		lastBlueprintConfig: undefined,
	}
}

export function APIStudioFrom(studio: Studio): APIStudio {
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
		preserveUnsyncedPlayingSegmentContents: apiStudioSettings.preserveUnsyncedPlayingSegmentContents,
		allowRundownResetOnAir: apiStudioSettings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: apiStudioSettings.preserveOrphanedSegmentPositionInRundown,
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
		preserveUnsyncedPlayingSegmentContents: settings.preserveUnsyncedPlayingSegmentContents,
		allowRundownResetOnAir: settings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: settings.preserveOrphanedSegmentPositionInRundown,
	}
}
