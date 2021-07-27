import { SourceLayerType } from './content'

export enum TriggerType {
	hotkey = 'hotkey',
}

/**
 * An abstract description of a trigger mechanism that can be used to trigger events
 *
 * @export
 * @interface ITrigger
 */
export interface IBlueprintTrigger {
	// type of a trigger (keyboard hotkey, GPI, MIDI, OSC, etc.)
	type: TriggerType
}

/**
 * A hotkey trigger is a trigger local to the current client and as such, it should only be used with
 * filter chains containing `IGUIContextFilterLink`
 *
 * @export
 * @interface IBlueprintHotkeyTrigger
 * @extends {IBlueprintTrigger}
 */
export interface IBlueprintHotkeyTrigger extends IBlueprintTrigger {
	type: TriggerType.hotkey

	/**
	 * a "+" and space concatenated list of KeyboardEvent.key key values (see: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values),
	 * in order (order not significant for modifier keys), f.g. "Control+Shift+KeyA", "Control+Shift+KeyB KeyU".
	 * "Control" means "either ControlLeft or ControlRight", same for "Shift" and "Alt"
	 * Spaces indicate chord sequences.
	 */
	keys: string

	/**
	 * If enabled, actions will happen on keyUp, as opposed to keyDown
	 *
	 * @type {boolean}
	 * @memberof IBlueprintHotkeyTrigger
	 */
	up?: boolean
}

export type SomeBlueprintTriggeer = IBlueprintHotkeyTrigger

export enum PlayoutActions {
	adlib = 'adlib',
	activateRundownPlaylist = 'activateRundownPlaylist',
	deactivateRundownPlaylist = 'deactivateRundownPlaylist',
	take = 'take',
	hold = 'hold',
	createSnapshotForDebug = 'createSnapshotForDebug',
	resyncRundownPlaylist = 'resyncRundownPlaylist',
	moveNext = 'moveNext',
	resetRundownPlaylist = 'resetRundownPlaylist',
	reloadRundownPlaylistData = 'reloadRundownPlaylistData',
	disableNextPiece = 'disableNextPiece',
}

export enum ClientActions {
	'shelf' = 'shelf',
	// 'moveAdLibFocus' = 'moveAdLibFocus' // TV2 is working on a feature with "focusable ad libs"
}

export interface ITriggeredActionBase {
	action: PlayoutActions | ClientActions
	filterChain: IBaseFilterLink[]
}

export interface IBaseFilterLink {
	object: string
}

export type IRundownPlaylistFilterLink =
	| {
			object: 'rundownPlaylist'
			field: 'activeId'
			value: boolean
	  }
	| {
			object: 'rundownPlaylist'
			field: 'studioId'
			value: string
	  }

export type IGUIContextFilterLink = {
	object: 'view'
}

export type IAdLibFilterLink =
	| {
			object: 'adLib'
			field: 'sourceLayerId' | 'outputLayerId' | 'tag' | 'label'
			value: string[]
	  }
	| {
			object: 'adLib'
			field: 'pick' | 'pickEnd' | 'limit'
			value: number
	  }
	| {
			object: 'adlib'
			field: 'global' // | 'focused' // as above stated, eventually allowing to select the "focused" adlib
			value: boolean
	  }
	| {
			object: 'adlib'
			field: 'sourceLayerType'
			value: SourceLayerType[]
	  }
	| {
			object: 'adlib'
			field: 'type'
			value: 'adlib' | 'adlibAction' | 'clear'
	  }

export interface IAdlibPlayoutAction extends ITriggeredActionBase {
	action: PlayoutActions.adlib
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink | IAdLibFilterLink)[]
}

export interface IRundownPlaylistActivateAction extends ITriggeredActionBase {
	action: PlayoutActions.activateRundownPlaylist
	rehearsal: boolean
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IRundownPlaylistDeactivateAction extends ITriggeredActionBase {
	action: PlayoutActions.deactivateRundownPlaylist
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface ITakeAction extends ITriggeredActionBase {
	action: PlayoutActions.take
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IHoldAction extends ITriggeredActionBase {
	action: PlayoutActions.hold
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IMoveNextAction extends ITriggeredActionBase {
	action: PlayoutActions.moveNext
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]

	/**
	 * "Vertical delta" - the next Part will be moved to the beginning of the specified segment
	 *
	 * @type {number}
	 * @memberof IMoveNextAction
	 */
	segments: number
	/**
	 * "Horizontal delta" - the next Part will be moved by this amount within the selected segment
	 *
	 * @type {number}
	 * @memberof IMoveNextAction
	 */
	parts: number
}

export interface ICreateSnapshotForDebugAction extends ITriggeredActionBase {
	action: PlayoutActions.createSnapshotForDebug
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IDisableNextPieceAction extends ITriggeredActionBase {
	action: PlayoutActions.disableNextPiece
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IRundownPlaylistReloadDataAction extends ITriggeredActionBase {
	action: PlayoutActions.reloadRundownPlaylistData
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IRundownPlaylistResetAction extends ITriggeredActionBase {
	action: PlayoutActions.resetRundownPlaylist
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IShelfAction extends ITriggeredActionBase {
	action: ClientActions.shelf
	state: true | false | 'toggle'
	filterChain: IGUIContextFilterLink[]
}

export type SomeAction =
	| IAdlibPlayoutAction
	| IRundownPlaylistActivateAction
	| IRundownPlaylistDeactivateAction
	| ITakeAction
	| IHoldAction
	| IMoveNextAction
	| ICreateSnapshotForDebugAction
	| IDisableNextPieceAction
	| IRundownPlaylistReloadDataAction
	| IRundownPlaylistResetAction
	| IShelfAction

export interface IBlueprintTriggeredActions {
	_id: string
	/** Optional label to specify what this triggered action is supposed to do, a comment basically */
	name?: string
	/** A list of triggers that will make the list of actions in `.actions` happen */
	triggers: SomeBlueprintTriggeer[]
	/** A list of actions to execute */
	actions: SomeAction[]
}
