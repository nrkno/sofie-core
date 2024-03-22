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
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { SnapshotItem } from '../../lib/collections/Snapshots'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
import { TranslationsBundle } from '../../lib/collections/TranslationsBundles'
import { DBTriggeredActions } from '../../lib/collections/TriggeredActions'
import { UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { DBUser } from '../../lib/collections/Users'
import { WorkerStatus } from '../../lib/collections/Workers'
import { registerIndex } from './indices'
import { getCurrentTime, MeteorStartupAsync } from '../../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import {
	createAsyncOnlyMongoCollection,
	createAsyncOnlyReadOnlyMongoCollection,
	wrapMongoCollection,
} from './collection'
import { ObserveChangesForHash } from './lib'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { logNotAllowed, allowOnlyFields, rejectFields } from '../security/lib/lib'
import {
	allowAccessToCoreSystem,
	allowAccessToOrganization,
	allowAccessToShowStyleBase,
	allowAccessToStudio,
} from '../security/lib/security'
import { SystemWriteAccess } from '../security/system'

export * from './bucket'
export * from './packages-media'
export * from './rundown'

export const Blueprints = createAsyncOnlyMongoCollection<Blueprint>(CollectionName.Blueprints, {
	update(_userId, doc, fields, _modifier) {
		return allowOnlyFields(doc, fields, ['name', 'disableVersionChecks'])
	},
})
registerIndex(Blueprints, {
	organizationId: 1,
})

export const CoreSystem = createAsyncOnlyMongoCollection<ICoreSystem>(CollectionName.CoreSystem, {
	async update(userId, doc, fields, _modifier) {
		const cred = await resolveCredentials({ userId: userId })
		const access = await allowAccessToCoreSystem(cred)
		if (!access.update) return logNotAllowed('CoreSystem', access.reason)

		return allowOnlyFields(doc, fields, [
			'support',
			'systemInfo',
			'name',
			'logLevel',
			'apm',
			'cron',
			'logo',
			'evaluations',
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

export const Organizations = createAsyncOnlyMongoCollection<DBOrganization>(CollectionName.Organizations, {
	async update(userId, doc, fields, _modifier) {
		const access = await allowAccessToOrganization({ userId: userId }, doc._id)
		if (!access.update) return logNotAllowed('Organization', access.reason)
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
	update(_userId, doc, fields, _modifier) {
		return rejectFields(doc, fields, [
			'type',
			'parentDeviceId',
			'versions',
			'created',
			'status',
			'lastSeen',
			'lastConnected',
			'connected',
			'connectionId',
			'token',
			// 'settings' is allowed
		])
	},
})
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

export const RundownLayouts = createAsyncOnlyMongoCollection<RundownLayoutBase>(CollectionName.RundownLayouts, {
	async update(userId, doc, fields) {
		const access = await allowAccessToShowStyleBase({ userId: userId }, doc.showStyleBaseId)
		if (!access.update) return logNotAllowed('ShowStyleBase', access.reason)
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
		const access = await allowAccessToShowStyleBase({ userId: userId }, doc._id)
		if (!access.update) return logNotAllowed('ShowStyleBase', access.reason)
		return rejectFields(doc, fields, ['_id'])
	},
})
registerIndex(ShowStyleBases, {
	organizationId: 1,
})

export const ShowStyleVariants = createAsyncOnlyMongoCollection<DBShowStyleVariant>(CollectionName.ShowStyleVariants, {
	async update(userId, doc, fields) {
		const access = await allowAccessToShowStyleBase({ userId: userId }, doc.showStyleBaseId)
		if (!access.update) return logNotAllowed('ShowStyleBase', access.reason)

		return rejectFields(doc, fields, ['showStyleBaseId'])
	},
})
registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
	_rank: 1,
})

export const Snapshots = createAsyncOnlyMongoCollection<SnapshotItem>(CollectionName.Snapshots, {
	update(_userId, doc, fields, _modifier) {
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
		const access = await allowAccessToStudio({ userId: userId }, doc._id)
		if (!access.update) return logNotAllowed('Studio', access.reason)
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
		const cred = await resolveCredentials({ userId: userId })

		if (doc.showStyleBaseId) {
			const access = await allowAccessToShowStyleBase(cred, doc.showStyleBaseId)
			if (!access.update) return logNotAllowed('ShowStyleBase', access.reason)
			return rejectFields(doc, fields, ['_id'])
		} else {
			const access = await allowAccessToCoreSystem(cred)
			if (!access.update) return logNotAllowed('CoreSystem', access.reason)
			return rejectFields(doc, fields, ['_id'])
		}
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

// This is a somewhat special collection, as it draws from the Meteor.users collection from the Accounts package
export const Users = wrapMongoCollection<DBUser>(Meteor.users as any, CollectionName.Users, {
	async update(userId, doc, fields, _modifier) {
		const access = await SystemWriteAccess.currentUser(userId, { userId })
		if (!access) return logNotAllowed('CurrentUser', '')
		return rejectFields(doc, fields, [
			'_id',
			'createdAt',
			'services',
			'emails',
			'profile',
			'organizationId',
			'superAdmin',
		])
	},
})
registerIndex(Users, {
	organizationId: 1,
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
