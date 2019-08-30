import {
	MappingCasparCG,
	MappingAtem,
	MappingLawo,
	MappingHyperdeck,
	MappingPanasonicPtz,
	MappingQuantel,
	DeviceType,
	Mapping,
	MappingAbstract,
	MappingHTTPSend,
	MappingHTTPWatcher,
	MappingTCPSend,
	MappingPharos,
	MappingOSC
} from 'timeline-state-resolver-types'
import { MappingSisyfos } from 'timeline-state-resolver-types/dist/sisyfos'

export namespace StudiosAPI {
		export enum methods {
		'insertStudio' = 'showstyles.insertStudio',
		'removeStudio' = 'showstyles.removeStudio',
	}
}

export function mappingIsAbstract (mapping: Mapping): mapping is MappingAbstract {
	return mapping.device === DeviceType.ABSTRACT
}
export function mappingIsCasparCG (mapping: Mapping): mapping is MappingCasparCG {
	return mapping.device === DeviceType.CASPARCG
}
export function mappingIsAtem (mapping: Mapping): mapping is MappingAtem {
	return mapping.device === DeviceType.ATEM
}
export function mappingIsLawo (mapping: Mapping): mapping is MappingLawo {
	return mapping.device === DeviceType.LAWO
}
export function mappingIsHTTPSend (mapping: Mapping): mapping is MappingHTTPSend {
	return mapping.device === DeviceType.HTTPSEND
}
export function mappingIsPanasonicPtz (mapping: Mapping): mapping is MappingPanasonicPtz {
	return mapping.device === DeviceType.PANASONIC_PTZ
}
export function mappingIsTCPSend (mapping: Mapping): mapping is MappingTCPSend {
	return mapping.device === DeviceType.TCPSEND
}
export function mappingIsHyperdeck (mapping: Mapping): mapping is MappingHyperdeck {
	return mapping.device === DeviceType.HYPERDECK
}
export function mappingIsPharos (mapping: Mapping): mapping is MappingPharos {
	return mapping.device === DeviceType.PHAROS
}
export function mappingIsOSC (mapping: Mapping): mapping is MappingOSC {
	return mapping.device === DeviceType.OSC
}
export function mappingIsHTTPWatcher (mapping: Mapping): mapping is MappingHTTPWatcher {
	return mapping.device === DeviceType.HTTPWATCHER
}
export function mappingIsSisyfos (mapping: Mapping): mapping is MappingSisyfos {
	return mapping.device === DeviceType.SISYFOS
}
export function mappingIsQuantel (mapping: Mapping): mapping is MappingQuantel {
	return mapping.device === DeviceType.QUANTEL
}
