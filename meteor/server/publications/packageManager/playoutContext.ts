import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { PackageManagerPlayoutContext } from '@sofie-automation/shared-lib/dist/package-manager/publications'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { PubSub, CustomCollectionName } from '../../../lib/api/pubsub'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PeripheralDevices, RundownPlaylists, Rundowns } from '../../collections'
import { meteorCustomPublish, setUpOptimizedObserverArray, TriggerUpdate } from '../../lib/customPublication'
import { logger } from '../../logging'
import { PeripheralDeviceReadAccess } from '../../security/peripheralDevice'

type RundownPlaylistFields = '_id' | 'activationId' | 'rehearsal' | 'rundownIdsInOrder'
const rundownPlaylistFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownPlaylistFields>>({
	// It should be enough to watch these fields for changes
	_id: 1,
	activationId: 1,
	rehearsal: 1,
	rundownIdsInOrder: 1,
})

interface PackageManagerPlayoutContextArgs {
	readonly studioId: StudioId
	readonly deviceId: PeripheralDeviceId
}

type PackageManagerPlayoutContextUpdateProps = Record<string, never>

type PackageManagerPlayoutContextState = Record<string, never>

async function setupExpectedPackagesPublicationObservers(
	args: ReadonlyDeep<PackageManagerPlayoutContextArgs>,
	triggerUpdate: TriggerUpdate<PackageManagerPlayoutContextUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		RundownPlaylists.observeChanges(
			{
				studioId: args.studioId,
			},
			{
				added: () => triggerUpdate({}),
				changed: () => triggerUpdate({}),
				removed: () => triggerUpdate({}),
			},
			{
				fields: rundownPlaylistFieldSpecifier,
			}
		),
	]
}

async function manipulateExpectedPackagesPublicationData(
	args: ReadonlyDeep<PackageManagerPlayoutContextArgs>,
	_state: Partial<PackageManagerPlayoutContextState>,
	_updateProps: Partial<PackageManagerPlayoutContextUpdateProps> | undefined
): Promise<PackageManagerPlayoutContext[] | null> {
	// Prepare data for publication:

	// Future: this may want to cache on the state, but with only a single observer there feels little point

	const activePlaylist = (await RundownPlaylists.findOneAsync(
		{
			studioId: args.studioId,
			activationId: { $exists: true },
		},
		{ fields: rundownPlaylistFieldSpecifier }
	)) as Pick<RundownPlaylist, RundownPlaylistFields> | undefined

	const activeRundowns = activePlaylist
		? await Rundowns.findFetchAsync({
				playlistId: activePlaylist._id,
		  })
		: []

	return literal<PackageManagerPlayoutContext[]>([
		{
			_id: args.deviceId,
			activePlaylist: activePlaylist
				? {
						_id: activePlaylist._id,
						active: !!activePlaylist.activationId,
						rehearsal: !!activePlaylist.rehearsal,
				  }
				: null,
			activeRundowns: activeRundowns.map((rundown) => {
				return {
					_id: rundown._id,
					_rank: activePlaylist?.rundownIdsInOrder?.indexOf(rundown._id) ?? 0,
				}
			}),
		},
	])
}

meteorCustomPublish(
	PubSub.packageManagerPlayoutContext,
	CustomCollectionName.PackageManagerPlayoutContext,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) {
				logger.warn(`Pub.packageManagerPlayoutContext: device "${peripheralDevice._id}" has no studioId`)
				return this.ready()
			}

			await setUpOptimizedObserverArray<
				PackageManagerPlayoutContext,
				PackageManagerPlayoutContextArgs,
				PackageManagerPlayoutContextState,
				PackageManagerPlayoutContextUpdateProps
			>(
				`${PubSub.packageManagerPlayoutContext}_${studioId}_${deviceId}`,
				{ studioId, deviceId },
				setupExpectedPackagesPublicationObservers,
				manipulateExpectedPackagesPublicationData,
				pub,
				500 // ms, wait this time before sending an update
			)
		} else {
			logger.warn(`Pub.packageManagerPlayoutContext: Not allowed: "${deviceId}"`)
		}
	}
)
