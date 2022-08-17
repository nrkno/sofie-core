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
import { PartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { MountedTrigger } from '../../lib/api/triggers/MountedTriggers'
import { ReadonlyDeep } from 'type-fest'
import { Rundowns } from '../../lib/collections/Rundowns'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'

meteorCustomPublish(
	PubSub.mountedTriggersForDevice,
	'mountedTriggers',
	async function (pub, deviceId: PeripheralDeviceId, token) {
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = PeripheralDevices.findOne(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			await createObserverForMountedTriggersPublication(pub, PubSub.mountedTriggersForDevice, studioId)
		}
	}
)

interface MountedTriggerArgs {
	studioId: StudioId
}

interface MountedTriggersState {
	showStyleBase: ShowStyleBase
}

interface MountedTriggersUpdateProps {
	partInstance: PartInstance | null
}

async function createObserverForMountedTriggersPublication(
	pub: CustomPublishArray<MountedTrigger>,
	observerId: PubSub,
	studioId: StudioId
) {
	const observer = await setUpOptimizedObserver<
		MountedTrigger,
		MountedTriggerArgs,
		MountedTriggersState,
		MountedTriggersUpdateProps
	>(
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
	triggerUpdate: TriggerUpdate<MountedTriggersUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	let lastActiveRundownPlaylistId: RundownPlaylistId | null = null
	let lastPartInstanceObserver: Meteor.LiveQueryHandle | null = null
	const setupObserver = (activeRundownPlaylist: RundownPlaylist | null) => {
		if (lastActiveRundownPlaylistId === activeRundownPlaylist?._id) {
			triggerUpdate({ partInstance: null })
			return
		}
		lastActiveRundownPlaylistId = activeRundownPlaylist?._id ?? null

		if (lastPartInstanceObserver) lastPartInstanceObserver.stop()

		const activePartInstanceId =
			activeRundownPlaylist?.currentPartInstanceId ?? activeRundownPlaylist?.nextPartInstanceId
		if (!activePartInstanceId) {
			triggerUpdate({ partInstance: null })
			return
		}

		lastPartInstanceObserver = PartInstances.find({
			_id: activePartInstanceId,
		}).observe({
			// TODO: Observe the part instances and feed that into currentShowStyleBaseId
			added: (partInstance) => triggerUpdate({ partInstance }),
			changed: (partInstance) => triggerUpdate({ partInstance }),
			removed: () => triggerUpdate({ partInstance: null }),
		})
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
				lastPartInstanceObserver?.stop()
			},
		},
	]
}

async function manipulateActionTriggers(
	args: MountedTriggerArgs,
	env: Partial<MountedTriggersState>,
	props: ReadonlyDeep<Partial<MountedTriggersUpdateProps> | undefined>
): Promise<MountedTrigger[]> {
	if (!props || !props.partInstance) return []

	const currentRundown = Rundowns.findOne(props.partInstance.rundownId)
	if (!currentRundown) return []

	const showStyleBase = ShowStyleBases.findOne(currentRundown.showStyleBaseId)
	if (!showStyleBase) return []

	const triggeredActions = TriggeredActions.find({
		$or: [
			{showStyleBaseId: showStyleBase._id},
			{showStyleBaseId: null}
		]
	})
	triggeredActions.
}
