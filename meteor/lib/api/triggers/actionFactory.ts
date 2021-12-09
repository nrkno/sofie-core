import {
	ClientActions,
	IBaseFilterLink,
	IGUIContextFilterLink,
	IRundownPlaylistFilterLink,
	ITriggeredActionBase,
	PlayoutActions,
	SomeAction,
} from '@sofie-automation/blueprints-integration'
import { TFunction } from 'i18next'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { MeteorCall } from '../methods'
import { PartInstance, PartInstances } from '../../collections/PartInstances'
import { PartId, Parts } from '../../collections/Parts'
import { RundownPlaylist, RundownPlaylistId } from '../../collections/RundownPlaylists'
import { ShowStyleBase } from '../../collections/ShowStyleBases'
import { Studio } from '../../collections/Studios'
import { assertNever } from '../../lib'
import { logger } from '../../logging'
import RundownViewEventBus, { RundownViewEvents } from '../../../client/ui/RundownView/RundownViewEventBus'
import { UserAction } from '../../userAction'
import { doUserAction } from './universalDoUserActionAdapter'
import {
	AdLibFilterChainLink,
	compileAdLibFilter,
	rundownPlaylistFilter,
	IWrappedAdLib,
} from './actionFilterChainCompilers'
import { ClientAPI } from '../client'
import { RundownId, Rundowns } from '../../collections/Rundowns'
import { ReactiveVar } from 'meteor/reactive-var'

// as described in this issue: https://github.com/Microsoft/TypeScript/issues/14094
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
// eslint-disable-next-line @typescript-eslint/ban-types
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

class DummyReactiveVar<T> implements ReactiveVar<T> {
	constructor(private value: T) {}
	public get(): T {
		return this.value
	}
	public set(newValue: T): void {
		this.value = newValue
	}
}

export interface ReactivePlaylistActionContext {
	rundownPlaylistId: ReactiveVar<RundownPlaylistId>
	rundownPlaylist: ReactiveVar<RundownPlaylist>
	currentRundownId: ReactiveVar<RundownId | null>
	currentSegmentPartIds: ReactiveVar<PartId[]>
	nextSegmentPartIds: ReactiveVar<PartId[]>
	currentPartId: ReactiveVar<PartId | null>
	nextPartId: ReactiveVar<PartId | null>
}

interface PlainPlaylistContext {
	rundownPlaylist: RundownPlaylist
	currentRundownId: RundownId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]
	currentPartId: PartId | null
	nextPartId: PartId | null
}

interface PlainStudioContext {
	studio: Studio
	showStyleBase: ShowStyleBase
}

type PlainActionContext = XOR<PlainPlaylistContext, PlainStudioContext>

export type ActionContext = XOR<ReactivePlaylistActionContext, PlainActionContext>

type ActionExecutor = (t: TFunction, e: any, ctx: ActionContext) => void

/**
 * An action compiled down to a single function that can be executed
 *
 * @interface ExecutableAction
 */
interface ExecutableAction {
	action: ITriggeredActionBase['action']
	/** Execute the action */
	execute: ActionExecutor
}

/**
 * Optionally, the ExecutableAction can support a preview. Currently this is only implemented for AdLib actions.
 * This will then return a list of the targeted AdLibs using the normalized form of `IWrappedAdLib`
 *
 * @interface PreviewableAction
 * @extends {ExecutableAction}
 */
interface PreviewableAction extends ExecutableAction {
	preview: (ctx: ReactivePlaylistActionContext) => IWrappedAdLib[]
}

interface ExecutableAdLibAction extends PreviewableAction {
	action: PlayoutActions.adlib
}

export function isPreviewableAction(action: ExecutableAction): action is PreviewableAction {
	return action.action && typeof action['preview'] === 'function'
}

function createRundownPlaylistContext(
	context: ActionContext,
	filterChain: IBaseFilterLink[]
): ReactivePlaylistActionContext | undefined {
	if (filterChain[0].object === 'view' && context.rundownPlaylistId) {
		return context as ReactivePlaylistActionContext
	} else if (filterChain[0].object === 'view' && context.rundownPlaylist) {
		const playlistContext = context as PlainPlaylistContext
		return {
			rundownPlaylistId: new DummyReactiveVar(playlistContext.rundownPlaylist._id),
			rundownPlaylist: new DummyReactiveVar(playlistContext.rundownPlaylist),
			currentRundownId: new DummyReactiveVar(playlistContext.currentRundownId),
			currentPartId: new DummyReactiveVar(playlistContext.currentPartId),
			nextPartId: new DummyReactiveVar(playlistContext.nextPartId),
			currentSegmentPartIds: new DummyReactiveVar(playlistContext.currentSegmentPartIds),
			nextSegmentPartIds: new DummyReactiveVar(playlistContext.nextSegmentPartIds),
		}
	} else if (filterChain[0].object === 'rundownPlaylist' && context.studio && Meteor.isServer) {
		const playlist = rundownPlaylistFilter(
			context.studio._id,
			filterChain.filter((link) => link.object === 'rundownPlaylist') as IRundownPlaylistFilterLink[]
		)

		if (playlist) {
			let currentPartId: PartId | null = null,
				nextPartId: PartId | null = null,
				currentPartInstance: PartInstance | null = null,
				currentSegmentPartIds: PartId[] = [],
				nextSegmentPartIds: PartId[] = []

			if (playlist.currentPartInstanceId) {
				currentPartInstance = PartInstances.findOne(playlist.currentPartInstanceId) ?? null
				const currentPart = currentPartInstance?.part ?? null
				if (currentPart) {
					currentPartId = currentPart._id
					currentSegmentPartIds = Parts.find({
						segmentId: currentPart.segmentId,
					}).map((part) => part._id)
				}
			}
			if (playlist.nextPartInstanceId) {
				const nextPart = PartInstances.findOne(playlist.nextPartInstanceId)?.part ?? null
				if (nextPart) {
					nextPartId = nextPart._id
					nextSegmentPartIds = Parts.find({
						segmentId: nextPart.segmentId,
					}).map((part) => part._id)
				}
			}

			return {
				rundownPlaylistId: new DummyReactiveVar(playlist?._id),
				rundownPlaylist: new DummyReactiveVar(playlist),
				currentRundownId: new DummyReactiveVar(
					currentPartInstance?.rundownId ??
						Rundowns.findOne(
							{
								playlistId: playlist._id,
							},
							{
								sort: {
									_rank: 1,
								},
							}
						)?._id ??
						null
				),
				currentPartId: new DummyReactiveVar(currentPartId),
				currentSegmentPartIds: new DummyReactiveVar(currentSegmentPartIds),
				nextPartId: new DummyReactiveVar(nextPartId),
				nextSegmentPartIds: new DummyReactiveVar(nextSegmentPartIds),
			}
		}
	} else {
		throw new Meteor.Error(501, 'Invalid filter combination')
	}
}

/**
 * The big one. This compiles the AdLib filter chain and then executes appropriate UserAction's, depending on a
 * particular AdLib type
 *
 * @param {AdLibFilterChainLink[]} filterChain
 * @param {ShowStyleBase} showStyleBase
 * @return {*}  {ExecutableAdLibAction}
 */
function createAdLibAction(filterChain: AdLibFilterChainLink[], showStyleBase: ShowStyleBase): ExecutableAdLibAction {
	const compiledAdLibFilter = compileAdLibFilter(filterChain, showStyleBase)

	return {
		action: PlayoutActions.adlib,
		preview: (ctx) => {
			const innerCtx = createRundownPlaylistContext(ctx, filterChain)

			if (innerCtx) {
				try {
					return compiledAdLibFilter(innerCtx)
				} catch (e) {
					logger.error(e)
					return []
				}
			} else {
				return []
			}
		},
		execute: (t, e, ctx) => {
			const innerCtx = createRundownPlaylistContext(ctx, filterChain)

			if (!innerCtx) {
				logger.warn(`Could not create RundownPlaylist context for executable AdLib Action`, filterChain)
				return
			}
			const currentPartInstanceId = innerCtx.rundownPlaylist.get().currentPartInstanceId

			const sourceLayerIdsToClear: string[] = []
			Tracker.nonreactive(() => compiledAdLibFilter(innerCtx)).forEach((wrappedAdLib) => {
				switch (wrappedAdLib.type) {
					case 'adLibPiece':
						doUserAction(
							t,
							e,
							UserAction.START_ADLIB,
							async (e) =>
								currentPartInstanceId &&
								MeteorCall.userAction.segmentAdLibPieceStart(
									e,
									innerCtx.rundownPlaylistId.get(),
									currentPartInstanceId,
									wrappedAdLib.item._id,
									false
								)
						)
						break
					case 'rundownBaselineAdLibItem':
						doUserAction(
							t,
							e,
							UserAction.START_GLOBAL_ADLIB,
							async (e) =>
								currentPartInstanceId &&
								MeteorCall.userAction.baselineAdLibPieceStart(
									e,
									innerCtx.rundownPlaylistId.get(),
									currentPartInstanceId,
									wrappedAdLib.item._id,
									false
								)
						)
						break
					case 'adLibAction':
						doUserAction(t, e, UserAction.START_ADLIB, async (e) =>
							MeteorCall.userAction.executeAction(
								e,
								innerCtx.rundownPlaylistId.get(),
								wrappedAdLib._id,
								wrappedAdLib.item.actionId,
								wrappedAdLib.item.userData,
								undefined
							)
						)
						break
					case 'rundownBaselineAdLibAction':
						doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, async (e) =>
							MeteorCall.userAction.executeAction(
								e,
								innerCtx.rundownPlaylistId.get(),
								wrappedAdLib._id,
								wrappedAdLib.item.actionId,
								wrappedAdLib.item.userData,
								undefined
							)
						)
						break
					case 'clearSourceLayer':
						// defer this action to send a single clear action all at once
						sourceLayerIdsToClear.push(wrappedAdLib.sourceLayerId)
						break
					case 'sticky':
						doUserAction(t, e, UserAction.START_STICKY_PIECE, async (e) =>
							MeteorCall.userAction.sourceLayerStickyPieceStart(
								e,
								innerCtx.rundownPlaylistId.get(),
								wrappedAdLib.sourceLayerId //
							)
						)
						break
					default:
						assertNever(wrappedAdLib)
						return
				}
			})

			if (currentPartInstanceId && sourceLayerIdsToClear.length > 0) {
				doUserAction(t, e, UserAction.CLEAR_SOURCELAYER, async (e) =>
					MeteorCall.userAction.sourceLayerOnPartStop(
						e,
						innerCtx.rundownPlaylistId.get(),
						currentPartInstanceId,
						sourceLayerIdsToClear
					)
				)
			}
		},
	}
}

function createShelfAction(filterChain: IGUIContextFilterLink[], state: boolean | 'toggle'): ExecutableAction {
	return {
		action: ClientActions.shelf,
		execute: () => {
			RundownViewEventBus.emit(RundownViewEvents.SHELF_STATE, {
				state,
			})
		},
	}
}

function createMiniShelfQueueAdLibAction(_filterChain: IGUIContextFilterLink[], forward: boolean): ExecutableAction {
	return {
		action: ClientActions.miniShelfQueueAdLib,
		execute: () => {
			RundownViewEventBus.emit(RundownViewEvents.MINI_SHELF_QUEUE_ADLIB, {
				forward,
			})
		},
	}
}

function createGoToOnAirLineAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: ClientActions.goToOnAirLine,
		execute: () => {
			RundownViewEventBus.emit(RundownViewEvents.GO_TO_LIVE_SEGMENT)
		},
	}
}

function createRewindSegmentsAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: ClientActions.rewindSegments,
		execute: () => {
			RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
		},
	}
}

function createRundownPlaylistSoftTakeAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: PlayoutActions.take,
		execute: (t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.TAKE, {
				context: e,
			})
		},
	}
}

function createRundownPlaylistSoftActivateAction(
	_filterChain: IGUIContextFilterLink[],
	rehearsal: boolean
): ExecutableAction {
	return {
		action: PlayoutActions.activateRundownPlaylist,
		execute: (t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST, {
				context: e,
				rehearsal,
			})
		},
	}
}

function createRundownPlaylistSoftResyncAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: PlayoutActions.resyncRundownPlaylist,
		execute: (t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST, {
				context: e,
			})
		},
	}
}

function createShowEntireCurrentSegmentAction(_filterChain: IGUIContextFilterLink[], on: boolean): ExecutableAction {
	return {
		action: ClientActions.showEntireCurrentSegment,
		execute: () => {
			if (on) {
				RundownViewEventBus.emit(RundownViewEvents.SEGMENT_ZOOM_ON)
			} else {
				RundownViewEventBus.emit(RundownViewEvents.SEGMENT_ZOOM_OFF)
			}
		},
	}
}

function createRundownPlaylistSoftResetRundownAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: PlayoutActions.resetRundownPlaylist,
		execute: (t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.RESET_RUNDOWN_PLAYLIST, {
				context: e,
			})
		},
	}
}

/**
 * A utility method to create an ExecutableAction wrapping a simple UserAction call that takes some variables from
 * InternalActionContext as input
 *
 * @param {SomeAction} action
 * @param {UserAction} userAction
 * @param {(e: string, ctx: InternalActionContext) => Promise<ClientAPI.ClientResponse<any>>} userActionExec
 * @return {*}  {ExecutableAction}
 */
function createUserActionWithCtx(
	action: SomeAction,
	userAction: UserAction,
	userActionExec: (e: string, ctx: ReactivePlaylistActionContext) => Promise<ClientAPI.ClientResponse<any>>
): ExecutableAction {
	return {
		action: action.action,
		execute: (t, e, ctx) => {
			const innerCtx = Tracker.nonreactive(() => createRundownPlaylistContext(ctx, action.filterChain))
			if (innerCtx) {
				doUserAction(t, e, userAction, async (e) => userActionExec(e, innerCtx))
			}
		},
	}
}

/**
 * This is a factory method to create the ExecutableAction from a SomeAction-type description
 * @param action
 * @param showStyleBase
 * @returns
 */
export function createAction(action: SomeAction, showStyleBase: ShowStyleBase): ExecutableAction {
	switch (action.action) {
		case ClientActions.shelf:
			return createShelfAction(action.filterChain, action.state)
		case ClientActions.goToOnAirLine:
			return createGoToOnAirLineAction(action.filterChain)
		case ClientActions.rewindSegments:
			return createRewindSegmentsAction(action.filterChain)
		case PlayoutActions.adlib:
			return createAdLibAction(action.filterChain, showStyleBase)
		case PlayoutActions.activateRundownPlaylist:
			if (action.force) {
				return createUserActionWithCtx(action, UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST, async (e, ctx) =>
					MeteorCall.userAction.forceResetAndActivate(
						e,
						ctx.rundownPlaylistId.get(),
						!!action.rehearsal || false
					)
				)
			} else {
				if (Meteor.isClient && action.filterChain.every((link) => link.object === 'view')) {
					return createRundownPlaylistSoftActivateAction(
						action.filterChain as IGUIContextFilterLink[],
						!!action.rehearsal
					)
				} else {
					return createUserActionWithCtx(action, UserAction.ACTIVATE_RUNDOWN_PLAYLIST, async (e, ctx) =>
						MeteorCall.userAction.activate(e, ctx.rundownPlaylistId.get(), !!action.rehearsal || false)
					)
				}
			}
		case PlayoutActions.deactivateRundownPlaylist:
			return createUserActionWithCtx(action, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, async (e, ctx) =>
				MeteorCall.userAction.deactivate(e, ctx.rundownPlaylistId.get())
			)
		case PlayoutActions.take:
			if (Meteor.isClient && action.filterChain.every((link) => link.object === 'view')) {
				return createRundownPlaylistSoftTakeAction(action.filterChain as IGUIContextFilterLink[])
			} else {
				return createUserActionWithCtx(action, UserAction.TAKE, async (e, ctx) =>
					MeteorCall.userAction.take(e, ctx.rundownPlaylistId.get())
				)
			}
		case PlayoutActions.hold:
			return createUserActionWithCtx(action, UserAction.ACTIVATE_HOLD, async (e, ctx) =>
				MeteorCall.userAction.activateHold(e, ctx.rundownPlaylistId.get(), !!action.undo)
			)
		case PlayoutActions.disableNextPiece:
			return createUserActionWithCtx(action, UserAction.DISABLE_NEXT_PIECE, async (e, ctx) =>
				MeteorCall.userAction.disableNextPiece(e, ctx.rundownPlaylistId.get(), !!action.undo)
			)
		case PlayoutActions.createSnapshotForDebug:
			return createUserActionWithCtx(action, UserAction.CREATE_SNAPSHOT_FOR_DEBUG, async (e, ctx) =>
				MeteorCall.userAction.storeRundownSnapshot(e, ctx.rundownPlaylistId.get(), `action`)
			)
		case PlayoutActions.moveNext:
			return createUserActionWithCtx(action, UserAction.MOVE_NEXT, async (e, ctx) =>
				MeteorCall.userAction.moveNext(e, ctx.rundownPlaylistId.get(), action.parts ?? 0, action.segments ?? 0)
			)
		case PlayoutActions.reloadRundownPlaylistData:
			if (Meteor.isClient && action.filterChain.every((link) => link.object === 'view')) {
				return createRundownPlaylistSoftResyncAction(action.filterChain as IGUIContextFilterLink[])
			} else {
				return createUserActionWithCtx(action, UserAction.RELOAD_RUNDOWN_PLAYLIST_DATA, async (e, ctx) =>
					// TODO: Needs some handling of the response. Perhaps this should switch to
					// an event on the RundownViewEventBus, if ran on the client?
					MeteorCall.userAction.resyncRundownPlaylist(e, ctx.rundownPlaylistId.get())
				)
			}
		case PlayoutActions.resetRundownPlaylist:
			if (Meteor.isClient && action.filterChain.every((link) => link.object === 'view')) {
				return createRundownPlaylistSoftResetRundownAction(action.filterChain as IGUIContextFilterLink[])
			} else {
				return createUserActionWithCtx(action, UserAction.RESET_RUNDOWN_PLAYLIST, async (e, ctx) =>
					MeteorCall.userAction.resetRundownPlaylist(e, ctx.rundownPlaylistId.get())
				)
			}
		case PlayoutActions.resyncRundownPlaylist:
			return createUserActionWithCtx(action, UserAction.RESYNC_RUNDOWN_PLAYLIST, async (e, ctx) =>
				MeteorCall.userAction.resyncRundownPlaylist(e, ctx.rundownPlaylistId.get())
			)
		case ClientActions.showEntireCurrentSegment:
			return createShowEntireCurrentSegmentAction(action.filterChain, action.on)
		case ClientActions.miniShelfQueueAdLib:
			return createMiniShelfQueueAdLibAction(action.filterChain, action.forward)
		default:
			assertNever(action)
			break
	}

	// return a NO-OP, if not recognized
	return {
		// @ts-ignore action.action is "never", based on TypeScript rules, but if input doesn't folllow them,
		// it can actually exist
		action: action.action,
		execute: () => {
			// Nothing
		},
	}
}
