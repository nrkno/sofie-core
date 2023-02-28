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
import { ICoreSystem } from '../../lib/collections/CoreSystem'
import { Evaluation } from '../../lib/collections/Evaluations'
import { DBOrganization } from '../../lib/collections/Organization'
import { PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { SnapshotItem } from '../../lib/collections/Snapshots'
import { Studio } from '../../lib/collections/Studios'
import { TimelineComplete } from '../../lib/collections/Timeline'
import { TimelineDatastoreEntry } from '../../lib/collections/TimelineDatastore'
import { TranslationsBundle } from '../../lib/collections/TranslationsBundles'
import { DBTriggeredActions } from '../../lib/collections/TriggeredActions'
import { UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { DBUser } from '../../lib/collections/Users'
import { WorkerStatus } from '../../lib/collections/Workers'
import { registerIndex } from './indices'
import { getCurrentTime, MeteorStartupAsync } from '../../lib/lib'
import { createAsyncMongoCollection, createAsyncOnlyMongoCollection, wrapMongoCollection } from './collection'
import { ObserveChangesForHash, registerCollection } from './lib'

export * from './bucket'
export * from './packages-media'
export * from './rundown'

export const Blueprints = createAsyncMongoCollection<Blueprint>(CollectionName.Blueprints)
registerIndex(Blueprints, {
	organizationId: 1,
})

export const CoreSystem = createAsyncMongoCollection<ICoreSystem>(CollectionName.CoreSystem)

export const Evaluations = createAsyncMongoCollection<Evaluation>(CollectionName.Evaluations)
registerIndex(Evaluations, {
	organizationId: 1,
	timestamp: 1,
})

export const ExternalMessageQueue = createAsyncMongoCollection<ExternalMessageQueueObj>(
	CollectionName.ExternalMessageQueue
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

export const Organizations = createAsyncMongoCollection<DBOrganization>(CollectionName.Organizations)

export const PeripheralDeviceCommands = createAsyncMongoCollection<PeripheralDeviceCommand>(
	CollectionName.PeripheralDeviceCommands
)
registerIndex(PeripheralDeviceCommands, {
	deviceId: 1,
})

export const PeripheralDevices = createAsyncMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices)
registerIndex(PeripheralDevices, {
	organizationId: 1,
	studioId: 1,
})
registerIndex(PeripheralDevices, {
	studioId: 1,
})
registerIndex(PeripheralDevices, {
	token: 1,
})

export const RundownLayouts = createAsyncMongoCollection<RundownLayoutBase>(CollectionName.RundownLayouts)
// addIndex(RundownLayouts, {
// 	studioId: 1,
// 	collectionId: 1,
// 	objId: 1,
// 	mediaId: 1
// })
registerIndex(RundownLayouts, {
	showStyleBaseId: 1,
})

export const ShowStyleBases = createAsyncMongoCollection<ShowStyleBase>(CollectionName.ShowStyleBases)
registerIndex(ShowStyleBases, {
	organizationId: 1,
})

export const ShowStyleVariants = createAsyncMongoCollection<ShowStyleVariant>(CollectionName.ShowStyleVariants)
registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
	_rank: 1,
})

export const Snapshots = createAsyncMongoCollection<SnapshotItem>(CollectionName.Snapshots)
registerIndex(Snapshots, {
	organizationId: 1,
})
registerIndex(Snapshots, {
	created: 1,
})

export const Studios = createAsyncMongoCollection<Studio>(CollectionName.Studios)
registerIndex(Studios, {
	organizationId: 1,
})

export const Timeline = createAsyncMongoCollection<TimelineComplete>(CollectionName.Timelines)
// Note: this index is always created by default, so it's not needed.
// registerIndex(Timeline, {
// 	_id: 1,
// })

export const TimelineDatastore = createAsyncMongoCollection<TimelineDatastoreEntry>(CollectionName.TimelineDatastore)
registerIndex(TimelineDatastore, {
	studioId: 1,
})

export const TranslationsBundles = createAsyncMongoCollection<TranslationsBundle>(CollectionName.TranslationsBundles)

export const TriggeredActions = createAsyncMongoCollection<DBTriggeredActions>(CollectionName.TriggeredActions)
registerIndex(TriggeredActions, {
	showStyleBaseId: 1,
})

export const UserActionsLog = createAsyncMongoCollection<UserActionsLogItem>(CollectionName.UserActionsLog)
registerIndex(UserActionsLog, {
	organizationId: 1,
	timestamp: 1,
})
registerIndex(UserActionsLog, {
	timelineHash: 1,
})

// This is a somewhat special collection, as it draws from the Meteor.users collection from the Accounts package
export const Users = wrapMongoCollection<DBUser>(Meteor.users as any, CollectionName.Users)
registerCollection(CollectionName.Users, Users)
registerIndex(Users, {
	organizationId: 1,
})

export const Workers = createAsyncOnlyMongoCollection<WorkerStatus>(CollectionName.Workers)

export const WorkerThreadStatuses = createAsyncOnlyMongoCollection<WorkerThreadStatus>(CollectionName.WorkerThreads)

// Monitor and remove old, lingering commands:
const removeOldCommands = () => {
	PeripheralDeviceCommands.find().forEach((cmd) => {
		if (getCurrentTime() - (cmd.time || 0) > 20 * 1000) {
			// timeout a long time ago
			PeripheralDeviceCommands.remove(cmd._id)
		}
	})
}
MeteorStartupAsync(async () => {
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
