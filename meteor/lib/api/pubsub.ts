import { Meteor } from 'meteor/meteor'

export enum PubSub {
	asRunLog = 'asRunLog',
	blueprints = 'blueprints',
	coreSystem = 'coreSystem',
	evaluations = 'evaluations',
	expectedMediaItems = 'expectedMediaItems',
	externalMessageQueue = 'externalMessageQueue',
	mediaObjects = 'mediaObjects',
	peripheralDeviceCommands = 'peripheralDeviceCommands',
	allPeripheralDeviceCommands = 'allPeripheralDeviceCommands',
	peripheralDevices = 'peripheralDevices',
	peripheralDevicesAndSubDevices = ' peripheralDevicesAndSubDevices',
	recordedFiles = 'recordedFiles',
	runningOrderBaselineAdLibItems = 'runningOrderBaselineAdLibItems',
	runningOrderDataCache = 'runningOrderDataCache',
	runningOrders = 'runningOrders',
	segmentLineAdLibItems = 'segmentLineAdLibItems',
	segmentLineItems = 'segmentLineItems',
	segmentLineItemsSimple = 'segmentLineItemsSimple',
	segmentLines = 'segmentLines',
	segments = 'segments',
	showStyleBases = 'showStyleBases',
	showStyleVariants = 'showStyleVariants',
	snapshots = 'snapshots',
	studioInstallations = 'studioInstallations',
	studioInstallationOfDevice = 'studioInstallationOfDevice',
	timeline = 'timeline',
	userActionsLog = 'userActionsLog'
}

export function meteorSubscribe (name: PubSub, ...args: any[]): Meteor.SubscriptionHandle {
	if (Meteor.isClient) {
		return Meteor.subscribe(name, ...args)
	} else throw new Meteor.Error(500, 'meteorSubscribe is only available client-side')
}
