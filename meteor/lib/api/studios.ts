import { TSR } from '@sofie-automation/blueprints-integration'
import { MappingExt, StudioId } from '../collections/Studios'

export interface NewStudiosAPI {
	insertStudio(): Promise<StudioId>
	removeStudio(studioId: StudioId): Promise<void>
}

export enum StudiosAPIMethods {
	'insertStudio' = 'studio.insertStudio',
	'removeStudio' = 'studio.removeStudio',
}

export function mappingIsAbstract(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingAbstract {
	return mapping.device === TSR.DeviceType.ABSTRACT
}
export function mappingIsCasparCG(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingCasparCG {
	return mapping.device === TSR.DeviceType.CASPARCG
}
export function mappingIsAtem(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingAtem {
	return mapping.device === TSR.DeviceType.ATEM
}
export function mappingIsLawo(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingLawo {
	return mapping.device === TSR.DeviceType.LAWO
}
export function mappingIsHTTPSend(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingHTTPSend {
	return mapping.device === TSR.DeviceType.HTTPSEND
}
export function mappingIsPanasonicPtz(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingPanasonicPtz {
	return mapping.device === TSR.DeviceType.PANASONIC_PTZ
}
export function mappingIsTCPSend(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingTCPSend {
	return mapping.device === TSR.DeviceType.TCPSEND
}
export function mappingIsHyperdeck(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingHyperdeck {
	return mapping.device === TSR.DeviceType.HYPERDECK
}
export function mappingIsPharos(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingPharos {
	return mapping.device === TSR.DeviceType.PHAROS
}
export function mappingIsOSC(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingOSC {
	return mapping.device === TSR.DeviceType.OSC
}
export function mappingIsHTTPWatcher(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingHTTPWatcher {
	return mapping.device === TSR.DeviceType.HTTPWATCHER
}
export function mappingIsSisyfos(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingSisyfos {
	return mapping.device === TSR.DeviceType.SISYFOS
}
export function mappingIsSisyfosChannel(
	mapping: TSR.MappingSisyfos | MappingExt
): mapping is TSR.MappingSisyfosChannel {
	// @ts-ignore 'mappingType' does not exist on type 'MappingExt'
	return mapping.mappingType === TSR.MappingSisyfosType.CHANNEL
}
export function mappingIsQuantel(mapping: TSR.Mapping | MappingExt): mapping is TSR.MappingQuantel {
	return mapping.device === TSR.DeviceType.QUANTEL
}
