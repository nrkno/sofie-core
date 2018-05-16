/* Integration test for peripheralDevice */


import * as chai from 'chai';
import { Random } from 'meteor/random';
import {} from 'mocha';

import { PeripheralDevices } from '../../lib/collections/PeripheralDevices';
//import { ServerPeripheralDeviceAPI } from '../peripheralDevice';
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice';

import {getCurrentTime} from '../../lib/lib';

const expect = chai.expect;





describe('Access to peripheralDevice API', function () {
	beforeEach(function() {
		//console.log('Logout');
	});
	afterEach(function() {
		//console.log('Logout');
	});
	/*
	
	it('peripheralDevice.setStatus()', async function () {


		var deviceId = Random.id();
		var token = Random.id();

		var returnedId = await PeripheralDeviceAPI.init(deviceId, token);

		var returnedStatus = await PeripheralDeviceAPI.setStatus(deviceId, {
			statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
			messages: ["It's all good"]
		});


		// check that there is an object
		var md = PeripheralDevices.findOne(deviceId);
		expect(md).to.be.an('object');

		expect(md.status).to.be.an('object');
		expect(md.status.statusCode).to.be.equal(PeripheralDeviceAPI.StatusCode.GOOD);
		expect(md.status.messages).to.have.length(1);


		// clear up after ourselves:

	});
	
	 */
	
})
