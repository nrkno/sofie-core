import { RundownId } from './core/model/Ids'
import { ProtectedString } from './lib/protectedString'
import { TSR } from './tsr'

/** @deprecated */
export interface ExpectedPlayoutItemGeneric {
	_id: ProtectedString<any> // TODO - type

	/** What type of playout device this item should be handled by */
	deviceSubType: TSR.DeviceType // subset of PeripheralDeviceAPI.DeviceSubType
	/** Which playout device this item should be handled by */
	// deviceId: string // Todo: implement deviceId support (later)
	/** Content of the expectedPlayoutItem */
	content: TSR.ExpectedPlayoutItemContent
}

export interface ExpectedPlayoutItemPeripheralDevice extends ExpectedPlayoutItemGeneric {
	rundownId?: RundownId

	baseline?: 'rundown' | 'studio'
}

type ExpectedPlayoutItemContent = TSR.ExpectedPlayoutItemContent
export { ExpectedPlayoutItemContent }
