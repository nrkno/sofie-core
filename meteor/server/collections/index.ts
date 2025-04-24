/**
 * This file contains or exports all of the 'server-side' mongo collections.
 * These are intended to be async-only collections that are only compatible with the execution model in the meteor backend.
 * There are client safe versions exposed elsewhere, and some 'duplicates' in `lib` for code that resides in `lib`
 */

import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { Meteor } from 'meteor/meteor'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { Evaluation } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { DBOrganization } from '@sofie-automation/meteor-lib/dist/collections/Organization'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { SnapshotItem } from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
import { TranslationsBundle } from '@sofie-automation/meteor-lib/dist/collections/TranslationsBundles'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { WorkerStatus } from '@sofie-automation/meteor-lib/dist/collections/Workers'
import { registerIndex } from './indices'
import { getCurrentTime } from '../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { createAsyncOnlyMongoCollection, createAsyncOnlyReadOnlyMongoCollection } from './collection'
import { ObserveChangesForHash } from './lib'
import { logger } from '../logging'
import { allowOnlyFields, rejectFields } from '../security/allowDeny'
import { checkUserIdHasOneOfPermissions } from '../security/auth'
import { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'

export * from './bucket'
export * from './packages-media'
export * from './rundown'

export const Blueprints = createAsyncOnlyMongoCollection<Blueprint>(CollectionName.Blueprints, {
	update(userId, doc, fields, _modifier) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.Blueprints, 'configure')) return false

		return allowOnlyFields(doc, fields, ['name', 'disableVersionChecks'])
	},
})
registerIndex(Blueprints, {
	organizationId: 1,
})

export const CoreSystem = createAsyncOnlyMongoCollection<ICoreSystem>(CollectionName.CoreSystem, {
	async update(userId, doc, fields, _modifier) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.CoreSystem, 'configure')) return false

		return allowOnlyFields(doc, fields, [
			'systemInfo',
			'name',
			'logLevel',
			'apm',
			'logo',
			'blueprintId',
			'settingsWithOverrides',
		])
	},
})

export const Evaluations = createAsyncOnlyMongoCollection<Evaluation>(CollectionName.Evaluations, false)
registerIndex(Evaluations, {
	organizationId: 1,
	timestamp: 1,
})

export const ExternalMessageQueue = createAsyncOnlyMongoCollection<ExternalMessageQueueObj>(
	CollectionName.ExternalMessageQueue,
	false
)
registerIndex(ExternalMessageQueue, {
	studioId: 1,
	created: 1,
})
registerIndex(ExternalMessageQueue, {
	sent: 1,
	lastTry: 1,
})
registerIndex(ExternalMessageQueue, {
	studioId: 1,
	rundownId: 1,
})

export const Notifications = createAsyncOnlyMongoCollection<DBNotificationObj>(CollectionName.Notifications, false)
// For NotificationsModelHelper.getAllNotifications
registerIndex(Notifications, {
	// @ts-expect-error nested property
	'relatedTo.studioId': 1,
	catgory: 1,
})
// For MeteorPubSub.notificationsForRundownPlaylist
registerIndex(Notifications, {
	// @ts-expect-error nested property
	'relatedTo.studioId': 1,
	'relatedTo.playlistId': 1,
})
// For MeteorPubSub.notificationsForRundown
registerIndex(Notifications, {
	// @ts-expect-error nested property
	'relatedTo.studioId': 1,
	'relatedTo.rundownId': 1,
})

export const Organizations = createAsyncOnlyMongoCollection<DBOrganization>(CollectionName.Organizations, {
	async update(userId, doc, fields, _modifier) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.Organizations, 'configure')) return false

		return allowOnlyFields(doc, fields, ['userRoles'])
	},
})

export const PeripheralDeviceCommands = createAsyncOnlyMongoCollection<PeripheralDeviceCommand>(
	CollectionName.PeripheralDeviceCommands,
	false
)
registerIndex(PeripheralDeviceCommands, {
	deviceId: 1,
})

export const PeripheralDevices = createAsyncOnlyMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices, {
	update(userId, doc, fields, _modifier) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.PeripheralDevices, 'configure')) return false

		return allowOnlyFields(doc, fields, [
			'name',
			'deviceName',
			'organizationId',
			'disableVersionChecks',
			'nrcsName',
			'ignore',
		])
	},
})
registerIndex(PeripheralDevices, {
	organizationId: 1,
	studioAndConfigId: 1,
})
registerIndex(PeripheralDevices, {
	studioAndConfigId: 1,
})
registerIndex(PeripheralDevices, {
	token: 1,
})

export const RundownLayouts = createAsyncOnlyMongoCollection<RundownLayoutBase>(CollectionName.RundownLayouts, {
	async update(userId, doc, fields) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.RundownLayouts, 'configure')) return false

		return rejectFields(doc, fields, ['_id', 'showStyleBaseId'])
	},
})
// addIndex(RundownLayouts, {
// 	studioId: 1,
// 	collectionId: 1,
// 	objId: 1,
// 	mediaId: 1
// })
registerIndex(RundownLayouts, {
	showStyleBaseId: 1,
})

export const ShowStyleBases = createAsyncOnlyMongoCollection<DBShowStyleBase>(CollectionName.ShowStyleBases, {
	async update(userId, doc, fields) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.ShowStyleBases, 'configure')) return false

		return rejectFields(doc, fields, ['_id'])
	},
})
registerIndex(ShowStyleBases, {
	organizationId: 1,
})

export const ShowStyleVariants = createAsyncOnlyMongoCollection<DBShowStyleVariant>(CollectionName.ShowStyleVariants, {
	async update(userId, doc, fields) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.ShowStyleVariants, 'configure')) return false

		return rejectFields(doc, fields, ['showStyleBaseId'])
	},
})
registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
	_rank: 1,
})

export const Snapshots = createAsyncOnlyMongoCollection<SnapshotItem>(CollectionName.Snapshots, {
	update(userId, doc, fields, _modifier) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.Snapshots, 'configure')) return false

		return allowOnlyFields(doc, fields, ['comment'])
	},
})
registerIndex(Snapshots, {
	organizationId: 1,
})
registerIndex(Snapshots, {
	created: 1,
})

export const Studios = createAsyncOnlyMongoCollection<DBStudio>(CollectionName.Studios, {
	async update(userId, doc, fields, _modifier) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.Studios, 'configure')) return false

		return rejectFields(doc, fields, ['_id'])
	},
})
registerIndex(Studios, {
	organizationId: 1,
})

export const Timeline = createAsyncOnlyReadOnlyMongoCollection<TimelineComplete>(CollectionName.Timelines)
// Note: this index is always created by default, so it's not needed.
// registerIndex(Timeline, {
// 	_id: 1,
// })

export const TimelineDatastore = createAsyncOnlyReadOnlyMongoCollection<DBTimelineDatastoreEntry>(
	CollectionName.TimelineDatastore
)
registerIndex(TimelineDatastore, {
	studioId: 1,
})

export const TranslationsBundles = createAsyncOnlyMongoCollection<TranslationsBundle>(
	CollectionName.TranslationsBundles,
	false
)

export const TriggeredActions = createAsyncOnlyMongoCollection<DBTriggeredActions>(CollectionName.TriggeredActions, {
	async update(userId, doc, fields) {
		if (!checkUserIdHasOneOfPermissions(userId, CollectionName.TriggeredActions, 'configure')) return false

		return rejectFields(doc, fields, ['_id'])
	},
})
registerIndex(TriggeredActions, {
	showStyleBaseId: 1,
})

export const UserActionsLog = createAsyncOnlyMongoCollection<UserActionsLogItem>(CollectionName.UserActionsLog, false)
registerIndex(UserActionsLog, {
	organizationId: 1,
	timestamp: 1,
})
registerIndex(UserActionsLog, {
	timelineHash: 1,
})

export const Workers = createAsyncOnlyMongoCollection<WorkerStatus>(CollectionName.Workers, false)

export const WorkerThreadStatuses = createAsyncOnlyMongoCollection<WorkerThreadStatus>(
	CollectionName.WorkerThreads,
	false
)

// Monitor and remove old, lingering commands:
const removeOldCommands = () => {
	PeripheralDeviceCommands.removeAsync({
		$or: [
			{
				time: { $exists: false },
			},
			{
				// timeout a long time ago
				time: { $lte: getCurrentTime() - 20 * 1000 },
			},
		],
	}).catch((e) => {
		logger.error(`Failed to cleanup old PeripheralDeviceCommands: ${stringifyError(e)}`)
	})
}
Meteor.startup(async () => {
	Meteor.setInterval(() => removeOldCommands(), 5 * 60 * 1000)

	await Promise.allSettled([
		ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['blueprintConfigWithOverrides', 'blueprintId']),

		ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', [
			'blueprintConfigWithOverrides',
			'showStyleBaseId',
		]),

		ObserveChangesForHash(Studios, '_rundownVersionHash', ['blueprintConfigWithOverrides']),
	])
})
