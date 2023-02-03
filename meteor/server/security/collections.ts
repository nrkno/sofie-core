import { CoreSystem } from '../../lib/collections/CoreSystem'
import {
	allowAccessToCoreSystem,
	allowAccessToStudio,
	allowAccessToShowStyleBase,
	allowAccessToOrganization,
} from './lib/security'
import { logNotAllowed, allowOnlyFields, rejectFields } from './lib/lib'
import { Users } from '../../lib/collections/Users'
import { Organizations } from '../../lib/collections/Organization'
import { UserActionsLog } from '../../lib/collections/UserActionsLog'
import { Snapshots } from '../../lib/collections/Snapshots'
import { Studios, Studio } from '../../lib/collections/Studios'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands, PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'
import { MediaWorkFlowStep } from '../../lib/collections/MediaWorkFlowSteps'
import { MediaWorkFlow } from '../../lib/collections/MediaWorkFlows'
import {
	AdLibPieces,
	Blueprints,
	Buckets,
	Evaluations,
	ExpectedMediaItems,
	ExpectedPlayoutItems,
	ExternalMessageQueue,
	IngestDataCache,
	MediaObjects,
	MediaWorkFlows,
	MediaWorkFlowSteps,
	RundownPlaylists,
	Rundowns,
} from '../serverCollections'
import { Segments } from '../../lib/collections/Segments'
import { Parts } from '../../lib/collections/Parts'
import { PartInstances } from '../../lib/collections/PartInstances'
import { Pieces } from '../../lib/collections/Pieces'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { Timeline } from '../../lib/collections/Timeline'
import { SystemWriteAccess } from './system'
import { StudioContentWriteAccess } from './studio'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'
import { resolveCredentials } from './lib/credentials'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { TimelineDatastore } from '../../lib/collections/TimelineDatastore'

// Set up direct collection write access

// Owned by System:
CoreSystem.allow({
	insert(): boolean {
		return false
	},
	async update(userId, doc, fields, _modifier) {
		const cred = await resolveCredentials({ userId: userId })
		const access = await allowAccessToCoreSystem(cred)
		if (!access.update) return logNotAllowed('CoreSystem', access.reason)
		return allowOnlyFields(doc, fields, ['support', 'systemInfo', 'name', 'logLevel', 'apm', 'cron'])
	},
	remove() {
		return false
	},
})
Users.allow({
	insert(_userId, _doc) {
		return false
	},
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
	remove(_userId, _doc) {
		return false
	},
})

// Owned by Organization:
Organizations.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	async update(userId, doc, fields, _modifier) {
		const access = await allowAccessToOrganization({ userId: userId }, doc._id)
		if (!access.update) return logNotAllowed('Organization', access.reason)
		return allowOnlyFields(doc, fields, ['userRoles'])
	},
	remove(_userId, _doc) {
		return false
	},
})

UserActionsLog.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})
Evaluations.allow({
	insert(_userId, _doc): boolean {
		return true
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})
Snapshots.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	update(_userId, doc, fields, _modifier) {
		return allowOnlyFields(doc, fields, ['comment'])
	},
	remove(_userId, _doc) {
		return false
	},
})
Blueprints.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	update(_userId, doc, fields, _modifier) {
		return allowOnlyFields(doc, fields, ['name', 'disableVersionChecks'])
	},
	remove(_userId, _doc) {
		return false
	},
})
// Owned by Studio:
RundownPlaylists.allow({
	insert(_userId, _doc: DBRundownPlaylist): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})
Studios.allow({
	async insert(userId, doc: Studio) {
		const access = await allowAccessToStudio({ userId: userId }, doc._id)
		if (!access.insert) return logNotAllowed('Studio', access.reason)
		return true
	},
	async update(userId, doc, fields, _modifier) {
		const access = await allowAccessToStudio({ userId: userId }, doc._id)
		if (!access.update) return logNotAllowed('Studio', access.reason)
		return rejectFields(doc, fields, ['_id'])
	},
	async remove(userId, doc) {
		const access = await allowAccessToStudio({ userId: userId }, doc._id)
		if (!access.remove) return logNotAllowed('Studio', access.reason)
		return true
	},
})

ExternalMessageQueue.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})

MediaObjects.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})
Timeline.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})
TimelineDatastore.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})
Buckets.allow({
	insert(_userId, _doc): boolean {
		return false
	},
	async update(userId, doc, fields, _modifier) {
		return (await StudioContentWriteAccess.bucket({ userId }, doc.studioId)) && rejectFields(doc, fields, ['_id'])
	},
	remove(_userId, _doc) {
		return false
	},
})

// Owned by showStyle:
ShowStyleBases.allow({
	insert(): boolean {
		return false
	},
	async update(userId, doc, fields) {
		const access = await allowAccessToShowStyleBase({ userId: userId }, doc._id)
		if (!access.update) return logNotAllowed('ShowStyleBase', access.reason)
		return rejectFields(doc, fields, ['_id'])
	},
	remove() {
		return false
	},
})
ShowStyleVariants.allow({
	insert(): boolean {
		return false
	},
	async update(userId, doc, fields) {
		const access = await allowAccessToShowStyleBase({ userId: userId }, doc.showStyleBaseId)
		if (!access.update) return logNotAllowed('ShowStyleBase', access.reason)

		return rejectFields(doc, fields, ['showStyleBaseId'])
	},
	remove() {
		return false
	},
})
RundownLayouts.allow({
	insert(): boolean {
		return false
	},
	async update(userId, doc, fields) {
		const access = await allowAccessToShowStyleBase({ userId: userId }, doc.showStyleBaseId)
		if (!access.update) return logNotAllowed('ShowStyleBase', access.reason)
		return rejectFields(doc, fields, ['_id', 'showStyleBaseId'])
	},
	remove() {
		return false
	},
})
TriggeredActions.allow({
	insert(): boolean {
		return false
	},
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
	remove() {
		return false
	},
})

// Owned by PeripheralDevice
PeripheralDevices.allow({
	insert(_userId, _doc: PeripheralDevice): boolean {
		return true
	},
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

	remove(_userId, _doc) {
		return false
	},
})

PeripheralDeviceCommands.allow({
	insert(_userId, _doc: PeripheralDeviceCommand): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})

// Media work flows:
MediaWorkFlowSteps.allow({
	insert(_userId, _doc: MediaWorkFlowStep): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})
MediaWorkFlows.allow({
	insert(_userId, _doc: MediaWorkFlow): boolean {
		return false
	},
	update(_userId, _doc, _fields, _modifier) {
		return false
	},
	remove(_userId, _doc) {
		return false
	},
})

// Owned By Rundown:
Rundowns.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})

// ----------------------------------------------------------------------------
// Rundown content:
// ----------------------------------------------------------------------------

// Collections security set up:

Segments.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})

Parts.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})
PartInstances.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})
Pieces.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})
PieceInstances.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})
AdLibPieces.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})
RundownBaselineAdLibPieces.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})
IngestDataCache.allow({
	insert(): boolean {
		return false
	},
	update() {
		return false
	},
	remove() {
		return false
	},
})

ExpectedMediaItems.allow({
	insert(): boolean {
		return false
	},

	update() {
		return false
	},

	remove() {
		return false
	},
})

ExpectedPlayoutItems.allow({
	insert(): boolean {
		return false
	},

	update() {
		return false
	},

	remove() {
		return false
	},
})
