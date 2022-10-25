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
import { PeripheralDeviceId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { MountedTrigger } from '../../lib/api/triggers/MountedTriggers'
import { ReadonlyDeep } from 'type-fest'
import { logger } from '../logging'
import { DBTriggeredActions, TriggeredActions, UITriggeredActionsObj } from '../../lib/collections/TriggeredActions'
import { Complete, literal } from '../../lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { TriggerType } from '@sofie-automation/blueprints-integration'

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

type MountedTriggersState = {}

async function createObserverForMountedTriggersPublication(
	pub: CustomPublish<MountedTrigger>,
	observerId: PubSub,
	studioId: StudioId,
	deviceIds: string[]
) {
	return setUpOptimizedObserverArray<
		MountedTrigger,
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

interface MountedTriggersUpdateProps {
	context: {
		activePlaylist: Pick<DBRundownPlaylist, '_id' | 'nextPartInstanceId' | 'currentPartInstanceId'>
		activePartInstance: Pick<DBPartInstance, '_id' | 'rundownId'>
		currentRundown: Pick<DBRundown, '_id' | 'showStyleBaseId'>
		showStyleBase: Pick<
			DBShowStyleBase,
			'_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
		>
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

async function manipulateMountedTriggersPublicationData(
	args: ReadonlyDeep<MountedTriggersArgs>,
	_state: Partial<MountedTriggersState>,
	newProps: ReadonlyDeep<Partial<MountedTriggersUpdateProps> | undefined>
): Promise<MountedTrigger[]> {
	const triggeredActions = await getAllPossibleTriggeredActions(newProps?.context?.showStyleBase?._id, args.deviceIds)

	console.log(triggeredActions)

	return []
}

async function getAllPossibleTriggeredActions(
	showStyleBaseId: ShowStyleBaseId | undefined,
	deviceIds: readonly string[]
): Promise<UITriggeredActionsObj[]> {
	const possibleActionsAll = await Promise.all([
		convertAllDocumentsAsync(
			TriggeredActions.findFetchAsync({
				showStyleBaseId: null,
			})
		),
		showStyleBaseId
			? convertAllDocumentsAsync(
					TriggeredActions.findFetchAsync({
						showStyleBaseId,
					})
			  )
			: [],
	])

	const allActions = possibleActionsAll.flat()
	return allActions.filter((triggeredAction) =>
		Object.values(triggeredAction.triggers).find(
			(trigger) => trigger.type === TriggerType.device && deviceIds.includes(trigger.deviceId)
		)
	)
}

async function convertAllDocumentsAsync(docsPromise: Promise<DBTriggeredActions[]>): Promise<UITriggeredActionsObj[]> {
	return docsPromise.then((docs) => docs.map((doc) => convertDocument(doc)))
}

function convertDocument(doc: DBTriggeredActions): UITriggeredActionsObj {
	return literal<Complete<UITriggeredActionsObj>>({
		_id: doc._id,
		_rank: doc._rank,

		showStyleBaseId: doc.showStyleBaseId,
		name: doc.name,

		actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
		triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,
	})
}
