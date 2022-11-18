import {
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Complete, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import _ from 'underscore'
import { MethodContext } from '../../../lib/api/methods'
import {
	createAction,
	ExecutableAction,
	isPreviewableAction,
	ReactivePlaylistActionContext,
} from '../../../lib/api/triggers/actionFactory'
import {
	DeviceTriggerArguments,
	DeviceTriggerMountedAction,
	DeviceTriggerMountedActionId,
	PreviewWrappedAdLib,
	PreviewWrappedAdLibId,
} from '../../../lib/api/triggers/MountedTriggers'
import { isDeviceTrigger } from '../../../lib/api/triggers/triggerTypeSelectors'
import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { MongoCursor } from '../../../lib/collections/lib'
import { DBPartInstance, PartInstances } from '../../../lib/collections/PartInstances'
import { Parts } from '../../../lib/collections/Parts'
import { RundownBaselineAdLibActions } from '../../../lib/collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { DBRundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { DBRundown, Rundowns } from '../../../lib/collections/Rundowns'
import { Segments } from '../../../lib/collections/Segments'
import { DBShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { DBStudio, Studios } from '../../../lib/collections/Studios'
import { DBTriggeredActions, TriggeredActions, UITriggeredActionsObj } from '../../../lib/collections/TriggeredActions'
import { DummyReactiveVar } from '../../../lib/lib'
import { observerChain } from '../../lib/observerChain'
import { logger } from '../../logging'
import { checkAccessAndGetPeripheralDevice } from '../ingest/lib'
import { ReactiveCacheCollection } from './ReactiveCacheCollection'
import { ContentCache, createReactiveContentCache } from './reactiveContentCache'

const REACTIVITY_DEBOUNCE = 20

Meteor.startup(() => {
	if (Meteor.isServer) {
		Studios.find().observe({
			added: setupStudioObserver,
			changed: setupStudioObserver,
			removed: destroyStudioObserver,
		})
	}
})

type LiveStudioPlaylistQueryHandle = Meteor.LiveQueryHandle & {
	showStyleBaseId: ShowStyleBaseId
	activePlaylistId: RundownPlaylistId
	activationId: RundownPlaylistActivationId | undefined
	currentRundownId: RundownId
}

const studioObservers: Record<string, Meteor.LiveQueryHandle> = {}

function setupStudioObserver(studio: DBStudio) {
	logger.debug(`Creating deviceTriggers observer for Studio "${studio._id}"`)
	const studioId = studio._id
	let studioPlaylistObserver: LiveStudioPlaylistQueryHandle | null = null

	const contextChainLiveQuery = observerChain()
		.next(
			'activePlaylist',
			() =>
				RundownPlaylists.find(
					{
						studioId: studioId,
						activationId: { $exists: true },
					},
					{
						fields: {
							nextPartInstanceId: 1,
							currentPartInstanceId: 1,
							activationId: 1,
						},
					}
				) as MongoCursor<
					Pick<DBRundownPlaylist, '_id' | 'nextPartInstanceId' | 'currentPartInstanceId' | 'activationId'>
				>
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
		.end((state, nextState) => {
			// setupTriggeredActionsObserver(state)
			if (!state) {
				const oldObserver = studioPlaylistObserver
				if (!oldObserver) return
				if (
					oldObserver.showStyleBaseId === nextState?.showStyleBase?._id ||
					oldObserver.activePlaylistId === nextState?.activePlaylist?._id ||
					oldObserver.activationId === nextState?.activePlaylist?.activationId ||
					oldObserver.currentRundownId === nextState?.currentRundown?._id
				) {
					logger.debug(`Next props for deviceTriggers observer are the same as current, skipping teardown.`)
					return
				}
				logger.debug(
					`Destroying deviceTriggers observer for Studio "${
						studio._id
					}" for rundownPlaylist "${unprotectString(oldObserver.activePlaylistId)}", activation: "${
						oldObserver.activationId
					}"`
				)
				oldObserver.stop()
				studioPlaylistObserver = null
				return
			}

			const previousObserver = studioPlaylistObserver
			if (
				!previousObserver ||
				previousObserver.showStyleBaseId !== state.showStyleBase._id ||
				previousObserver.activePlaylistId !== state.activePlaylist._id ||
				previousObserver.activationId !== state.activePlaylist.activationId ||
				previousObserver.currentRundownId !== state.currentRundown._id
			) {
				logger.debug(
					`Restarting deviceTriggers observer for Studio "${studio._id}" for rundownPlaylist "${state.activePlaylist._id}", activation: "${state.activePlaylist.activationId}"`
				)

				previousObserver?.stop()
				studioPlaylistObserver = setupRundownPlaylistObserver(studioId, {
					activePlaylistId: state.activePlaylist._id,
					activationId: state.activePlaylist.activationId,
					currentRundownId: state.currentRundown._id,
					showStyleBaseId: state.showStyleBase._id,
				})
			}
		})

	studioObservers[unprotectString(studioId)]?.stop()

	studioObservers[unprotectString(studioId)] = contextChainLiveQuery
}

function destroyStudioObserver(studio: DBStudio) {
	logger.debug(`Destroying deviceTriggers studio observer for Studio "${studio._id}"`)
	const studioId = unprotectString(studio._id)
	const observer = studioObservers[studioId]
	observer.stop()
	delete studioObservers[studioId]
}

function setupRundownPlaylistObserver(
	studioId: StudioId,
	{
		activePlaylistId,
		activationId,
		showStyleBaseId,
		currentRundownId,
	}: {
		activePlaylistId: RundownPlaylistId
		activationId: RundownPlaylistActivationId | undefined
		showStyleBaseId: ShowStyleBaseId
		currentRundownId: RundownId
	}
): LiveStudioPlaylistQueryHandle {
	// set up observers on the content collections and cache the results so that these can be evaluated later

	const observer = setupRundownsInPlaylistObserver({
		studioId,
		activationId,
		activePlaylistId,
		showStyleBaseId,
		currentRundownId,
	})

	return {
		stop: () => {
			observer.stop()
		},
		showStyleBaseId,
		activePlaylistId,
		activationId,
		currentRundownId,
	}
}

function setupRundownsInPlaylistObserver({
	studioId,
	activePlaylistId,
	activationId,
	showStyleBaseId,
	currentRundownId,
}: {
	studioId: StudioId
	activePlaylistId: RundownPlaylistId
	activationId: RundownPlaylistActivationId | undefined
	showStyleBaseId: ShowStyleBaseId
	currentRundownId: RundownId
}): Meteor.LiveQueryHandle {
	const rundownIds: Set<RundownId> = new Set<RundownId>()

	let contentObserver: Meteor.LiveQueryHandle | undefined
	const refreshSegmentObserver = _.debounce(
		Meteor.bindEnvironment(function refreshSegmentObserver() {
			contentObserver?.stop()
			contentObserver = setupSegmentsInRundownsObserver({
				currentRundownId,
				rundownIds: Array.from(rundownIds),
				rundownPlaylistId: activePlaylistId,
				activationId,
				showStyleBaseId,
				studioId,
			})
		}),
		REACTIVITY_DEBOUNCE
	)

	const rundownsObserver = Rundowns.find(
		{
			playlistId: activePlaylistId,
		},
		{
			projection: {
				_id: 1,
			},
		}
	).observe({
		added: (doc) => {
			rundownIds.add(doc._id)
			refreshSegmentObserver()
		},
		changed: (doc) => {
			rundownIds.add(doc._id)
			refreshSegmentObserver()
		},
		removed: (doc) => {
			rundownIds.delete(doc._id)
			refreshSegmentObserver()
		},
	})

	return {
		stop: () => {
			contentObserver?.stop()
			rundownsObserver.stop()
		},
	}
}

function setupSegmentsInRundownsObserver({
	studioId,
	rundownIds,
	rundownPlaylistId,
	activationId,
	showStyleBaseId,
	currentRundownId,
}: {
	studioId: StudioId
	rundownIds: RundownId[]
	rundownPlaylistId: RundownPlaylistId
	activationId: RundownPlaylistActivationId | undefined
	showStyleBaseId: ShowStyleBaseId
	currentRundownId: RundownId
}): Meteor.LiveQueryHandle {
	const segmentIds: Set<SegmentId> = new Set<SegmentId>()

	let contentObserver: Meteor.LiveQueryHandle | undefined
	const refreshContentObserver = _.debounce(
		Meteor.bindEnvironment(function refreshContentObserver() {
			contentObserver?.stop()
			contentObserver = setupRundownContentObserver({
				segmentIds: Array.from(segmentIds),
				rundownIds,
				studioId,
				showStyleBaseId,
				rundownPlaylistId,
				activationId,
				currentRundownId,
			})
		}),
		REACTIVITY_DEBOUNCE
	)

	const segmentsObserver = Segments.find(
		{
			rundownId: {
				$in: rundownIds,
			},
		},
		{
			projection: {
				_id: 1,
			},
		}
	).observe({
		added: (doc) => {
			segmentIds.add(doc._id)
			refreshContentObserver()
		},
		changed: (doc) => {
			segmentIds.add(doc._id)
			refreshContentObserver()
		},
		removed: (doc) => {
			segmentIds.delete(doc._id)
			refreshContentObserver()
		},
	})

	return {
		stop: () => {
			contentObserver?.stop()
			segmentsObserver.stop()
		},
	}
}

function setupRundownContentObserver({
	studioId,
	rundownIds,
	segmentIds,
	showStyleBaseId,
	rundownPlaylistId,
	activationId,
	currentRundownId,
}: {
	studioId: StudioId
	rundownIds: RundownId[]
	segmentIds: SegmentId[]
	showStyleBaseId: ShowStyleBaseId
	rundownPlaylistId: RundownPlaylistId
	activationId: RundownPlaylistActivationId | undefined
	currentRundownId: RundownId
}): Meteor.LiveQueryHandle {
	const { cache, cancel: cancelCache } = createReactiveContentCache(
		Meteor.bindEnvironment((cache) => {
			logger.debug(`DeviceTriggers observer reacting to change in RundownPlaylist "${rundownPlaylistId}"`)
			refreshDeviceTriggerMountedActions(studioId, showStyleBaseId, currentRundownId, cache)
		}),
		REACTIVITY_DEBOUNCE
	)

	const observers: Meteor.LiveQueryHandle[] = [
		Segments.find({
			rundownId: {
				$in: rundownIds,
			},
		}).observe(cache.Segments.link()),
		Parts.find({
			segmentId: {
				$in: segmentIds,
			},
		}).observe(cache.Parts.link()),
		PartInstances.find(
			{
				playlistActivationId: activationId,
				reset: {
					$ne: true,
				},
			},
			{
				projection: {
					_id: 1,
					part: 1,
				},
			}
		).observe(cache.PartInstances.link()),
		RundownBaselineAdLibActions.find({
			rundownId: {
				$in: rundownIds,
			},
		}).observe(cache.RundownBaselineAdLibActions.link()),
		RundownBaselineAdLibPieces.find({
			rundownId: {
				$in: rundownIds,
			},
		}).observe(cache.RundownBaselineAdLibPieces.link()),
		AdLibActions.find({
			rundownId: {
				$in: rundownIds,
			},
		}).observe(cache.AdLibActions.link()),
		AdLibPieces.find({
			rundownId: {
				$in: rundownIds,
			},
		}).observe(cache.AdLibPieces.link()),
		ShowStyleBases.find(showStyleBaseId).observe(cache.ShowStyleBases.link()),
		TriggeredActions.find({
			showStyleBaseId: {
				$in: [showStyleBaseId, null],
			},
		}).observe(cache.TriggeredActions.link()),
		RundownPlaylists.find(rundownPlaylistId, {
			projection: {
				_id: 1,
				name: 1,
				activationId: 1,
				currentPartInstanceId: 1,
				nextPartInstanceId: 1,
			},
		}).observe(cache.RundownPlaylists.link()),
	]

	return {
		stop: Meteor.bindEnvironment(() => {
			logger.debug(`Cleaning up DeviceTriggers`)
			cancelCache()
			refreshDeviceTriggerMountedActions(studioId, showStyleBaseId, currentRundownId, null)
			observers.forEach((observer) => observer.stop())
		}),
	}
}

const allDeviceActions: Map<string, ExecutableAction> = new Map()
const currentStudioContexts: Map<StudioId, ReactivePlaylistActionContext> = new Map()

export const DeviceTriggerMountedActions = new ReactiveCacheCollection<DeviceTriggerMountedAction>(() => {
	console.log(`Actions: `, DeviceTriggerMountedActions.find().count())
})
export const DeviceTriggerMountedActionAdlibsPreview = new ReactiveCacheCollection<PreviewWrappedAdLib>(() => {
	console.log(`AdLibs in Preview: `, DeviceTriggerMountedActionAdlibsPreview.find().count())
})

export async function receiveTrigger(
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

	logger.debug(`${deviceId} ${triggerId}`)

	DeviceTriggerMountedActions.find({
		deviceId,
		deviceTriggerId: triggerId,
	}).forEach((mountedAction) => {
		if (values && !_.isMatch(values, mountedAction.values)) return
		const executableAction = allDeviceActions.get(mountedAction.actionId)
		if (!executableAction)
			throw new Meteor.Error(
				500,
				`Executable action not found when processing trigger "${deviceId}" "${triggerId}"`
			)

		const context = currentStudioContexts.get(studioId)
		if (!context) throw new Meteor.Error(500, `Undefined Device Trigger context for studio "${studioId}"`)

		executableAction.execute(
			(t: ITranslatableMessage) => t.key ?? t,
			() => `${deviceId}: ${triggerId}`,
			context
		)
	})
}

function refreshDeviceTriggerMountedActions(
	studioId: StudioId,
	showStyleBaseId: ShowStyleBaseId,
	currentRundownId: RundownId,
	cache: ContentCache | null
): void {
	if (!cache) {
		DeviceTriggerMountedActions.find({
			studioId,
			showStyleBaseId,
		}).forEach((mountedAction) => {
			allDeviceActions.delete(mountedAction.actionId)
		})
		DeviceTriggerMountedActions.remove({
			studioId,
			showStyleBaseId,
		})
		DeviceTriggerMountedActionAdlibsPreview.remove({
			studioId,
			showStyleBaseId,
		})
		currentStudioContexts.delete(studioId)
		console.log(`allDeviceActions: `, allDeviceActions.size)
		return
	}

	const context = createCurrentContextFromCache(currentRundownId, cache)
	currentStudioContexts.set(studioId, context)

	const showStyleBase = cache.ShowStyleBases.findOne(showStyleBaseId)
	if (!showStyleBase) {
		logger.debug(`Show Style Base required to process triggered actions`)
		return
	}

	const { obj: sourceLayers } = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides)

	const allTriggeredActions = cache.TriggeredActions.find({
		showStyleBaseId: {
			$in: [showStyleBaseId, null],
		},
	}).map((pair) => convertDocument(pair))
	const triggeredActions = allTriggeredActions.filter((pair) =>
		Object.values(pair.triggers).find((trigger) => isDeviceTrigger(trigger))
	)

	const upsertedDeviceTriggerMountedActionIds: DeviceTriggerMountedActionId[] = []

	for (const triggeredAction of triggeredActions) {
		const addedPreviewIds: PreviewWrappedAdLibId[] = []

		Object.entries(triggeredAction.actions).forEach(([key, action]) => {
			const compiledAction = createAction(action, sourceLayers)
			const actionId = `${studioId}_${triggeredAction._id}_${key}`
			allDeviceActions.set(actionId, compiledAction)

			Object.entries(triggeredAction.triggers).forEach(([key, trigger]) => {
				if (!isDeviceTrigger(trigger)) {
					return
				}

				const deviceTriggerMountedActionId = protectString(`${actionId}_${key}`)
				DeviceTriggerMountedActions.upsert(deviceTriggerMountedActionId, {
					$set: {
						studioId,
						showStyleBaseId,
						actionType: compiledAction.action,
						actionId,
						deviceId: trigger.deviceId,
						deviceTriggerId: trigger.triggerId,
						values: trigger.values,
						name: triggeredAction.name,
					},
				})
				upsertedDeviceTriggerMountedActionIds.push(deviceTriggerMountedActionId)
			})

			if (!isPreviewableAction(compiledAction)) return

			const previewedAdLibs = compiledAction.preview(context)
			console.log(`Previewed: `, previewedAdLibs.length)

			previewedAdLibs.forEach((adLib) => {
				const adLibPreviewId = protectString<PreviewWrappedAdLibId>(
					`${triggeredAction._id}_${studioId}_${key}_${adLib._id}`
				)
				DeviceTriggerMountedActionAdlibsPreview.upsert(adLibPreviewId, {
					$set: {
						...adLib,
						_id: adLibPreviewId,
						triggeredActionId: triggeredAction._id,
						actionId: actionId,
						studioId,
						showStyleBaseId,
						sourceLayerType: adLib.sourceLayerId ? sourceLayers[adLib.sourceLayerId]?.type : undefined,
					},
				})
				addedPreviewIds.push(adLibPreviewId)
			})
		})

		DeviceTriggerMountedActionAdlibsPreview.remove({
			triggeredActionId: triggeredAction._id,
			_id: {
				$nin: addedPreviewIds,
			},
		})
	}

	DeviceTriggerMountedActions.remove({
		studioId,
		showStyleBaseId,
		_id: {
			$nin: upsertedDeviceTriggerMountedActionIds,
		},
	})

	console.log(`allDeviceActions: `, allDeviceActions.size)
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

function createCurrentContextFromCache(
	currentRundownId: RundownId,
	cache: ContentCache
): ReactivePlaylistActionContext {
	const rundownPlaylist = cache.RundownPlaylists.findOne({
		activationId: {
			$exists: true,
		},
	})

	if (!rundownPlaylist) throw new Error('There should be an active RundownPlaylist!')

	const currentPartInstance = rundownPlaylist.currentPartInstanceId
		? cache.PartInstances.findOne(rundownPlaylist.currentPartInstanceId)
		: undefined
	const nextPartInstance = rundownPlaylist.nextPartInstanceId
		? cache.PartInstances.findOne(rundownPlaylist.nextPartInstanceId)
		: undefined

	const currentSegmentPartIds = currentPartInstance
		? cache.Parts.find({
				segmentId: currentPartInstance.part.segmentId,
		  }).map((part) => part._id)
		: []
	const nextSegmentPartIds = nextPartInstance
		? nextPartInstance.part.segmentId === currentPartInstance?.part.segmentId
			? currentSegmentPartIds
			: cache.Parts.find({
					segmentId: nextPartInstance.part.segmentId,
			  }).map((part) => part._id)
		: []

	return {
		currentPartInstanceId: new DummyReactiveVar(currentPartInstance?._id ?? null),
		currentPartId: new DummyReactiveVar(currentPartInstance?.part._id ?? null),
		nextPartId: new DummyReactiveVar(nextPartInstance?.part._id ?? null),
		currentRundownId: new DummyReactiveVar(currentRundownId),
		rundownPlaylist: new DummyReactiveVar(rundownPlaylist),
		rundownPlaylistId: new DummyReactiveVar(rundownPlaylist._id),
		currentSegmentPartIds: new DummyReactiveVar(currentSegmentPartIds),
		nextSegmentPartIds: new DummyReactiveVar(nextSegmentPartIds),
	}
}
