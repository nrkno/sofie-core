import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import Sorensen from '@sofie-automation/sorensen'
import { PubSub } from '../../../lib/api/pubsub'
import { ShowStyleBase, ShowStyleBaseId, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { TriggeredActionId, TriggeredActions } from '../../../lib/collections/TriggeredActions'
import { useSubscription, useTracker } from '../ReactMeteorData/ReactMeteorData'
import { RundownPlaylistId, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { ISourceLayer, PlayoutActions, SomeAction, TriggerType } from '@sofie-automation/blueprints-integration'
import { RundownId } from '../../../lib/collections/Rundowns'
import {
	createAction as libCreateAction,
	isPreviewableAction,
	ReactivePlaylistActionContext,
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
import { preventDefault } from '../SorensenContext'
import { getFinalKey } from './codesToKeyLabels'
import RundownViewEventBus, { RundownViewEvents, TriggerActionEvent } from '../../ui/RundownView/RundownViewEventBus'

type HotkeyTriggerListener = (e: KeyboardEvent) => void

interface IProps {
	rundownPlaylistId: RundownPlaylistId
	currentRundownId: RundownId | null
	showStyleBaseId: ShowStyleBaseId
	currentPartId: PartId | null
	nextPartId: PartId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]

	/** Should this component actually try to bind to the hotkeys, or should it just populate the MountedAdLibTriggers
	 * and MountedGenericTriggers collections. */
	simulateTriggerBinding?: boolean
	/** Provide an external Sorensen object, if Sorensen has already been initialized */
	sorensen?: typeof Sorensen
	/** A function that should be executed when a trigger is fired to check if it should execute or not - such as is the
	 * case with non-global hotkeys which should only fire when not in an Input.
	 */
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
	collectContext: () => ReactivePlaylistActionContext | null
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

			const ctx = collectContext()
			if (ctx) {
				executableActions.forEach((action) => action.execute(t, e, ctx))
			}
		},
	}
}

const rundownPlaylistContext: ReactiveVar<ReactivePlaylistActionContext | null> = new ReactiveVar(null)

function setRundownPlaylistContext(ctx: ReactivePlaylistActionContext | null) {
	rundownPlaylistContext.set(ctx)
}
function getCurrentContext(): ReactivePlaylistActionContext | null {
	return rundownPlaylistContext.get()
}

type MountedAdLibTriggerId = ProtectedString<'mountedAdLibTriggerId'>
/** An AdLib action that will be triggered by hotkeys (can be AdLib, RundownBaselineAdLib, AdLib Action, Clear source layer, Sticky, etc.) */
export interface MountedAdLibTrigger {
	_id: MountedAdLibTriggerId
	/** Rank of the Action that is mounted under `keys` */
	_rank: number
	/** The ID of the action that will be triggered */
	triggeredActionId: TriggeredActionId
	/** The type of the adLib being targeted */
	type: IWrappedAdLib['type']
	/** The ID in the collection specified by `type` */
	targetId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | ISourceLayer['_id']
	/** Keys or combos that have a listener mounted to */
	keys: string[]
	/** Final keys in the combos */
	finalKeys: string[]
	/** A label of the action, if available */
	name?: string | ITranslatableMessage
	/** SourceLayerId of the target, if available */
	sourceLayerId?: ISourceLayer['_id']
	/** A label of the target if available */
	targetName?: string | ITranslatableMessage
}

export const MountedAdLibTriggers = new Mongo.Collection<MountedAdLibTrigger>(null)

type MountedGenericTriggerId = ProtectedString<'mountedGenericTriggerId'>
/** A generic action that will be triggered by hotkeys (generic, i.e. non-AdLib) */
export interface MountedGenericTrigger {
	_id: MountedGenericTriggerId
	/** Rank of the Action that is mounted under `keys1 */
	_rank: number
	/** The ID of the action that will be triggered */
	triggeredActionId: TriggeredActionId
	/** Keys or combos that have a listener mounted to */
	keys: string[]
	/** Final keys in the combos */
	finalKeys: string[]
	/** A label of the action, if available */
	name: string | ITranslatableMessage
	/** Hint that all actions of this trigger are adLibs */
	adLibOnly: boolean
}

export const MountedGenericTriggers = new Mongo.Collection<MountedGenericTrigger>(null)

export function isMountedAdLibTrigger(
	mountedTrigger: MountedAdLibTrigger | MountedGenericTrigger
): mountedTrigger is MountedAdLibTrigger {
	return !!mountedTrigger['targetId']
}

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
 * This is a component that handles all Client-side triggers for Action Triggers.
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
	const createdActions = useRef<Map<TriggeredActionId, (e) => void>>(new Map())

	function bindHotkey(id: TriggeredActionId, keys: string, up: boolean, action: HotkeyTriggerListener) {
		try {
			localSorensen.bind(keys, action, {
				up,
				exclusive: true,
				ordered: 'modifiersFirst',
				preventDefaultPartials: false,
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

	function triggerAction(e: TriggerActionEvent) {
		const listener = createdActions.current.get(e.actionId)
		if (listener) {
			listener(e.context)
		}
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
		localSorensen.poison() // cancels all pressed keys, poisons all chords, no hotkey trigger will execute
	}

	useEffect(() => {
		const fKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F12'] // not 'F11', because people use that apparently
		const ctrlDigitKeys = [
			// Ctrl+DigitX is a shortcut for switching Tabs in some browsers
			'Digit1',
			'Digit2',
			'Digit3',
			'Digit4',
			'Digit5',
			'Digit6',
			'Digit7',
			'Digit8',
			'Digit9',
			'Digit0',
		]

		if (initialized) {
			localSorensen.bind('Escape', poisonHotkeys, {
				exclusive: false,
				global: true,
			})

			// block Control+KeyF only if this is running in a context where other key bindings will be bound
			if (!props.simulateTriggerBinding) {
				localSorensen.bind('Control+KeyF', preventDefault, {
					global: true,
					exclusive: true,
					ordered: 'modifiersFirst',
					preventDefaultPartials: false,
				})
				localSorensen.bind('Control+F5', preventDefault, {
					global: true,
					exclusive: true,
					ordered: false,
					preventDefaultPartials: false,
				})
				localSorensen.bind(['Enter', 'NumpadEnter'], preventDefault, {
					global: false,
					exclusive: true,
				})
				fKeys.forEach((key) =>
					localSorensen.bind(key, preventDefault, {
						exclusive: false,
						global: true,
					})
				)
				ctrlDigitKeys.forEach((key) =>
					localSorensen.bind(`Control+${key}`, preventDefault, {
						exclusive: true,
						global: true,
						ordered: true,
						preventDefaultPartials: false,
					})
				)
			}
		}

		return () => {
			localSorensen.unbind('Escape', poisonHotkeys)
			localSorensen.unbind('Control+KeyF', preventDefault)
			localSorensen.unbind('Control+F5', preventDefault)
			localSorensen.unbind('Enter', preventDefault)
			localSorensen.unbind('NumpadEnter', preventDefault)
			fKeys.forEach((key) => localSorensen.unbind(key, preventDefault))
			ctrlDigitKeys.forEach((key) => localSorensen.unbind(`Control+${key}`, preventDefault))
		}
	}, [initialized]) // run once once Sorensen is initialized

	useEffect(() => {
		RundownViewEventBus.on(RundownViewEvents.TRIGGER_ACTION, triggerAction)
		return () => {
			RundownViewEventBus.removeListener(RundownViewEvents.TRIGGER_ACTION, triggerAction)
		}
	}, [])

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
				let context = rundownPlaylistContext.get()
				if (context === null) {
					context = {
						rundownPlaylistId: new ReactiveVar(playlist._id),
						rundownPlaylist: new ReactiveVar(playlist),
						currentRundownId: new ReactiveVar(props.currentRundownId),
						currentPartId: new ReactiveVar(props.currentPartId),
						nextPartId: new ReactiveVar(props.nextPartId),
						currentSegmentPartIds: new ReactiveVar(props.currentSegmentPartIds),
						nextSegmentPartIds: new ReactiveVar(props.nextSegmentPartIds),
					}
					rundownPlaylistContext.set(context)
				} else {
					context.rundownPlaylistId.set(playlist._id)
					context.rundownPlaylist.set(playlist)
					context.currentRundownId.set(props.currentRundownId)
					context.currentPartId.set(props.currentPartId)
					context.nextPartId.set(props.nextPartId)
					context.currentSegmentPartIds.set(props.currentSegmentPartIds)
					context.nextSegmentPartIds.set(props.nextSegmentPartIds)
				}
			}
		})
	}, [
		props.rundownPlaylistId,
		props.currentRundownId,
		props.currentPartId,
		JSON.stringify(props.currentSegmentPartIds),
		props.nextPartId,
		JSON.stringify(props.nextSegmentPartIds),
	])

	const triggerSubReady = useSubscription(PubSub.triggeredActions, {
		showStyleBase: {
			$in: [null, props.showStyleBaseId],
		},
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
				showStyleBaseId: {
					$in: [null, props.showStyleBaseId],
				},
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

		createdActions.current = new Map()
		const previewAutoruns: Tracker.Computation[] = []

		triggeredActions.forEach((pair) => {
			const action = createAction(pair._id, pair.actions, showStyleBase, t, getCurrentContext)
			if (!props.simulateTriggerBinding) {
				createdActions.current.set(pair._id, action.listener)
				pair.triggers.forEach((trigger) => {
					if (trigger.type === TriggerType.hotkey) {
						bindHotkey(pair._id, trigger.keys, !!trigger.up, action.listener)
					}
				})
			}

			if (pair.name) {
				const triggers = pair.triggers.filter((trigger) => trigger.type === TriggerType.hotkey)
				const genericTriggerId = protectString(`${pair._id}`)
				const keys = triggers.map((trigger) => trigger.keys)
				const finalKeys = keys.map((key) => getFinalKey(key))
				const adLibOnly = pair.actions.every((action) => action.action === PlayoutActions.adlib)
				MountedGenericTriggers.upsert(genericTriggerId, {
					$set: {
						_id: genericTriggerId,
						_rank: pair._rank,
						triggeredActionId: pair._id,
						keys,
						finalKeys,
						name: pair.name,
						adLibOnly,
					},
				})
			}

			const hotkeyTriggers = pair.triggers
				.filter((trigger) => trigger.type === TriggerType.hotkey)
				.map((trigger) => trigger.keys)

			const finalKeys = hotkeyTriggers.map((key) => getFinalKey(key))

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
								finalKeys,
								name: pair.name,
								targetName: adLib.label,
								sourceLayerId: adLib.sourceLayerId,
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
					const actionListener = createdActions.current.get(pair._id)
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
