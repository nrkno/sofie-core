import { Meteor } from 'meteor/meteor'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevice, PeripheralDeviceCategory } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices, Studios } from '../collections'
import { TriggerUpdate, meteorCustomPublish, setUpOptimizedObserverArray } from '../lib/customPublication'
import { PeripheralDeviceForDevice } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import { ReadonlyDeep } from 'type-fest'
import { ReactiveMongoObserverGroup } from './lib/observerGroup'
import { Complete, assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import {
	DBStudio,
	StudioIngestDevice,
	StudioInputDevice,
	StudioPlayoutDevice,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { check } from 'meteor/check'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

interface PeripheralDeviceForDeviceArgs {
	readonly deviceId: PeripheralDeviceId
}

// Future: should some be cached
type PeripheralDeviceForDeviceState = Record<string, never>

interface PeripheralDeviceForDeviceUpdateProps {
	invalidatePublication: boolean
}

type StudioFields = '_id' | 'peripheralDeviceSettings'
const studioFieldsSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	peripheralDeviceSettings: 1,
})

type PeripheralDeviceFields = '_id' | 'category' | 'studioId' | 'settings' | 'secretSettings'
const peripheralDeviceFieldsSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<PeripheralDevice, PeripheralDeviceFields>>
>({
	_id: 1,
	category: 1,
	studioId: 1,
	settings: 1,
	secretSettings: 1,
})

export function convertPeripheralDeviceForGateway(
	peripheralDevice: Pick<PeripheralDevice, PeripheralDeviceFields>,
	studio: Pick<DBStudio, StudioFields> | undefined
): PeripheralDeviceForDevice {
	const playoutDevices: PeripheralDeviceForDevice['playoutDevices'] = {}
	const ingestDevices: PeripheralDeviceForDevice['ingestDevices'] = {}
	const inputDevices: PeripheralDeviceForDevice['inputDevices'] = {}

	if (studio) {
		switch (peripheralDevice.category) {
			case PeripheralDeviceCategory.INGEST: {
				const resolvedDevices = applyAndValidateOverrides(studio.peripheralDeviceSettings.ingestDevices).obj

				for (const [id, device] of Object.entries<StudioIngestDevice>(resolvedDevices)) {
					if (device.peripheralDeviceId === peripheralDevice._id) {
						ingestDevices[id] = device.options
					}
				}

				break
			}
			case PeripheralDeviceCategory.PLAYOUT: {
				const resolvedDevices = applyAndValidateOverrides(studio.peripheralDeviceSettings.playoutDevices).obj

				for (const [id, device] of Object.entries<StudioPlayoutDevice>(resolvedDevices)) {
					if (device.peripheralDeviceId === peripheralDevice._id) {
						playoutDevices[id] = device.options
					}
				}

				break
			}
			case PeripheralDeviceCategory.TRIGGER_INPUT: {
				const resolvedDevices = applyAndValidateOverrides(studio.peripheralDeviceSettings.inputDevices).obj

				for (const [id, device] of Object.entries<StudioInputDevice>(resolvedDevices)) {
					if (device.peripheralDeviceId === peripheralDevice._id) {
						inputDevices[id] = device.options
					}
				}

				break
			}
			case PeripheralDeviceCategory.MEDIA_MANAGER:
			case PeripheralDeviceCategory.PACKAGE_MANAGER:
			case PeripheralDeviceCategory.LIVE_STATUS:
				// No subdevices to re-export
				break
			default:
				assertNever(peripheralDevice.category)
				break
		}
	}

	return literal<Complete<PeripheralDeviceForDevice>>({
		_id: peripheralDevice._id,
		studioId: peripheralDevice.studioId,

		deviceSettings: peripheralDevice.settings,
		secretSettings: peripheralDevice.secretSettings,

		playoutDevices,
		ingestDevices,
		inputDevices,
	})
}

async function setupPeripheralDevicePublicationObservers(
	args: ReadonlyDeep<PeripheralDeviceForDeviceArgs>,
	triggerUpdate: TriggerUpdate<PeripheralDeviceForDeviceUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const studioObserver = await ReactiveMongoObserverGroup(async () => {
		const peripheralDeviceCompact = (await PeripheralDevices.findOneAsync(args.deviceId, {
			fields: { studioId: 1 },
		})) as Pick<PeripheralDevice, 'studioId'> | undefined

		if (peripheralDeviceCompact?.studioId) {
			return [
				Studios.observeChanges(
					peripheralDeviceCompact.studioId,
					{
						added: () => triggerUpdate({ invalidatePublication: true }),
						changed: () => triggerUpdate({ invalidatePublication: true }),
						removed: () => triggerUpdate({ invalidatePublication: true }),
					},
					{
						fields: studioFieldsSpecifier,
					}
				),
			]
		} else {
			// Nothing to observe
			return []
		}
	})

	// Set up observers:
	return [
		PeripheralDevices.observeChanges(
			args.deviceId,
			{
				added: () => {
					studioObserver.restart()
					triggerUpdate({ invalidatePublication: true })
				},
				changed: (_id, fields) => {
					if ('studioId' in fields) studioObserver.restart()

					triggerUpdate({ invalidatePublication: true })
				},
				removed: () => {
					studioObserver.restart()
					triggerUpdate({ invalidatePublication: true })
				},
			},
			{
				fields: peripheralDeviceFieldsSpecifier,
			}
		),
		studioObserver,
	]
}

async function manipulatePeripheralDevicePublicationData(
	args: PeripheralDeviceForDeviceArgs,
	_state: Partial<PeripheralDeviceForDeviceState>,
	_updateProps: Partial<PeripheralDeviceForDeviceUpdateProps> | undefined
): Promise<PeripheralDeviceForDevice[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	const peripheralDevice = (await PeripheralDevices.findOneAsync(args.deviceId, {
		projection: peripheralDeviceFieldsSpecifier,
	})) as Pick<PeripheralDevice, PeripheralDeviceFields> | undefined
	if (!peripheralDevice) return []

	const studio =
		peripheralDevice.studioId &&
		((await Studios.findOneAsync(peripheralDevice.studioId, { projection: studioFieldsSpecifier })) as
			| Pick<DBStudio, StudioFields>
			| undefined)

	return [convertPeripheralDeviceForGateway(peripheralDevice, studio)]
}

meteorCustomPublish(
	PeripheralDevicePubSub.peripheralDeviceForDevice,
	PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			await setUpOptimizedObserverArray<
				PeripheralDeviceForDevice,
				PeripheralDeviceForDeviceArgs,
				PeripheralDeviceForDeviceState,
				PeripheralDeviceForDeviceUpdateProps
			>(
				`${PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice}_${deviceId}`,
				{ deviceId },
				setupPeripheralDevicePublicationObservers,
				manipulatePeripheralDevicePublicationData,
				pub
			)
		}
	}
)
