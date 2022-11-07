import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Complete, literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import _ from 'underscore'
import { createAction, ExecutableAction } from '../../../lib/api/triggers/actionFactory'
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
import { observerChain } from '../../lib/observerChain'
import { logger } from '../../logging'
import { ContentCache, createReactiveContentCache } from './reactiveContentCache'

const REACTIVITY_DEBOUNCE = 100

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
}

const studioObservers: Record<string, Meteor.LiveQueryHandle> = {}
const studioPlaylistObserver: Record<string, LiveStudioPlaylistQueryHandle> = {}

function setupStudioObserver(studio: DBStudio) {
	logger.debug(`Creating deviceTriggers observer for Studio "${studio._id}"`)
	const studioId = studio._id

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
		.end((state) => {
			// setupTriggeredActionsObserver(state)
			if (!state) {
				const oldObserver = studioPlaylistObserver[unprotectString(studioId)]
				if (!oldObserver) return
				logger.debug(
					`Destroying deviceTriggers observer for Studio "${
						studio._id
					}" for rundownPlaylist "${unprotectString(oldObserver.activePlaylistId)}", activation: "${
						oldObserver.activationId
					}"`
				)
				oldObserver.stop()
				delete studioPlaylistObserver[unprotectString(studioId)]
				return
			}

			const previousObserver = studioPlaylistObserver[unprotectString(studioId)] as
				| LiveStudioPlaylistQueryHandle
				| undefined
			if (
				!previousObserver ||
				previousObserver.showStyleBaseId !== state.showStyleBase._id ||
				previousObserver.activePlaylistId !== state.activePlaylist._id ||
				previousObserver.activationId !== state.activePlaylist.activationId
			) {
				logger.debug(
					`Restarting deviceTriggers observer for Studio "${studio._id}" for rundownPlaylist "${state.activePlaylist._id}", activation: "${state.activePlaylist.activationId}"`
				)

				previousObserver?.stop()
				studioPlaylistObserver[unprotectString(studioId)] = setupRundownPlaylistObserver(studioId, state)
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
		activePlaylist,
		showStyleBase,
	}: {
		activePlaylist: Pick<DBRundownPlaylist, '_id' | 'activationId'>
		showStyleBase: Pick<DBShowStyleBase, '_id'>
	}
): LiveStudioPlaylistQueryHandle {
	// set up observers on the content collections and cache the results so that these can be evaluated later

	const observer = setupRundownsInPlaylistObserver({
		studioId,
		rundownPlaylist: activePlaylist,
		showStyleBaseId: showStyleBase._id,
	})

	return {
		stop: () => {
			observer.stop()
		},
		showStyleBaseId: showStyleBase._id,
		activePlaylistId: activePlaylist._id,
		activationId: activePlaylist.activationId,
	}
}

function setupRundownsInPlaylistObserver({
	studioId,
	rundownPlaylist,
	showStyleBaseId,
}: {
	studioId: StudioId
	rundownPlaylist: Pick<DBRundownPlaylist, '_id' | 'activationId'>
	showStyleBaseId: ShowStyleBaseId
}): Meteor.LiveQueryHandle {
	const rundownIds: Set<RundownId> = new Set<RundownId>()
	let contentObserver: Meteor.LiveQueryHandle | undefined
	const refreshContentObserver = _.debounce(
		Meteor.bindEnvironment(function refreshContentObserver() {
			contentObserver?.stop()
			contentObserver = setupRundownContentObserver({
				rundownIds: Array.from(rundownIds.values()),
				studioId,
				showStyleBaseId,
				rundownPlaylistId: rundownPlaylist._id,
				activationId: rundownPlaylist.activationId,
			})
		}),
		REACTIVITY_DEBOUNCE
	)

	const rundownsObserver = Rundowns.find({
		playlistId: rundownPlaylist._id,
	}).observe({
		added: (doc) => {
			rundownIds.add(doc._id)
			refreshContentObserver()
		},
		changed: (doc) => {
			rundownIds.add(doc._id)
			refreshContentObserver()
		},
		removed: (doc) => {
			rundownIds.delete(doc._id)
			refreshContentObserver()
		},
	})

	return {
		stop: () => {
			contentObserver?.stop()
			rundownsObserver.stop()
		},
	}
}

function setupRundownContentObserver({
	studioId,
	rundownIds,
	showStyleBaseId,
	rundownPlaylistId,
	activationId,
}: {
	studioId: StudioId
	rundownIds: RundownId[]
	showStyleBaseId: ShowStyleBaseId
	rundownPlaylistId: RundownPlaylistId
	activationId: RundownPlaylistActivationId | undefined
}): Meteor.LiveQueryHandle {
	const cache = createReactiveContentCache((cache) => {
		logger.debug(`DeviceTriggers observer reacting to change in RundownPlaylist "${rundownPlaylistId}"`)
		refreshDeviceTriggerMountedActions(studioId, showStyleBaseId, cache)
	}, REACTIVITY_DEBOUNCE)

	const observers: Meteor.LiveQueryHandle[] = [
		Segments.find({
			rundownId: {
				$in: rundownIds,
			},
		}).observe(cache.Segments.link()),
		Parts.find({
			rundownIds: {
				$in: rundownIds,
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
			showStyleBaseId,
		}).observe(cache.TriggeredActions.link()),
		RundownPlaylists.find(rundownPlaylistId, {
			projection: {
				_id: 1,
				activationId: 1,
				currentPartInstanceId: 1,
				nextPartInstanceId: 1,
			},
		}).observe(cache.RundownPlaylists.link()),
	]

	return {
		stop: () => {
			logger.debug(`Cleaning up DeviceTriggers`)
			refreshDeviceTriggerMountedActions(studioId, showStyleBaseId, null)
			observers.forEach((observer) => observer.stop())
		},
	}
}

const allDeviceActions: Record<string, ExecutableAction> = {}

function refreshDeviceTriggerMountedActions(
	studioId: StudioId,
	showStyleBaseId: ShowStyleBaseId,
	cache: ContentCache | null
): void {
	if (!cache) {
		// TODO: remove all mounted actions
		return
	}

	const showStyleBase = cache.ShowStyleBases.findOne(showStyleBaseId)
	if (!showStyleBase) {
		logger.debug(`Show Style Base required to process triggered actions`)
		return
	}

	const { obj: sourceLayers } = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides)

	const allTriggeredActions = cache.TriggeredActions.find({
		showStyleBaseId,
	}).map((pair) => convertDocument(pair))
	const triggeredActions = allTriggeredActions.filter((pair) =>
		Object.values(pair.triggers).find((trigger) => isDeviceTrigger(trigger))
	)

	for (const triggeredAction of triggeredActions) {
		Object.entries(triggeredAction.actions).forEach(([key, action]) => {
			const compiledAction = createAction(action, sourceLayers)
			allDeviceActions[`${studioId}_${triggeredAction._id}_${key}`] = compiledAction
		})
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
