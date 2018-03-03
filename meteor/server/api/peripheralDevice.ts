import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { check } from 'meteor/check';
import * as _ from 'underscore';

import {PeripheralDeviceAPI} from '../../lib/api/peripheralDevice';
import { PeripheralDevices } from "../../lib/collections/PeripheralDevices";
import { getCurrentTime } from "../../lib/lib";
import { PeripheralDeviceSecurity } from "../security/peripheralDevices";



// ---------------------------------------------------------------
export namespace ServerPeripheralDeviceAPI {

	export function initialize(id:string, token:string, options: PeripheralDeviceAPI.InitOptions):string {
		check(id, String);
		check(token, String);
		check(options, Object);
		check(options.name, String);
		check(options.type, Number);

		var peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this);

		if (!peripheralDevice) {
			// Add a new device 

			PeripheralDevices.insert({
				_id: id,
				created: getCurrentTime(),
				status: {
					statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN
				},
				connected: false, // this is set at another place
				connectionSession: null,
				lastSeen: getCurrentTime(),
				token: token,
				type: options.type,
				name: options.name,

			});

		} else {
			// Udate the device:

			PeripheralDevices.update(id, {$set: {
				lastSeen: getCurrentTime()
			}});

		}
		return id;
	}
	export function unInitialize(id:string, token:string):string {

		var peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this);
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '"+id+"' not found!");

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(id);
		return id;
	}
	export function setStatus(id:string, token:string, status:PeripheralDeviceAPI.StatusObject):PeripheralDeviceAPI.StatusObject {
		check(id, String);
		check(token, String);
		check(status, Object);
		check(status.statusCode, Number);

		var peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this);
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '"+id+"' not found!");


		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {
			// perform the update:
			PeripheralDevices.update(id, {$set: {
				status: status
			}});
		}
		return status;
	}
}


const methods = {};
methods[PeripheralDeviceAPI.methods.initialize] = (id, token, options) => {
	return ServerPeripheralDeviceAPI.initialize(id, token, options);
};
methods[PeripheralDeviceAPI.methods.unInitialize] = (id, token) => {
	return ServerPeripheralDeviceAPI.unInitialize(id, token);
};
methods[PeripheralDeviceAPI.methods.setStatus] = (id, token, status) => {
	return ServerPeripheralDeviceAPI.setStatus(id, token, status);
};

// Apply methods:
Meteor.methods(methods);