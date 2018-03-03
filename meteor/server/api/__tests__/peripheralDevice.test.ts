import * as chai from 'chai';
import StubCollections from 'meteor/hwillson:stub-collections';
import { Random } from 'meteor/random';
import {} from 'mocha';

import { PeripheralDevices } from '../../../lib/collections/PeripheralDevices';
import { ServerPeripheralDeviceAPI } from '../peripheralDevice';
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice';

import {getCurrentTime} from '../../../lib/lib';


//var StubCollections = require('meteor/hwillson:stub-collections');



const expect = chai.expect;
const assert = chai.assert;



describe('peripheralDevice API methods', function () {
	
	beforeEach(function() {
		StubCollections.stub(PeripheralDevices);
	});

	afterEach(function() {
		StubCollections.restore();
});

	it('peripheralDevice.initialize()', function () {
		
		var deviceId = Random.id();
		var token = Random.id();
		var options = {
			type: 0,
			name: 'test'
		}

		var returnedId = ServerPeripheralDeviceAPI.initialize(deviceId, token, options);

		expect(deviceId).to.equal(returnedId);

		// check that there is an object
		var md = PeripheralDevices.findOne(deviceId);

		expect(md).to.be.an('object');
		expect(md).to.have.property('_id')
		expect(md._id).to.be.equal(deviceId);
		expect(md.created).to.be.closeTo(getCurrentTime(), 1000);

	});
	
	it('peripheralDevice.setStatus()', function () {


		var deviceId = Random.id();
		var token = Random.id();
		var options = {
			type: 0,
			name: 'test'
		}

		var returnedId = ServerPeripheralDeviceAPI.initialize(deviceId, token, options);

		var returnedStatus = ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
			statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
			messages: ["It's all good"]
		});


		// check that there is an object
		var md = PeripheralDevices.findOne(deviceId);
		expect(md).to.be.an('object');

		// Check object status:
		expect(md.status).to.be.an('object');
		expect(md.status.statusCode).to.be.equal(PeripheralDeviceAPI.StatusCode.GOOD);
		expect(md.status.messages).to.have.length(1);
	});

	it('peripheralDevice.initialize() with bad arguments', async function () {
		var deviceId = Random.id();
		var token = Random.id();

		var options = {
			type: 0,
			name: 'test'
		}

		expect(() => {
			return ServerPeripheralDeviceAPI.initialize('', token, options) // missing id
		}).to.throw()

		expect(() => {
			return ServerPeripheralDeviceAPI.initialize(deviceId, '', options) // missing token
		}).to.throw()

		expect(() => {
			
			return ServerPeripheralDeviceAPI.initialize(deviceId, token, <any>null) // missing options
		}).to.throw()

		expect(() => {
			
			return ServerPeripheralDeviceAPI.initialize(deviceId, token, <any>{}) // bad options
		}).to.throw()
	});
	
	it('peripheralDevice.setStatus() with bad arguments', async function () {
		var deviceId = Random.id();
		var token = Random.id();
		var options = {
			type: 0,
			name: 'test'
		}

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			}) 
		}).to.throw() // because device is not initialized yet

		var returnedId = ServerPeripheralDeviceAPI.initialize(deviceId, token, options);

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			}) 
		}).to.not.throw() 

		// try with bad arguments:
		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, <any>{} ) // missing statusCode
		}).to.throw() 

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, <any>null) // missing status
		}).to.throw() 

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, '', { // missing token
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			}) 
		}).to.throw() 

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus('', token, { // missing id
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			}) 
		}).to.throw() 

	});
})
