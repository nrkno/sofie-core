import { Meteor } from 'meteor/meteor'
import { DBRundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { DBShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { DBPartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { DBRundown, Rundowns } from '../../lib/collections/Rundowns'
import { observerChain } from '../lib/observerChain'
import { MongoCursor } from '../../lib/collections/lib'
import {
	CustomPublish,
	meteorCustomPublish,
	setUpOptimizedObserverArray,
	TriggerUpdate,
} from '../lib/customPublication'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceId, StudioId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { MountedDeviceTrigger, MountedTrigger } from '../../lib/api/triggers/MountedTriggers'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../logging'
import { DBTriggeredActions, TriggeredActions, UITriggeredActionsObj } from '../../lib/collections/TriggeredActions'
import { Complete, literal } from '../../lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { isDeviceTrigger } from '../../lib/api/triggers/triggerTypeSelectors'

const MOUNTED_TRIGGERS_DEBOUNCE = 250

meteorCustomPublish(
	PubSub.mountedTriggersForDevice,
	CustomCollectionName.MountedTriggers,
	async function (pub, deviceId: PeripheralDeviceId, deviceIds: string[], token) {
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = PeripheralDevices.findOne(deviceId)

			if (!peripheralDevice) throw new Meteor.Error(`PeripheralDevice "${deviceId}" not found`)

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			await createObserverForMountedTriggersPublication(pub, PubSub.mountedTriggersForDevice, studioId, deviceIds)
		} else {
			logger.warn(`Pub.expectedPackagesForDevice: Not allowed: "${deviceId}"`)
		}
	}
)

interface MountedTriggersState {
	context: MountedTriggersContext | null
	triggeredActions: DBTriggeredActions[]
}

async function createObserverForMountedTriggersPublication(
	pub: CustomPublish<MountedDeviceTrigger>,
	observerId: PubSub,
	studioId: StudioId,
	deviceIds: string[]
) {
	return setUpOptimizedObserverArray<
		MountedDeviceTrigger,
		MountedTriggersArgs,
		MountedTriggersState,
		MountedTriggersUpdateProps
	>(
		`pub_${observerId}_${studioId}`,
		{ studioId, deviceIds },
		setupMountedTriggersPublicationObservers,
		manipulateMountedTriggersPublicationData,
		pub,
		0 // ms
	)
}

interface MountedTriggersArgs {
	studioId: StudioId
	deviceIds: string[]
}

interface MountedTriggersContext {
	activePlaylist: Pick<DBRundownPlaylist, '_id' | 'nextPartInstanceId' | 'currentPartInstanceId'>
	activePartInstance: Pick<DBPartInstance, '_id' | 'rundownId'>
	currentRundown: Pick<DBRundown, '_id' | 'showStyleBaseId'>
	showStyleBase: Pick<
		DBShowStyleBase,
		'_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
	>
}

interface MountedTriggersUpdateProps {
	context: MountedTriggersContext | null
	triggeredActions: DBTriggeredActions[]
}

async function setupMountedTriggersPublicationObservers(
	args: ReadonlyDeep<MountedTriggersArgs>,
	triggerUpdate: TriggerUpdate<MountedTriggersUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	let lastTriggeredActionsObserver: Meteor.LiveQueryHandle | null = null
	const localTriggeredActions: Map<TriggeredActionId, DBTriggeredActions> = new Map()
	let triggerUpdateDebounceTimeout: number | null = null

	function debouncedTriggerUpdate() {
		if (triggerUpdateDebounceTimeout) Meteor.clearTimeout(triggerUpdateDebounceTimeout)
		triggerUpdateDebounceTimeout = Meteor.setTimeout(() => {
			triggerUpdateDebounceTimeout = null
			triggerUpdate({
				triggeredActions: Array.from(localTriggeredActions.values()),
			})
		}, MOUNTED_TRIGGERS_DEBOUNCE)
	}

	function receiveTriggeredActions(op: 'added' | 'changed' | 'removed', obj: DBTriggeredActions) {
		switch (op) {
			case 'changed':
			case 'added': {
				localTriggeredActions.set(obj._id, obj)
				break
			}
			case 'removed': {
				localTriggeredActions.delete(obj._id)
				break
			}
		}

		debouncedTriggerUpdate()
	}

	const setupTriggeredActionsObserver = (context: MountedTriggersContext | null) => {
		if (context === null) {
			triggerUpdate({ context: null, triggeredActions: [] })
			return
		}

		if (lastTriggeredActionsObserver) {
			lastTriggeredActionsObserver.stop()
			lastTriggeredActionsObserver = null
		}

		localTriggeredActions.clear()
		lastTriggeredActionsObserver = TriggeredActions.find({
			$or: [
				{
					showStyleBaseId: null,
				},
				{
					showStyleBaseId: context.showStyleBase._id,
				},
			],
		}).observe({
			added: (doc) => receiveTriggeredActions('added', doc),
			changed: (doc) => receiveTriggeredActions('changed', doc),
			removed: (oldDoc) => receiveTriggeredActions('removed', oldDoc),
		})

		triggerUpdate({
			context,
		})
	}

	const contextChainLiveQuery = observerChain()
		.next(
			'activePlaylist',
			() =>
				RundownPlaylists.find(
					{
						studioId: args.studioId,
						activationId: { $exists: true },
					},
					{
						fields: {
							nextPartInstanceId: 1,
							currentPartInstanceId: 1,
						},
					}
				) as MongoCursor<Pick<DBRundownPlaylist, '_id' | 'nextPartInstanceId' | 'currentPartInstanceId'>>
		)
		.next('activePartInstance', (chain) => {
			const activePartInstanceId =
				chain.activePlaylist.currentPartInstanceId ?? chain.activePlaylist.nextPartInstanceId
			if (!activePartInstanceId) return null
			return PartInstances.find(
				{ _id: activePartInstanceId },
				{ fields: { rundownId: 1 }, limit: 1 }
			) as MongoCursor<Pick<DBPartInstance, '_id' | 'rundownId'>>
		})
		.next('currentRundown', (chain) =>
			chain.activePartInstance
				? (Rundowns.find(
						{ _id: chain.activePartInstance.rundownId },
						{ fields: { showStyleBaseId: 1 }, limit: 1 }
				  ) as MongoCursor<Pick<DBRundown, '_id' | 'showStyleBaseId'>>)
				: null
		)
		.next('showStyleBase', (chain) =>
			chain.currentRundown
				? (ShowStyleBases.find(
						{ _id: chain.currentRundown.showStyleBaseId },
						{
							fields: { sourceLayersWithOverrides: 1, outputLayersWithOverrides: 1, hotkeyLegend: 1 },
							limit: 1,
						}
				  ) as MongoCursor<
						Pick<
							DBShowStyleBase,
							'_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
						>
				  >)
				: null
		)
		.end((state) => {
			setupTriggeredActionsObserver(state)
		})

	return [
		contextChainLiveQuery,
		{
			stop: () => {
				if (triggerUpdateDebounceTimeout) Meteor.clearTimeout(triggerUpdateDebounceTimeout)
				lastTriggeredActionsObserver?.stop()
			},
		},
	]
}

async function manipulateMountedTriggersPublicationData(
	args: ReadonlyDeep<MountedTriggersArgs>,
	_state: Partial<MountedTriggersState>,
	newProps: ReadonlyDeep<Partial<MountedTriggersUpdateProps> | undefined>
): Promise<MountedDeviceTrigger[]> {
	if (!newProps?.triggeredActions) {
		return []
	}

	const allTriggeredActions = newProps.triggeredActions.map((pair) => convertDocument(pair))
	const triggeredActions = allTriggeredActions.filter((pair) =>
		Object.values(pair.triggers).find(
			(trigger) => isDeviceTrigger(trigger) && args.deviceIds.includes(trigger.deviceId)
		)
	)

	console.log(triggeredActions)

	return []
}

function convertDocument(doc: ReadonlyObjectDeep<DBTriggeredActions>): UITriggeredActionsObj {
	return literal<Complete<UITriggeredActionsObj>>({
		_id: doc._id,
		_rank: doc._rank,

		showStyleBaseId: doc.showStyleBaseId,
		name: doc.name,

		actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
		triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,
	})
}
