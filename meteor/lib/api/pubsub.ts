import { Meteor } from 'meteor/meteor'

export enum PubSub {
	asRunLog = 'asRunLog',
	blueprints = 'blueprints',
	coreSystem = 'coreSystem',
	evaluations = 'evaluations',
	expectedPlayoutItems = 'expectedPlayoutItems',
	expectedMediaItems = 'expectedMediaItems',
	externalMessageQueue = 'externalMessageQueue',
	mediaObjects = 'mediaObjects',
	peripheralDeviceCommands = 'peripheralDeviceCommands',
	peripheralDevices = 'peripheralDevices',
	peripheralDevicesAndSubDevices = ' peripheralDevicesAndSubDevices',
	rundownBaselineAdLibPieces = 'rundownBaselineAdLibPieces',
	rundownBaselineAdLibActions = 'rundownBaselineAdLibActions',
	ingestDataCache = 'ingestDataCache',
	rundownPlaylists = 'rundownPlaylists',
	rundowns = 'rundowns',
	adLibActions = 'adLibActions',
	adLibPieces = 'adLibPieces',
	pieces = 'pieces',
	piecesSimple = 'piecesSimple',
	pieceInstances = 'pieceInstances',
	pieceInstancesSimple = 'pieceInstancesSimple',
	parts = 'parts',
	partInstances = 'partInstances',
	segments = 'segments',
	showStyleBases = 'showStyleBases',
	showStyleVariants = 'showStyleVariants',
	snapshots = 'snapshots',
	studios = 'studios',
	studioOfDevice = 'studioOfDevice',
	timeline = 'timeline',
	userActionsLog = 'userActionsLog',
	mediaWorkFlows = 'mediaWorkFlows',
	mediaWorkFlowSteps = 'mediaWorkFlowSteps',
	rundownLayouts = 'rundownLayouts',
	loggedInUser = 'loggedInUser',
	usersInOrganization = 'usersInOrganization',
	organization = 'organization',
	buckets = 'buckets',
	bucketAdLibPieces = 'bucketAdLibPieces',
	// custom publications:
	mappingsForDevice = 'mappingsForDevice',
	timelineForDevice = 'timelineForDevice',
}

export function meteorSubscribe(name: PubSub, ...args: any[]): Meteor.SubscriptionHandle {
	if (Meteor.isClient) {
		return Meteor.subscribe(name, ...args)
	} else throw new Meteor.Error(500, 'meteorSubscribe is only available client-side')
}
