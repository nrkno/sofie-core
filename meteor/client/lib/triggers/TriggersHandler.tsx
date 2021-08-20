import * as React from 'react'
import { useEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import Sorensen from '@sofie-automation/sorensen'
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
import { Tracker } from 'meteor/tracker'
import { PartId } from '../../../lib/collections/Parts'
import { flatten, ProtectedString, protectString } from '../../../lib/lib'
import { IWrappedAdLib } from '../../../lib/api/triggers/actionFilterChainCompilers'
import { Mongo } from 'meteor/mongo'
import { AdLibActionId } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibActionId } from '../../../lib/collections/RundownBaselineAdLibActions'
import { PieceId } from '../../../lib/collections/Pieces'
import { ReactiveVar } from 'meteor/reactive-var'
import { ITranslatableMessage } from '../../../lib/api/TranslatableMessage'

type HotkeyTriggerListener = (e: KeyboardEvent) => void

interface IProps {
	rundownPlaylistId: RundownPlaylistId
	currentRundownId: RundownId | null
	showStyleBaseId: ShowStyleBaseId
	currentPartId: PartId | null
	nextPartId: PartId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]

	simulateTriggerBinding?: boolean
	sorensen?: typeof Sorensen
	global?: (e: KeyboardEvent) => boolean
}

function useSubscriptions(
	rundownPlaylistId: RundownPlaylistId,
	rundownIds: RundownId[],
	showStyleBaseId: ShowStyleBaseId
) {
	const allReady = [
		useSubscription(PubSub.rundownPlaylists, {
			_id: rundownPlaylistId,
		}),
		useSubscription(PubSub.rundowns, {
			playlistId: rundownPlaylistId,
		}),

		useSubscription(PubSub.adLibActions, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.adLibPieces, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.rundownBaselineAdLibActions, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.rundownBaselineAdLibPieces, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.showStyleBases, {
			_id: showStyleBaseId,
		}),
	]

	return !allReady.some((state) => state === false)
}

function createAction(
	id: TriggeredActionId,
	actions: SomeAction[],
	showStyleBase: ShowStyleBase,
	t: TFunction,
	collectContext: () => ActionContext | null
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
			e.preventDefault()
			e.stopPropagation()

			const ctx = collectContext()
			if (ctx) {
				executableActions.forEach((action) => action.execute(t, e, ctx))
			}
		},
	}
}

const rundownPlaylistContext: ReactiveVar<ActionContext | null> = new ReactiveVar(null)
function setRundownPlaylistContext(ctx: ActionContext | null) {
	rundownPlaylistContext.set(ctx)
}
function getCurrentContext(): ActionContext | null {
	return rundownPlaylistContext.get()
}

type MountedAdLibTriggerId = ProtectedString<'mountedAdLibTriggerId'>
export interface MountedAdLibTrigger {
	_id: MountedAdLibTriggerId
	_rank: number
	triggeredActionId: TriggeredActionId
	type: IWrappedAdLib['type']
	targetId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | ISourceLayer['_id']
	keys: string[]
	name?: string | ITranslatableMessage
}

export const MountedAdLibTriggers = new Mongo.Collection<MountedAdLibTrigger>(null)

type MountedGenericTriggerId = ProtectedString<'mountedGenericTriggerId'>
export interface MountedGenericTrigger {
	_id: MountedGenericTriggerId
	_rank: number
	triggeredActionId: TriggeredActionId
	name: string | ITranslatableMessage
}

export const MountedGenericTriggers = new Mongo.Collection<MountedGenericTrigger>(null)

function isolatedAutorunWithCleanup(autorun: () => void | (() => void)): Tracker.Computation {
	const computation = Tracker.nonreactive(() =>
		Tracker.autorun((computation) => {
			const cleanUp = autorun()

			if (typeof cleanUp === 'function') {
				computation.onInvalidate(cleanUp)
			}
		})
	)
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
export const TriggersHandler: React.FC<IProps> = function TriggersHandler(
	props: IProps
): React.ReactElement<any, any> | null {
	const [initialized, setInitialized] = useState(props.sorensen ? true : false)
	const { t } = useTranslation()
	const localSorensen = props.sorensen || Sorensen

	function bindHotkey(id: TriggeredActionId, keys: string, up: boolean, action: HotkeyTriggerListener) {
		try {
			localSorensen.bind(keys, action, {
				up,
				exclusive: true,
				ordered: 'modifiersFirst',
				global: props.global ?? false,
				tag: id,
			})
		} catch (e) {
			console.error(e)
		}
	}

	function unbindHotkey(keys: string, listener: (e: KeyboardEvent) => void) {
		localSorensen.unbind(keys, listener)
	}

	useEffect(() => {
		// if we're using a local instance of Sorensen
		if (!props.sorensen) {
			localSorensen
				.init()
				.then(() => {
					setInitialized(true)
				})
				.catch(console.error)
		}

		return () => {
			// do not destroy, if we're using a provided instance of Sorensen
			if (!props.sorensen) {
				localSorensen.destroy().catch(console.error)
			}
		}
	}, []) // run once

	useEffect(() => {
		if (rundownPlaylistContext.get() !== null) {
			throw new Error('There can only be a single instance of TriggersHandler in the Node tree.')
		}

		return () => {
			setRundownPlaylistContext(null)
		}
	}, [])

	function poisonHotkeys() {
		console.log('Poisoned')
		localSorensen.poison() // cancels all pressed keys, poisons all chords, no hotkey trigger will execute
	}

	useEffect(() => {
		if (initialized) {
			localSorensen.bind('Escape', poisonHotkeys, {
				exclusive: false,
				global: true,
			})
		}

		return () => {
			localSorensen.unbind('Escape', poisonHotkeys)
		}
	}, [initialized]) // run once once Sorensen is initialized

	useEffect(() => {
		Tracker.nonreactive(() => {
			const playlist = RundownPlaylists.findOne(props.rundownPlaylistId, {
				fields: {
					_id: 1,
					name: 1,
					activationId: 1,
					nextPartInstanceId: 1,
					currentPartInstanceId: 1,
				},
			})
			if (playlist) {
				setRundownPlaylistContext({
					rundownPlaylist: playlist,
					currentRundownId: props.currentRundownId,
					currentPartId: props.currentPartId,
					nextPartId: props.nextPartId,
					currentSegmentPartIds: props.currentSegmentPartIds,
					nextSegmentPartIds: props.nextSegmentPartIds,
				})
			}
		})
	}, [
		props.rundownPlaylistId,
		props.currentRundownId,
		props.currentPartId,
		props.currentSegmentPartIds,
		props.nextPartId,
		props.nextSegmentPartIds,
	])

	const triggerSubReady = useSubscription(PubSub.triggeredActions, {
		$or: [
			{
				showStyleBaseId: props.showStyleBaseId,
			},
			{
				showStyleBaseId: null,
			},
		],
	})

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

	const showStyleBase = useTracker(() => ShowStyleBases.findOne(props.showStyleBaseId), [props.showStyleBaseId])

	useSubscriptions(props.rundownPlaylistId, rundownIds, props.showStyleBaseId)

	const triggeredActions = useTracker(() => {
		return TriggeredActions.find(
			{
				$or: [
					{
						showStyleBaseId: props.showStyleBaseId,
					},
					{
						showStyleBaseId: null,
					},
				],
			},
			{
				sort: {
					showStyleBaseId: 1,
					_rank: 1,
				},
			}
		).fetch()
	}, [props.showStyleBaseId])

	useEffect(() => {
		if (!triggeredActions || !initialized || !showStyleBase || !triggerSubReady) {
			return
		}

		const createdActions: Map<TriggeredActionId, (e) => void> = new Map()
		const previewAutoruns: Tracker.Computation[] = []

		triggeredActions.forEach((pair) => {
			const action = createAction(pair._id, pair.actions, showStyleBase, t, getCurrentContext)
			if (!props.simulateTriggerBinding) {
				createdActions.set(pair._id, action.listener)
				pair.triggers.forEach((trigger) => {
					if (trigger.type === TriggerType.hotkey) {
						bindHotkey(pair._id, trigger.keys, !!trigger.up, action.listener)
					}
				})
			}

			if (pair.name) {
				const genericTriggerId = protectString(`${pair._id}`)
				MountedGenericTriggers.upsert(genericTriggerId, {
					$set: {
						_id: genericTriggerId,
						_rank: pair._rank,
						triggeredActionId: pair._id,
						name: pair.name,
					},
				})
			}

			const hotkeyTriggers = pair.triggers
				.filter((trigger) => trigger.type === TriggerType.hotkey)
				.map((trigger) => trigger.keys)

			previewAutoruns.push(
				isolatedAutorunWithCleanup(() => {
					let previewAdLibs: IWrappedAdLib[] = []
					try {
						previewAdLibs = action.preview()
					} catch (e) {
						console.error('Exception thrown while previewing action', e)
					}

					previewAdLibs.forEach((adLib) => {
						const triggerId = protectString(pair._id + '_' + adLib._id + '_' + adLib.type)
						MountedAdLibTriggers.upsert(triggerId, {
							$set: {
								_id: triggerId,
								_rank: pair._rank,
								targetId: adLib._id,
								type: adLib.type,
								triggeredActionId: pair._id,
								keys: hotkeyTriggers,
								name: pair.name,
							},
						})
					})

					return () => {
						MountedAdLibTriggers.remove({
							triggeredActionId: pair._id,
						})
					}
				})
			)
		})

		return () => {
			if (initialized) {
				triggeredActions.forEach((pair) => {
					const actionListener = createdActions.get(pair._id)
					if (actionListener) {
						pair.triggers.forEach((trigger) => {
							if (trigger.type === TriggerType.hotkey) {
								unbindHotkey(trigger.keys, actionListener)
							}
						})
					}

					if (pair.name) {
						MountedGenericTriggers.remove({
							triggeredActionId: pair._id,
						})
					}
				})
			}

			previewAutoruns.forEach((autorun) => autorun.stop())
		}
	}, [triggeredActions, initialized, showStyleBase, triggerSubReady])

	return null
}

window['MountedAdLibTriggers'] = MountedAdLibTriggers
window['MountedGenericTriggers'] = MountedGenericTriggers
