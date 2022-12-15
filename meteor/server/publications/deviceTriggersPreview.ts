import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { DeviceTriggerArguments } from '../../lib/api/triggers/MountedTriggers'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { getCurrentTime } from '../../lib/lib'
import { setUpOptimizedObserverArray, TriggerUpdate } from '../lib/customPublication'
import { CustomPublish, meteorCustomPublish } from '../lib/customPublication/publish'
import { StudioReadAccess } from '../security/studio'

type DeviceTriggerPreviewId = ProtectedString<'deviceTriggerPreviewId'>

const lastTriggers: Record<string, { triggers: UIDeviceTriggerPreview[]; updated?: (() => void) | undefined }> = {}

export interface UIDeviceTriggerPreview {
	_id: DeviceTriggerPreviewId
	peripheralDeviceId: PeripheralDeviceId
	triggerDeviceId: string
	triggerId: string
	timestamp: number
	values?: DeviceTriggerArguments
}

meteorCustomPublish(
	PubSub.deviceTriggersPreview,
	CustomCollectionName.UIDeviceTriggerPreviews,
	async function (pub, studioId: StudioId, token) {
		check(studioId, String)

		if (!studioId) throw new Meteor.Error(400, 'One of studioId must be provided')

		// If values were provided, they must have values

		if (await StudioReadAccess.studioContent(studioId, { userId: this.userId, token })) {
			await createObserverForDeviceTriggersPreviewsPublication(pub, PubSub.mountedTriggersForDevice, studioId)
		}
		return
	}
)

export async function insertInputDeviceTriggerToPreview(
	deviceId: PeripheralDeviceId,
	triggerDeviceId: string,
	triggerId: string,
	values?: DeviceTriggerArguments
) {
	if (typeof deviceId !== 'string') return
	const pDevice = await PeripheralDevices.findOneAsync(deviceId)

	if (!pDevice) throw new Meteor.Error(404, `Could not find peripheralDevice "${deviceId}"`)

	const studioId = unprotectString(pDevice.studioId)
	if (!studioId) throw new Meteor.Error(501, `Device "${pDevice._id}" is not assigned to any studio`)

	const lastTriggersStudio = prepareBufferForStudio(studioId)
	lastTriggersStudio.triggers.push({
		_id: getRandomId(),
		peripheralDeviceId: deviceId,
		triggerDeviceId,
		triggerId,
		timestamp: getCurrentTime(),
		values,
	})
	while (lastTriggersStudio.triggers.length > 5) {
		lastTriggersStudio.triggers.shift()
	}
	lastTriggersStudio.updated?.()
}

function prepareBufferForStudio(studioId: string) {
	if (lastTriggers[studioId] === undefined) {
		lastTriggers[studioId] = {
			triggers: [],
			updated: () => {
				// temporary noop
			},
		}
	}

	return lastTriggers[studioId]
}

async function setupDeviceTriggersPreviewsObservers(
	args: ReadonlyDeep<DeviceTriggersPreviewArgs>,
	triggerUpdate: TriggerUpdate<DeviceTriggersUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const studioId = unprotectString(args.studioId)
	const lastTriggersStudio = prepareBufferForStudio(studioId)

	lastTriggersStudio.updated = () => {
		triggerUpdate(lastTriggersStudio)
	}

	// console.log(lastTriggersStudio.triggers)
	triggerUpdate(lastTriggersStudio)

	return [
		{
			stop: () => {
				lastTriggersStudio.updated = undefined
			},
		},
	]
}

async function createObserverForDeviceTriggersPreviewsPublication(
	pub: CustomPublish<UIDeviceTriggerPreview>,
	observerId: PubSub,
	studioId: StudioId
) {
	// console.log(JSON.stringify(lastTriggers))

	return setUpOptimizedObserverArray<
		UIDeviceTriggerPreview,
		DeviceTriggersPreviewArgs,
		DeviceTriggersUpdateProps,
		{}
	>(
		`pub_${observerId}_${studioId}`,
		{ studioId },
		setupDeviceTriggersPreviewsObservers,
		manipulateMountedTriggersPublicationData,
		pub,
		0 // ms
	)
}

async function manipulateMountedTriggersPublicationData(
	_args: ReadonlyDeep<DeviceTriggersPreviewArgs>,
	_state: Partial<{}>,
	newProps: ReadonlyDeep<Partial<DeviceTriggersUpdateProps> | undefined>
): Promise<UIDeviceTriggerPreview[]> {
	const triggers: UIDeviceTriggerPreview[] = Array.from(newProps?.triggers ?? [])
	return triggers
}

interface DeviceTriggersPreviewArgs {
	studioId: StudioId
}

interface DeviceTriggersUpdateProps {
	triggers: readonly UIDeviceTriggerPreview[]
}