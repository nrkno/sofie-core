import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { MethodContext } from '../../../lib/api/methods'
import {
	DeviceTriggerArguments,
	DeviceTriggerMountedAction,
	PreviewWrappedAdLib,
} from '../../../lib/api/triggers/MountedTriggers'
import { logger } from '../../logging'
import { checkAccessAndGetPeripheralDevice } from '../ingest/lib'
import { StudioActionManagers } from './StudioActionManagers'
import { JobQueueWithClasses } from '@sofie-automation/shared-lib/dist/lib/JobQueueWithClasses'
import { StudioDeviceTriggerManager } from './StudioDeviceTriggerManager'
import { StudioObserver } from './StudioObserver'
import { Studios } from '../../collections'
import { ReactiveCacheCollection } from '../../publications/lib/ReactiveCacheCollection'

type ObserverAndManager = {
	observer: StudioObserver
	manager: StudioDeviceTriggerManager
}

Meteor.startup(() => {
	if (!Meteor.isServer) return
	const studioObserversAndManagers = new Map<StudioId, ObserverAndManager>()
	const jobQueue = new JobQueueWithClasses({
		autoStart: true,
		executionWrapper: Meteor.bindEnvironment,
		resolutionWrapper: Meteor.defer,
	})

	function workInQueue(fnc: () => Promise<void>) {
		jobQueue.add(fnc).catch((e) => {
			logger.error(`Error in DeviceTriggers Studio observer reaction: ${e}`)
			logger.error(e)
		})
	}

	function createObserverAndManager(studioId: StudioId) {
		logger.debug(`Creating observer for studio "${studioId}"`)
		const manager = new StudioDeviceTriggerManager(studioId)
		const observer = new StudioObserver(studioId, (showStyleBaseId, cache) => {
			workInQueue(async () => {
				manager.updateTriggers(cache, showStyleBaseId)
			})

			return () => {
				workInQueue(async () => {
					manager.clearTriggers()
				})
			}
		})

		studioObserversAndManagers.set(studioId, { manager, observer })
	}

	function destroyObserverAndManager(studioId: StudioId) {
		logger.debug(`Destroying observer for studio "${studioId}"`)
		const toRemove = studioObserversAndManagers.get(studioId)
		if (toRemove) {
			toRemove.observer.stop()
			toRemove.manager.stop()
			studioObserversAndManagers.delete(studioId)
		} else {
			logger.error(`Observer for studio "${studioId}" not found`)
		}
	}

	Studios.observeChanges(
		{},
		{
			added: (studioId) => {
				createObserverAndManager(studioId)
			},
			removed: (studioId) => {
				destroyObserverAndManager(studioId)
			},
		},
		{ projection: { _id: 1 } }
	)
})

// TODO: These actually don't have to be reactiveCacheCollections, they can be a plain Meteor in-memory collection
export const DeviceTriggerMountedActions = new ReactiveCacheCollection<DeviceTriggerMountedAction>(
	'deviceTriggerMountedActions'
)
export const DeviceTriggerMountedActionAdlibsPreview = new ReactiveCacheCollection<PreviewWrappedAdLib>(
	'deviceTriggerMountedActionAdlibsPreview'
)

export async function receiveInputDeviceTrigger(
	context: MethodContext,
	peripheralDeviceId: PeripheralDeviceId,
	deviceToken: string,
	deviceId: string,
	triggerId: string,
	values?: DeviceTriggerArguments
): Promise<void> {
	const peripheralDevice = await checkAccessAndGetPeripheralDevice(peripheralDeviceId, deviceToken, context)
	check(deviceId, String)
	check(triggerId, String)

	const studioId = peripheralDevice.studioId
	if (!studioId) throw new Meteor.Error(400, `Peripheral Device "${peripheralDevice._id}" not assigned to a studio`)

	logger.debug(
		`Received trigger from "${peripheralDevice._id}": "${deviceId}" "${triggerId}" ${
			values !== undefined ? JSON.stringify(values) : '(empty)'
		}`
	)

	const actionManager = StudioActionManagers.get(studioId)

	if (!actionManager)
		throw new Meteor.Error(500, `No Studio Action Manager available to handle trigger in Studio "${studioId}"`)

	DeviceTriggerMountedActions.find({
		deviceId,
		deviceTriggerId: triggerId,
	}).forEach((mountedAction) => {
		if (values && !_.isMatch(values, mountedAction.values)) return
		const executableAction = actionManager.getAction(mountedAction.actionId)
		if (!executableAction)
			throw new Meteor.Error(
				500,
				`Executable action not found when processing trigger "${deviceId}" "${triggerId}"`
			)

		const context = actionManager.getContext()
		if (!context) throw new Meteor.Error(500, `Undefined Device Trigger context for studio "${studioId}"`)

		executableAction.execute((t: ITranslatableMessage) => t.key ?? t, `${deviceId}: ${triggerId}`, context)
	})
}
