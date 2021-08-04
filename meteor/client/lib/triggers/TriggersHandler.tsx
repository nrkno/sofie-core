import * as React from 'react'
import { useEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import Simonsson from 'simonsson'
import { PubSub } from '../../../lib/api/pubsub'
import { ShowStyleBase, ShowStyleBaseId, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { TriggeredActionId, TriggeredActions } from '../../../lib/collections/TriggeredActions'
import { useSubscription, useTracker } from '../ReactMeteorData/ReactMeteorData'
import { RundownPlaylistId, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { ISourceLayer, SomeAction, TriggerType } from '@sofie-automation/blueprints-integration'
import { RundownId } from '../../../lib/collections/Rundowns'
import {
	ActionContext,
	createAction as libCreateAction,
	isPreviewableAction,
} from '../../../lib/api/triggers/actionFactory'
import simonsson from 'simonsson'
import { Tracker } from 'meteor/tracker'
import { PartId } from '../../../lib/collections/Parts'
import { flatten, ProtectedString, protectString } from '../../../lib/lib'
import { IWrappedAdLib } from '../../../lib/api/triggers/actionFilterChainCompilers'
import { Mongo } from 'meteor/mongo'
import { AdLibActionId } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibActionId } from '../../../lib/collections/RundownBaselineAdLibActions'
import { PieceId } from '../../../lib/collections/Pieces'

type HotkeyTriggerListener = (e: KeyboardEvent) => void

interface IProps {
	rundownPlaylistId: RundownPlaylistId
	showStyleBaseId: ShowStyleBaseId
	currentPartId: PartId | null
	nextPartId: PartId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]

	simulateHotkeyBinding?: boolean
}

function useSubscriptions(
	rundownPlaylistId: RundownPlaylistId,
	rundownIds: RundownId[],
	showStyleBaseId: ShowStyleBaseId
) {
	const allReady = [
		useSubscription(
			PubSub.rundownPlaylists,
			{
				_id: rundownPlaylistId,
			},
			[rundownPlaylistId]
		),
		useSubscription(
			PubSub.rundowns,
			{
				playlistId: rundownPlaylistId,
			},
			[rundownPlaylistId]
		),

		useSubscription(
			PubSub.adLibActions,
			{
				rundownId: {
					$in: rundownIds,
				},
			},
			[rundownIds]
		),
		useSubscription(
			PubSub.adLibPieces,
			{
				rundownId: {
					$in: rundownIds,
				},
			},
			[rundownIds]
		),
		useSubscription(
			PubSub.rundownBaselineAdLibActions,
			{
				rundownId: {
					$in: rundownIds,
				},
			},
			[rundownIds]
		),
		useSubscription(
			PubSub.rundownBaselineAdLibPieces,
			{
				rundownId: {
					$in: rundownIds,
				},
			},
			[rundownIds]
		),
		useSubscription(
			PubSub.showStyleBases,
			{
				_id: showStyleBaseId,
			},
			[rundownIds]
		),
	]

	return !allReady.some((state) => state === false)
}

function createAction(
	id: TriggeredActionId,
	actions: SomeAction[],
	showStyleBase: ShowStyleBase,
	t: TFunction,
	collectContext: () => ActionContext | null,
	_name?: string
): {
	listener: HotkeyTriggerListener
	preview: () => IWrappedAdLib[]
} {
	const executableActions = actions.map((value) => libCreateAction(value, showStyleBase))
	return {
		preview: () => {
			const ctx = collectContext()
			if (ctx) {
				return flatten(executableActions.map((action) => (isPreviewableAction(action) ? action.preview(ctx) : [])))
			} else {
				return []
			}
		},
		listener: (e) => {
			const ctx = collectContext()
			if (ctx) {
				executableActions.forEach((action) => action.execute(t, e, ctx))
			}
		},
	}
}

function bindHotkey(id: TriggeredActionId, keys: string, up: boolean, action: HotkeyTriggerListener) {
	simonsson.bind(keys, action, {
		up,
		exclusive: true,
		ordered: 'modifiersFirst',
		tag: id,
	})
}

function unbindHotkey(keys: string, listener: (e: KeyboardEvent) => void) {
	Simonsson.unbind(keys, listener)
}

let rundownPlaylistContext: ActionContext | null = null
function setRundownPlaylistContext(ctx: ActionContext | null) {
	rundownPlaylistContext = ctx
}

type MountedTriggerId = ProtectedString<'mountedTriggerId'>
interface MountedTrigger {
	_id: MountedTriggerId
	triggeredActionId: TriggeredActionId
	type: IWrappedAdLib['type']
	targetId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | ISourceLayer['_id']
	keys: string[]
}

export const MountedTriggers = new Mongo.Collection<MountedTrigger>(null)

function isolatedAutorunWithCleanup(autorun: () => void | (() => void)): Tracker.Computation {
	let cleanUp: void | (() => void) | undefined
	const computation = Tracker.nonreactive(() =>
		Tracker.autorun(() => {
			cleanUp = autorun()
		})
	)
	function invalidationHandler() {
		if (typeof cleanUp === 'function') cleanUp()
		computation.onInvalidate(invalidationHandler)
	}
	if (cleanUp) {
		computation.onInvalidate(invalidationHandler)
	}
	if (Tracker.currentComputation) {
		Tracker.currentComputation.onStop(() => {
			computation.stop()
		})
	}
	return computation
}

/**
 * Note: there can only be a single TriggersHandler in the node tree.
 *
 * @param {IProps} props
 * @return {*}
 */
export const TriggersHandler: React.FC<IProps> = (props: IProps) => {
	const [initialized, setInitialized] = useState(false)
	const { t } = useTranslation()

	function collectCurrentContext(): ActionContext | null {
		return rundownPlaylistContext
	}

	useEffect(() => {
		Simonsson.init()
			.then(() => {
				setInitialized(true)
			})
			.catch(console.error)

		return () => {
			Simonsson.destroy().catch(console.error)
		}
	}, []) // run once

	useEffect(() => {
		if (rundownPlaylistContext) {
			throw new Error('There can only be a single instance of TriggersHandler in the Node tree.')
		}

		return () => {
			setRundownPlaylistContext(null)
		}
	}, [])

	useEffect(() => {
		Tracker.nonreactive(() => {
			const playlist = RundownPlaylists.findOne(props.rundownPlaylistId)
			if (playlist) {
				setRundownPlaylistContext({
					rundownPlaylist: playlist,
					currentPartId: props.currentPartId,
					nextPartId: props.nextPartId,
					currentSegmentPartIds: props.currentSegmentPartIds,
					nextSegmentPartIds: props.nextSegmentPartIds,
				})
			}
		})
	}, [
		props.rundownPlaylistId,
		props.currentPartId,
		props.currentSegmentPartIds,
		props.nextPartId,
		props.nextSegmentPartIds,
	])

	const triggerSubsReady = useSubscription(
		PubSub.triggeredActions,
		{
			showStyleBaseId: props.showStyleBaseId,
		},
		[props.showStyleBaseId]
	)

	const rundownIds =
		useTracker(() => {
			const playlist = RundownPlaylists.findOne(props.rundownPlaylistId, {
				fields: {
					_id: 1,
				},
			})
			if (playlist) {
				return playlist.getRundownUnorderedIDs()
			}
			return []
		}, [props.rundownPlaylistId]) || []

	const showStyleBase = useTracker(() => ShowStyleBases.findOne(props.showStyleBaseId))

	useSubscriptions(props.rundownPlaylistId, rundownIds, props.showStyleBaseId)

	const triggeredActions = useTracker(() => {
		return TriggeredActions.find({
			showStyleBaseId: props.showStyleBaseId,
		}).fetch()
	}, [props.showStyleBaseId])
	useEffect(() => {
		if (!triggeredActions || !initialized || !triggerSubsReady || !showStyleBase) {
			return
		}

		const createdActions: Map<TriggeredActionId, (e) => void> = new Map()
		const previewAutoruns: Tracker.Computation[] = []

		triggeredActions.forEach((pair) => {
			const action = createAction(pair._id, pair.actions, showStyleBase, t, collectCurrentContext, pair.name)
			createdActions.set(pair._id, action.listener)
			pair.triggers.forEach((trigger) => {
				if (trigger.type === TriggerType.hotkey) {
					bindHotkey(pair._id, trigger.keys, !!trigger.up, action.listener)
				}
			})
			const hotkeyTriggers = pair.triggers
				.filter((trigger) => trigger.type === TriggerType.hotkey)
				.map((trigger) => trigger.keys)

			previewAutoruns.push(
				isolatedAutorunWithCleanup(() => {
					const previewAdLibs = action.preview()
					previewAdLibs.forEach((adLib) => {
						MountedTriggers.insert({
							_id: protectString(pair._id + '_' + adLib._id + '_' + adLib.type),
							targetId: adLib._id,
							type: adLib.type,
							triggeredActionId: pair._id,
							keys: hotkeyTriggers,
						})
					})

					return () => {
						MountedTriggers.remove({
							triggeredActionId: pair._id,
						})
					}
				})
			)
		})

		return () => {
			if (initialized) {
				triggeredActions.forEach((pair) => {
					const action = createdActions.get(pair._id)
					if (action) {
						pair.triggers.forEach((trigger) => {
							if (trigger.type === TriggerType.hotkey) {
								unbindHotkey(trigger.keys, action)
							}
						})
					}
				})
			}

			previewAutoruns.forEach((autorun) => autorun.stop())
		}
	}, [triggeredActions])

	return null
}
