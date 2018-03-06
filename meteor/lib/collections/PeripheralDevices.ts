import { Mongo } from 'meteor/mongo';
import {PeripheralDeviceAPI} from '../../lib/api/peripheralDevice';
import {Time} from '../../lib/lib';




export interface PeripheralDevice {
	_id: string,

	name: string,
	type: PeripheralDeviceAPI.DeviceType,

	created: Time,
	status: PeripheralDeviceAPI.StatusObject,
	lastSeen: Time,

	connected: boolean,
	connectionSession: string|null,

	token: string,

}


export const PeripheralDevices = new Mongo.Collection<PeripheralDevice>('peripheralDevices');
