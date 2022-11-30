import { ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Complete, getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import {
	createAction,
	isPreviewableAction,
	ReactivePlaylistActionContext,
} from '../../../lib/api/triggers/actionFactory'
import { DeviceTriggerMountedActionId, PreviewWrappedAdLibId } from '../../../lib/api/triggers/MountedTriggers'
import { isDeviceTrigger } from '../../../lib/api/triggers/triggerTypeSelectors'
import { DBTriggeredActions, UITriggeredActionsObj } from '../../../lib/collections/TriggeredActions'
import { DummyReactiveVar, protectString } from '../../../lib/lib'
import { logger } from '../../logging'
import { GlobalTriggerManager } from './GlobalTriggerManager'
import { DeviceTriggerMountedActionAdlibsPreview, DeviceTriggerMountedActions } from './observer'
import { ContentCache } from './reactiveContentCache'

export class StudioDeviceTriggerManager {
	#showStyleBaseId: ShowStyleBaseId | null = null

	constructor(public studioId: StudioId) {}

	public get showStyleBaseId(): ShowStyleBaseId | null {
		return this.#showStyleBaseId
	}

	public set showStyleBaseId(value: ShowStyleBaseId | null) {
		this.#showStyleBaseId = value
	}

	updateTriggers(cache: ContentCache | null): void {
		const studioId = this.studioId
		const showStyleBaseId = this.#showStyleBaseId

		const runId = getRandomString(10)

		logger.silly(`${runId}: ShowStyleBaseId is ${showStyleBaseId}, cache: ${!!cache}`)

		if (!showStyleBaseId) {
			logger.silly(`${runId}: no showStyleBaseId, finishing`)
			return
		}

		if (!cache) {
			DeviceTriggerMountedActions.find({
				studioId,
				showStyleBaseId,
			}).forEach((mountedAction) => {
				GlobalTriggerManager.deleteAction(mountedAction.actionId)
			})
			DeviceTriggerMountedActions.remove({
				studioId,
				showStyleBaseId,
			})
			DeviceTriggerMountedActionAdlibsPreview.remove({
				studioId,
				showStyleBaseId,
			})
			GlobalTriggerManager.deleteStudioContext(studioId)
			logger.silly(`${runId}: no cache, finishing`)
			return
		}

		const rundownPlaylist = cache.RundownPlaylists.findOne({
			activationId: {
				$exists: true,
			},
		})
		if (!rundownPlaylist) {
			logger.silly(`${runId}: no rundownPlaylist, finishing`)
			return
		}

		const context = createCurrentContextFromCache(cache)
		GlobalTriggerManager.setStudioContext(studioId, context)

		const showStyleBase = cache.ShowStyleBases.findOne(showStyleBaseId)
		if (!showStyleBase) {
			logger.silly(`${runId}: no showStyleBase, finishing`)
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
				const actionId = protectString(`${studioId}_${triggeredAction._id}_${key}`)
				GlobalTriggerManager.setAction(actionId, compiledAction)

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

				previewedAdLibs.forEach((adLib) => {
					const adLibPreviewId = protectString<PreviewWrappedAdLibId>(
						`${triggeredAction._id}_${studioId}_${key}_${adLib._id}`
					)
					DeviceTriggerMountedActionAdlibsPreview.upsert(adLibPreviewId, {
						$set: {
							...adLib,
							_id: adLibPreviewId,
							triggeredActionId: triggeredAction._id,
							actionId,
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

		logger.silly(`${runId}: finished processing`)
	}

	dispose() {
		this.updateTriggers(null)
	}
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

function createCurrentContextFromCache(cache: ContentCache): ReactivePlaylistActionContext {
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
		currentRundownId: new DummyReactiveVar(
			currentPartInstance?.part.rundownId ?? nextPartInstance?.part.rundownId ?? null
		),
		rundownPlaylist: new DummyReactiveVar(rundownPlaylist),
		rundownPlaylistId: new DummyReactiveVar(rundownPlaylist._id),
		currentSegmentPartIds: new DummyReactiveVar(currentSegmentPartIds),
		nextSegmentPartIds: new DummyReactiveVar(nextSegmentPartIds),
	}
}
