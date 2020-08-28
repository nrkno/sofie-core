import { TSR } from 'tv-automation-sofie-blueprints-integration'
import { StudioId } from '../collections/Studios'

export interface NewStudiosAPI {
	insertStudio(): Promise<StudioId>
	removeStudio(studioId: StudioId): Promise<void>
}

export enum StudiosAPIMethods {
	'insertStudio' = 'studio.insertStudio',
	'removeStudio' = 'studio.removeStudio',
}

export function mappingIsAbstract(mapping: TSR.Mapping): mapping is TSR.MappingAbstract {
	return mapping.device === TSR.DeviceType.ABSTRACT
}
export function mappingIsCasparCG(mapping: TSR.Mapping): mapping is TSR.MappingCasparCG {
	return mapping.device === TSR.DeviceType.CASPARCG
}
export function mappingIsAtem(mapping: TSR.Mapping): mapping is TSR.MappingAtem {
	return mapping.device === TSR.DeviceType.ATEM
}
export function mappingIsLawo(mapping: TSR.Mapping): mapping is TSR.MappingLawo {
	return mapping.device === TSR.DeviceType.LAWO
}
export function mappingIsHTTPSend(mapping: TSR.Mapping): mapping is TSR.MappingHTTPSend {
	return mapping.device === TSR.DeviceType.HTTPSEND
}
export function mappingIsPanasonicPtz(mapping: TSR.Mapping): mapping is TSR.MappingPanasonicPtz {
	return mapping.device === TSR.DeviceType.PANASONIC_PTZ
}
export function mappingIsTCPSend(mapping: TSR.Mapping): mapping is TSR.MappingTCPSend {
	return mapping.device === TSR.DeviceType.TCPSEND
}
export function mappingIsHyperdeck(mapping: TSR.Mapping): mapping is TSR.MappingHyperdeck {
	return mapping.device === TSR.DeviceType.HYPERDECK
}
export function mappingIsPharos(mapping: TSR.Mapping): mapping is TSR.MappingPharos {
	return mapping.device === TSR.DeviceType.PHAROS
}
export function mappingIsOSC(mapping: TSR.Mapping): mapping is TSR.MappingOSC {
	return mapping.device === TSR.DeviceType.OSC
}
export function mappingIsHTTPWatcher(mapping: TSR.Mapping): mapping is TSR.MappingHTTPWatcher {
	return mapping.device === TSR.DeviceType.HTTPWATCHER
}
export function mappingIsSisyfos(mapping: TSR.Mapping): mapping is TSR.MappingSisyfos {
	return mapping.device === TSR.DeviceType.SISYFOS
}
export function mappingIsSisyfosChannel(mapping: TSR.MappingSisyfos): mapping is TSR.MappingSisyfosChannel {
	return mapping.mappingType === TSR.MappingSisyfosType.CHANNEL
}
export function mappingIsQuantel(mapping: TSR.Mapping): mapping is TSR.MappingQuantel {
	return mapping.device === TSR.DeviceType.QUANTEL
}
