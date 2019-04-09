// Note: The interface defined in this file is intended to replace the mos-specific implementation in the end

import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'

import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import {
	PeripheralDevices,
	PeripheralDevice
} from '../../../lib/collections/PeripheralDevices'
import {
	RunningOrder,
	RunningOrders,
	DBRunningOrder
} from '../../../lib/collections/RunningOrders'
import {
	SegmentLine,
	SegmentLines,
	DBSegmentLine,
	SegmentLineNoteType,
	SegmentLineNote
} from '../../../lib/collections/SegmentLines'
import {
	SegmentLineItem,
	SegmentLineItems
} from '../../../lib/collections/SegmentLineItems'
import {
	saveIntoDb,
	getCurrentTime,fetchBefore,
	getRank,
	fetchAfter,
	literal,
	getHash
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import {
	Methods, setMeteorMethods, wrapMethods
} from '../../methods'

export namespace RunningOrderInput {

	export function dataRunningOrderDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderDelete', runningOrderId)
	}
	export function dataRunningOrderCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderCreate', runningOrderId, runningOrderData)
	}
	export function dataRunningOrderUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderUpdate', runningOrderId, runningOrderData)
	}
	export function dataSegmentDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentDelete', runningOrderId, segmentId)
	}
	export function dataSegmentCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentCreate', runningOrderId, segmentId, newSection)
	}
	export function dataSegmentUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentUpdate', runningOrderId, segmentId, newSection)
	}
	export function dataSegmentLineItemDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineItemDelete', runningOrderId, segmentId, segmentLineId)
	}
	export function dataSegmentLineItemCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineItemCreate', runningOrderId, segmentId, segmentLineId, newStory)
	}
	export function dataSegmentLineItemUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineItemUpdate', runningOrderId, segmentId, segmentLineId, newStory)
	}
}

let methods: Methods = {}

methods[PeripheralDeviceAPI.methods.dataRunningOrderDelete] = (deviceId: string, deviceToken: string, runningOrderId: string) => {
	return RunningOrderInput.dataRunningOrderDelete(this, deviceId, deviceToken, runningOrderId)
}
methods[PeripheralDeviceAPI.methods.dataRunningOrderCreate] = (deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) => {
	return RunningOrderInput.dataRunningOrderCreate(this, deviceId, deviceToken, runningOrderId, runningOrderData)
}
methods[PeripheralDeviceAPI.methods.dataRunningOrderUpdate] = (deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) => {
	return RunningOrderInput.dataRunningOrderUpdate(this, deviceId, deviceToken, runningOrderId, runningOrderData)
}
methods[PeripheralDeviceAPI.methods.dataSegmentDelete] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string) => {
	return RunningOrderInput.dataSegmentDelete(this, deviceId, deviceToken, runningOrderId, segmentId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentCreate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) => {
	return RunningOrderInput.dataSegmentCreate(this, deviceId, deviceToken, runningOrderId, segmentId, newSection)
}
methods[PeripheralDeviceAPI.methods.dataSegmentUpdate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) => {
	return RunningOrderInput.dataSegmentUpdate(this, deviceId, deviceToken, runningOrderId, segmentId, newSection)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemDelete] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string) => {
	return RunningOrderInput.dataSegmentLineItemDelete(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemCreate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RunningOrderInput.dataSegmentLineItemCreate(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId, newStory)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemUpdate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RunningOrderInput.dataSegmentLineItemUpdate(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId, newStory)
}

setMeteorMethods(wrapMethods(methods))
