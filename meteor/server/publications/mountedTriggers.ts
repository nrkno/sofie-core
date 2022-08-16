import { PubSub } from '../../lib/api/pubsub'
import {
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CustomPublishArray, meteorCustomPublish } from '../lib/customPublication'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { Meteor } from 'meteor/meteor'
import { RundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Rundowns } from '../../lib/collections/Rundowns'
import { PartInstances } from '../../lib/collections/PartInstances'
import { MountedTrigger } from '../../lib/api/triggers/MountedTriggers'

meteorCustomPublish(
	PubSub.mountedTriggersForDevice,
	'mountedTriggers',
	async function (pub, deviceId: PeripheralDeviceId, token) {
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = PeripheralDevices.findOne(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			createObserverForMountedTriggersPublication(pub, PubSub.mountedTriggersForDevice, studioId)
		}
	}
)

interface MountedTriggerArgs {
	studioId: StudioId
}

interface MountedTriggersEnvironment {
	showStyleBase: ShowStyleBase
}

async function createObserverForMountedTriggersPublication(
	pub: CustomPublishArray<MountedTrigger>,
	observerId: PubSub,
	studioId: StudioId
) {
	const observer = await setUpOptimizedObserver<MountedTrigger, MountedTriggerArgs, MountedTriggersEnvironment, {}>(
		`pub_${observerId}_${studioId}`,
		{ studioId },
		setupActionTriggersObservers,
		manipulateActionTriggers,
		(_args, newData) => {
			// Don't need to perform any deep diffing
			pub.updatedDocs(newData)
		},
		0 // ms
	)
	pub.onStop(() => {
		observer.stop()
	})
}

async function setupActionTriggersObservers(
	args: { studioId: StudioId },
	triggerUpdate: TriggerUpdate<{}>
): Promise<Meteor.LiveQueryHandle[]> {
	let lastActiveRundownPlaylistId: RundownPlaylistId | null = null
	const lastActiveRundownId: RundownId | null = null
	const lastShowStyleBaseObserver: Meteor.LiveQueryHandle | null = null
	const setupObserver = (activeRundownPlaylist: RundownPlaylist | null) => {
		if (lastActiveRundownPlaylistId === activeRundownPlaylist?._id) {
			return
		}
		lastActiveRundownPlaylistId = activeRundownPlaylist?._id ?? null

		if (lastShowStyleBaseObserver) {
			lastShowStyleBaseObserver.stop()
		}

		const activePartInstanceId =
			activeRundownPlaylist?.currentPartInstanceId ?? activeRundownPlaylist?.nextPartInstanceId
		if (!activePartInstanceId) {
			// TODO: tear down existing observers.
			return
		}

		PartInstances.find({
			_id: activePartInstanceId,
		}).observe({
			// TODO: Observe the part instances and feed that into currentShowStyleBaseId
		})

		// lastShowStyleBaseObserver = ShowStyleBases.find({
		// 	_id: currentShowStyleBaseId,
		// }).observe({
		//     added: () => triggerUpdate({}),
		// 	changed: () => triggerUpdate({}),
		// 	removed: () => triggerUpdate({}),
		// })
	}
	return [
		RundownPlaylists.find({
			studioId: args.studioId,
			activationId: {
				$exists: true,
			},
		}).observe({
			added: (activeRundownPlaylist) => setupObserver(activeRundownPlaylist),
			changed: (activeRundownPlaylist) => setupObserver(activeRundownPlaylist),
			removed: () => setupObserver(null),
		}),
		{
			stop: () => {
				lastShowStyleBaseObserver?.stop()
			},
		},
	]
}

async function manipulateActionTriggers(): Promise<MountedTrigger[] | null> {
	return []
}
