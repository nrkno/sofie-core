import { Mongo } from 'meteor/mongo';
import {PeripheralDeviceAPI} from '../../lib/api/peripheralDevice';
import {Time} from '../../lib/lib';




export interface PeripheralDevice {
	_id: string,
	status: PeripheralDeviceAPI.StatusObject,
	created: Time,
	lastSeen: Time,
	connected: boolean,
	connectionSession: string|null,
	token: string

}


export const PeripheralDevices = new Mongo.Collection<PeripheralDevice>('PeripheralDevices');
