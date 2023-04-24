import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { meteorPublish, AutoFillSelector } from './lib'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevice, PeripheralDeviceCategory } from '../../lib/collections/PeripheralDevices'
import { OrganizationReadAccess } from '../security/organization'
import { StudioReadAccess } from '../security/studio'
import { MongoQuery } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { FindOptions } from '../../lib/collections/lib'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	MediaWorkFlows,
	MediaWorkFlowSteps,
	PeripheralDeviceCommands,
	PeripheralDevices,
	Studios,
} from '../collections'
import { TriggerUpdate, meteorCustomPublish, setUpOptimizedObserverArray } from '../lib/customPublication'
import { PeripheralDeviceForDevice } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import { ReadonlyDeep } from 'type-fest'
import { ReactiveMongoObserverGroup } from './lib/observerGroup'
import { Complete, assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { Studio, StudioIngestDevice, StudioPlayoutDevice } from '../../lib/collections/Studios'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

/*
 * This file contains publications for the peripheralDevices, such as playout-gateway, mos-gateway and package-manager
 */

async function checkAccess(cred: Credentials | ResolvedCredentials | null, selector: MongoQuery<PeripheralDevice>) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	return (
		!cred ||
		NoSecurityReadAccess.any() ||
		(selector._id && (await PeripheralDeviceReadAccess.peripheralDevice(selector._id, cred))) ||
		(selector.organizationId &&
			(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
		(selector.studioId && (await StudioReadAccess.studioContent(selector.studioId, cred)))
	)
}
meteorPublish(PubSub.peripheralDevices, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.organizationId<PeripheralDevice>(this.userId, selector0, token)
	if (await checkAccess(cred, selector)) {
		const modifier: FindOptions<PeripheralDevice> = {
			fields: {
				token: 0,
				secretSettings: 0,
			},
		}
		if (selector._id && token && modifier.fields) {
			// in this case, send the secretSettings:
			delete modifier.fields.secretSettings
		}
		return PeripheralDevices.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.peripheralDevicesAndSubDevices, async function (selector0) {
	const { cred, selector } = await AutoFillSelector.organizationId<PeripheralDevice>(
		this.userId,
		selector0,
		undefined
	)
	if (await checkAccess(cred, selector)) {
		const parents = PeripheralDevices.find(selector).fetch()

		const modifier: FindOptions<PeripheralDevice> = {
			fields: {
				token: 0,
				secretSettings: 0,
			},
		}

		return PeripheralDevices.find(
			{
				$or: [
					{
						parentDeviceId: { $in: parents.map((i) => i._id) },
					},
					selector,
				],
			},
			modifier
		)
	}
	return null
})
meteorPublish(PubSub.peripheralDeviceCommands, async function (deviceId: PeripheralDeviceId, token) {
	if (!deviceId) throw new Meteor.Error(400, 'deviceId argument missing')
	check(deviceId, String)
	if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
		return PeripheralDeviceCommands.find({ deviceId: deviceId })
	}
	return null
})
meteorPublish(PubSub.mediaWorkFlows, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.deviceId(this.userId, selector0, token)
	if (!cred || (await PeripheralDeviceReadAccess.peripheralDeviceContent(selector.deviceId, cred))) {
		return MediaWorkFlows.find(selector)
	}
	return null
})
meteorPublish(PubSub.mediaWorkFlowSteps, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.deviceId(this.userId, selector0, token)
	if (!cred || (await PeripheralDeviceReadAccess.peripheralDeviceContent(selector.deviceId, cred))) {
		return MediaWorkFlowSteps.find(selector)
	}
	return null
})

interface PeripheralDeviceForDeviceArgs {
	readonly deviceId: PeripheralDeviceId
}

// Future: should some be cached
type PeripheralDeviceForDeviceState = Record<string, never>

interface PeripheralDeviceForDeviceUpdateProps {
	invalidatePublication: boolean
}

type StudioFields = '_id' | 'peripheralDeviceSettings'
const studioFieldsSpecifier = literal<IncludeAllMongoFieldSpecifier<StudioFields>>({
	_id: 1,
	peripheralDeviceSettings: 1,
})

type PeripheralDeviceFields = '_id' | 'category' | 'studioId' | 'settings'
const peripheralDeviceFieldsSpecifier = literal<IncludeAllMongoFieldSpecifier<PeripheralDeviceFields>>({
	_id: 1,
	category: 1,
	studioId: 1,
	settings: 1,
})

export function convertPeripheralDeviceForGateway(
	peripheralDevice: Pick<PeripheralDevice, PeripheralDeviceFields>,
	studio: Pick<Studio, StudioFields> | undefined
): PeripheralDeviceForDevice {
	const playoutDevices: PeripheralDeviceForDevice['playoutDevices'] = {}
	const ingestSubDevices: PeripheralDeviceForDevice['ingestSubDevices'] = {}

	if (studio) {
		switch (peripheralDevice.category) {
			case PeripheralDeviceCategory.INGEST: {
				const resolvedDevices = applyAndValidateOverrides(studio.peripheralDeviceSettings.ingestSubDevices).obj

				for (const [id, device] of Object.entries<StudioIngestDevice>(resolvedDevices)) {
					if (device.peripheralDeviceId === peripheralDevice._id) {
						ingestSubDevices[id] = device.options // TODO - is this correct?
					}
				}

				break
			}
			case PeripheralDeviceCategory.PLAYOUT: {
				const resolvedDevices = applyAndValidateOverrides(studio.peripheralDeviceSettings.playoutDevices).obj

				for (const [id, device] of Object.entries<StudioPlayoutDevice>(resolvedDevices)) {
					if (device.peripheralDeviceId === peripheralDevice._id) {
						playoutDevices[id] = device.options // TODO - is this correct?
					}
				}

				break
			}
			case PeripheralDeviceCategory.MEDIA_MANAGER:
			case PeripheralDeviceCategory.PACKAGE_MANAGER:
			case PeripheralDeviceCategory.TRIGGER_INPUT:
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

		playoutDevices,
		ingestSubDevices,
	})
}

async function setupPeripheralDevicePublicationObservers(
	args: ReadonlyDeep<PeripheralDeviceForDeviceArgs>,
	triggerUpdate: TriggerUpdate<PeripheralDeviceForDeviceUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const studioObserver = await ReactiveMongoObserverGroup(async () => {
		const peripheralDeviceCompact = PeripheralDevices.findOneAsync(args.deviceId, { fields: { studioId: 1 } }) as
			| Pick<PeripheralDevice, 'studioId'>
			| undefined

		if (peripheralDeviceCompact?.studioId) {
			return [
				Studios.find(peripheralDeviceCompact.studioId, {
					fields: studioFieldsSpecifier,
				}).observeChanges({
					added: () => triggerUpdate({ invalidatePublication: true }),
					changed: () => triggerUpdate({ invalidatePublication: true }),
					removed: () => triggerUpdate({ invalidatePublication: true }),
				}),
			]
		} else {
			// Nothing to observe
			return []
		}
	})

	// Set up observers:
	return [
		PeripheralDevices.find(args.deviceId, {
			fields: peripheralDeviceFieldsSpecifier,
		}).observeChanges({
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
		}),
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
			| Pick<Studio, StudioFields>
			| undefined)

	return [convertPeripheralDeviceForGateway(peripheralDevice, studio)]
}

meteorCustomPublish(
	PubSub.peripheralDeviceForDevice,
	CustomCollectionName.PeripheralDeviceForDevice,
	async function (pub, deviceId: PeripheralDeviceId, token) {
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = PeripheralDevices.findOne(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			await setUpOptimizedObserverArray<
				PeripheralDeviceForDevice,
				PeripheralDeviceForDeviceArgs,
				PeripheralDeviceForDeviceState,
				PeripheralDeviceForDeviceUpdateProps
			>(
				`${CustomCollectionName.PeripheralDeviceForDevice}_${deviceId}`,
				{ deviceId },
				setupPeripheralDevicePublicationObservers,
				manipulatePeripheralDevicePublicationData,
				pub
			)
		}
	}
)
