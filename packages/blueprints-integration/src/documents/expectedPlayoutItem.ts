import type { TSR } from '../timeline'

/** @deprecated */
export interface ExpectedPlayoutItemGeneric {
	/** What type of playout device this item should be handled by */
	deviceSubType: TSR.DeviceType // subset of PeripheralDeviceAPI.DeviceSubType
	/** Which playout device this item should be handled by */
	// deviceId: string // Todo: implement deviceId support (later)
	/** Content of the expectedPlayoutItem */
	content: TSR.ExpectedPlayoutItemContent
}

type ExpectedPlayoutItemContent = TSR.ExpectedPlayoutItemContent
export { ExpectedPlayoutItemContent }
