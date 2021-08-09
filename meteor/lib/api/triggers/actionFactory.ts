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
import { PartInstances } from '../../collections/PartInstances'
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

// as described in this issue: https://github.com/Microsoft/TypeScript/issues/14094
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
// eslint-disable-next-line @typescript-eslint/ban-types
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

export type ActionContext = XOR<
	{
		rundownPlaylist: RundownPlaylist
		currentSegmentPartIds: PartId[]
		nextSegmentPartIds: PartId[]
		currentPartId: PartId | null
		nextPartId: PartId | null
	},
	{
		studio: Studio
		showStyleBase: ShowStyleBase
	}
>

type ActionExecutor = (t: TFunction, e: any, ctx: ActionContext) => void

interface ExecutableAction {
	action: ITriggeredActionBase['action']
	execute: ActionExecutor
}

interface PreviewableAction extends ExecutableAction {
	preview: (ctx: ActionContext) => IWrappedAdLib[]
}

interface ExecutableAdLibAction extends PreviewableAction {
	action: PlayoutActions.adlib
}

export function isPreviewableAction(action: ExecutableAction): action is PreviewableAction {
	return action.action && typeof action['preview'] === 'function'
}

interface InternalActionContext {
	rundownPlaylistId: RundownPlaylistId
	rundownPlaylist: RundownPlaylist
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]
	currentPartId: PartId | null
	nextPartId: PartId | null
}

function createRundownPlaylistContext(
	context: ActionContext,
	filterChain: IBaseFilterLink[]
): InternalActionContext | undefined {
	if (filterChain[0].object === 'view' && context.rundownPlaylist) {
		return {
			rundownPlaylistId: context.rundownPlaylist._id,
			rundownPlaylist: context.rundownPlaylist,
			currentPartId: context.currentPartId,
			nextPartId: context.nextPartId,
			currentSegmentPartIds: context.currentSegmentPartIds,
			nextSegmentPartIds: context.nextSegmentPartIds,
		}
	} else if (filterChain[0].object === 'rundownPlaylist' && context.studio && Meteor.isServer) {
		const playlist = rundownPlaylistFilter(
			context.studio._id,
			filterChain.filter((link) => link.object === 'rundownPlaylist') as IRundownPlaylistFilterLink[]
		)

		if (playlist) {
			let currentPartId: PartId | null = null,
				nextPartId: PartId | null = null,
				currentSegmentPartIds: PartId[] = [],
				nextSegmentPartIds: PartId[] = []

			if (playlist.currentPartInstanceId) {
				const currentPart = PartInstances.findOne(playlist.currentPartInstanceId)?.part ?? null
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
				rundownPlaylistId: playlist?._id,
				rundownPlaylist: playlist,
				currentPartId,
				currentSegmentPartIds,
				nextPartId,
				nextSegmentPartIds,
			}
		}
	} else {
		throw new Meteor.Error(501, 'Invalid filter combination')
	}
}

function createAdLibAction(filterChain: AdLibFilterChainLink[], showStyleBase: ShowStyleBase): ExecutableAdLibAction {
	const compiledAdLibFilter = compileAdLibFilter(filterChain, showStyleBase)

	return {
		action: PlayoutActions.adlib,
		preview: (ctx) => {
			const innerCtx = createRundownPlaylistContext(ctx, filterChain)

			if (innerCtx) {
				return compiledAdLibFilter(
					innerCtx.rundownPlaylistId,
					innerCtx.currentSegmentPartIds || [],
					innerCtx.nextSegmentPartIds || [],
					innerCtx.currentPartId || null,
					innerCtx.nextPartId || null
				)
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
			const currentPartInstanceId = innerCtx.rundownPlaylist.currentPartInstanceId

			const sourceLayerIdsToClear: string[] = []
			Tracker.nonreactive(() =>
				compiledAdLibFilter(
					innerCtx.rundownPlaylistId,
					innerCtx.currentSegmentPartIds || [],
					innerCtx.nextSegmentPartIds || [],
					innerCtx.currentPartId || null,
					innerCtx.nextPartId || null
				)
			).forEach((wrappedAdLib) => {
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
									innerCtx.rundownPlaylistId,
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
									innerCtx.rundownPlaylistId,
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
								innerCtx.rundownPlaylistId,
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
								innerCtx.rundownPlaylistId,
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
								innerCtx.rundownPlaylistId,
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
						innerCtx.rundownPlaylistId,
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

function createUserActionWithCtx(
	action: SomeAction,
	userAction: UserAction,
	userActionExec: (e: string, ctx: InternalActionContext) => Promise<ClientAPI.ClientResponse<any>>
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

export function createAction(action: SomeAction, showStyleBase: ShowStyleBase): ExecutableAction {
	switch (action.action) {
		case ClientActions.shelf:
			return createShelfAction(action.filterChain, action.state)
		case PlayoutActions.adlib:
			return createAdLibAction(action.filterChain, showStyleBase)
		case PlayoutActions.activateRundownPlaylist:
			return createUserActionWithCtx(action, UserAction.ACTIVATE_RUNDOWN_PLAYLIST, async (e, ctx) =>
				MeteorCall.userAction.activate(e, ctx.rundownPlaylistId, !!action.rehearsal || false)
			)
		case PlayoutActions.deactivateRundownPlaylist:
			return createUserActionWithCtx(action, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, async (e, ctx) =>
				MeteorCall.userAction.deactivate(e, ctx.rundownPlaylistId)
			)
		case PlayoutActions.take:
			return createUserActionWithCtx(action, UserAction.TAKE, async (e, ctx) =>
				MeteorCall.userAction.take(e, ctx.rundownPlaylistId)
			)
		case PlayoutActions.hold:
			return createUserActionWithCtx(action, UserAction.ACTIVATE_HOLD, async (e, ctx) =>
				MeteorCall.userAction.activateHold(e, ctx.rundownPlaylistId, !!action.undo)
			)
		case PlayoutActions.disableNextPiece:
			return createUserActionWithCtx(action, UserAction.DISABLE_NEXT_PIECE, async (e, ctx) =>
				MeteorCall.userAction.disableNextPiece(e, ctx.rundownPlaylistId, !!action.undo)
			)
		case PlayoutActions.createSnapshotForDebug:
			return createUserActionWithCtx(action, UserAction.CREATE_SNAPSHOT_FOR_DEBUG, async (e, ctx) =>
				MeteorCall.userAction.storeRundownSnapshot(e, ctx.rundownPlaylistId, `action`)
			)
		case PlayoutActions.moveNext:
			return createUserActionWithCtx(action, UserAction.MOVE_NEXT, async (e, ctx) =>
				MeteorCall.userAction.moveNext(e, ctx.rundownPlaylistId, action.parts, action.segments)
			)
		case PlayoutActions.reloadRundownPlaylistData:
			return createUserActionWithCtx(action, UserAction.RELOAD_RUNDOWN_PLAYLIST_DATA, async (e, ctx) =>
				// TODO: Needs some handling of the response. Perhaps this should switch to
				// an event on the RundownViewEventBus, if ran on the client?
				MeteorCall.userAction.resyncRundownPlaylist(e, ctx.rundownPlaylistId)
			)
		case PlayoutActions.resetRundownPlaylist:
			return createUserActionWithCtx(action, UserAction.RESET_RUNDOWN_PLAYLIST, async (e, ctx) =>
				MeteorCall.userAction.resetRundownPlaylist(e, ctx.rundownPlaylistId)
			)
		// TODO: turn this on, once all actions are implemented
		default:
			assertNever(action)
			break
	}

	// return a NO-OP, if not recognized
	return {
		// @ts-ignore action.action is "never", based on TypeScript rules, but if input doesn't folllow them,
		// it can actually exist
		action: action.action,
		execute: () => {},
	}
}
