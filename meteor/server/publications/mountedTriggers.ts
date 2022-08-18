import { Meteor } from 'meteor/meteor'
import { DBRundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { DBShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { DBPartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { DBRundown, Rundowns } from '../../lib/collections/Rundowns'
import { observerChain } from '../lib/observerChain'
import { MongoCursor } from '../../lib/collections/lib'
import { CustomPublishArray, meteorCustomPublishArray } from '../lib/customPublication'
import { PubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { MountedTrigger } from '../../lib/api/triggers/MountedTriggers'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { ReadonlyDeep } from 'type-fest'

meteorCustomPublishArray(
	PubSub.mountedTriggersForDevice,
	'mountedTriggers',
	async function (pub, deviceId: PeripheralDeviceId, token) {
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = PeripheralDevices.findOne(deviceId)

			if (!peripheralDevice) throw new Meteor.Error(`PeripheralDevice "${deviceId}" not found`)

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			await createObserverForMountedTriggersPublication(pub, PubSub.mountedTriggersForDevice, studioId)
		}
	}
)

async function createObserverForMountedTriggersPublication(
	pub: CustomPublishArray<MountedTrigger>,
	observerId: PubSub,
	studioId: StudioId
) {
	const observer = await setUpOptimizedObserver<
		MountedTrigger,
		MountedTriggersArgs,
		MountedTriggersState,
		MountedTriggersUpdateProps
	>(
		`pub_${observerId}_${studioId}`,
		{ studioId },
		setupMountedTriggersPublicationObservers,
		manipulateMountedTriggersPublicationData,
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

interface MountedTriggersArgs {
	studioId: StudioId
}

interface MountedTriggersUpdateProps {
	context: {
		activePlaylist: Pick<DBRundownPlaylist, '_id' | 'nextPartInstanceId' | 'currentPartInstanceId'>
		activePartInstance: Pick<DBPartInstance, '_id' | 'rundownId'>
		currentRundown: Pick<DBRundown, '_id' | 'showStyleBaseId'>
		showStyleBase: Pick<DBShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers' | 'hotkeyLegend'>
	} | null
}

async function setupMountedTriggersPublicationObservers(
	args: ReadonlyDeep<MountedTriggersArgs>,
	triggerUpdate: TriggerUpdate<MountedTriggersUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	return [
		observerChain()
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
							{ fields: { sourceLayers: 1, outputLayers: 1, hotkeyLegend: 1 }, limit: 1 }
					  ) as MongoCursor<Pick<DBShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers' | 'hotkeyLegend'>>)
					: null
			)
			.end((state) => {
				if (state === null) {
					// this actualy needs to trigger an update of the TriggeredActions query
					triggerUpdate({
						context: null,
					})
					return
				}

				triggerUpdate({
					context: {
						activePlaylist: state?.activePlaylist,
						activePartInstance: state?.activePartInstance,
						currentRundown: state?.currentRundown,
						showStyleBase: state?.showStyleBase,
					},
				})
			}),
	]
}
