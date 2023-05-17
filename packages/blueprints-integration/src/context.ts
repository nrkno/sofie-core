import { DatastorePersistenceMode, Time } from './common'
import { IBlueprintExternalMessageQueueObj } from './message'
import { PackageInfo } from './packageInfo'
import {
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IBlueprintRundownPlaylist,
	IBlueprintSegmentDB,
	IBlueprintSegmentRundown,
} from './rundown'
import { BlueprintMappings } from './studio'
import { TSR, OnGenerateTimelineObj } from './timeline'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { IBlueprintPlayoutDevice } from './lib'

/** Common */

export interface ICommonContext {
	/**
	 * Hash a string. Will return a unique string, to be used for all _id:s that are to be inserted in database
	 * @param originString A representation of the origin of the hash (for logging)
	 * @param originIsNotUnique If the originString is not guaranteed to be unique, set this to true
	 */
	getHashId: (originString: string, originIsNotUnique?: boolean) => string
	/** Un-hash, is return the string that created the hash */
	unhashId: (hash: string) => string

	/** Log a message to the sofie log with level 'debug' */
	logDebug: (message: string) => void
	/** Log a message to the sofie log with level 'info' */
	logInfo: (message: string) => void
	/** Log a message to the sofie log with level 'warn' */
	logWarning: (message: string) => void
	/** Log a message to the sofie log with level 'error' */
	logError: (message: string) => void
}

export function isCommonContext(obj: unknown): obj is ICommonContext {
	if (!obj || typeof obj !== 'object') {
		return false
	}

	const { getHashId, unhashId, logDebug, logInfo, logWarning, logError } = obj as ICommonContext

	return (
		typeof getHashId === 'function' &&
		typeof unhashId === 'function' &&
		typeof logDebug === 'function' &&
		typeof logInfo === 'function' &&
		typeof logWarning === 'function' &&
		typeof logError === 'function'
	)
}

export interface IUserNotesContext extends ICommonContext {
	/** Display a notification to the user of an error */
	notifyUserError(message: string, params?: { [key: string]: any }): void
	/** Display a notification to the user of an warning */
	notifyUserWarning(message: string, params?: { [key: string]: any }): void
	/** Display a notification to the user of a note */
	notifyUserInfo(message: string, params?: { [key: string]: any }): void
}

export function isUserNotesContext(obj: unknown): obj is IUserNotesContext {
	if (!isCommonContext(obj)) {
		return false
	}

	// eslint-disable-next-line @typescript-eslint/unbound-method
	const { notifyUserError, notifyUserWarning, notifyUserInfo } = obj as IUserNotesContext

	return (
		typeof notifyUserError === 'function' &&
		typeof notifyUserWarning === 'function' &&
		typeof notifyUserInfo === 'function'
	)
}

/** Studio */

export interface IStudioContext extends ICommonContext {
	/** The id of the studio */
	readonly studioId: string

	/** Returns the Studio blueprint config. If StudioBlueprintManifest.preprocessConfig is provided, a config preprocessed by that function is returned, otherwise it is returned unprocessed */
	getStudioConfig: () => unknown
	/** Returns a reference to a studio config value, that can later be resolved in Core */
	getStudioConfigRef(configKey: string): string

	/** Get the mappings for the studio */
	getStudioMappings: () => Readonly<BlueprintMappings>
}

export interface IPackageInfoContext {
	/**
	 * Get the PackageInfo items for an ExpectedPackage, if any have been reported by the package manager.
	 * Only info for packages with the `listenToPackageInfoUpdates` property set to true can be returned.
	 * The possible packageIds are scoped based on the ownership of the package.
	 * eg, baseline packages can be accessed when generating the baseline objects, piece/adlib packages can be access when regenerating the segment they are from
	 */
	getPackageInfo: (packageId: string) => Readonly<PackageInfo.Any[]>
	hackGetMediaObjectDuration: (mediaId: string) => Promise<number | undefined>
}

export interface IStudioBaselineContext extends IStudioContext, IPackageInfoContext {}

export interface IStudioUserContext extends IUserNotesContext, IStudioContext {}

/** Show Style Variant */

export interface IShowStyleContext extends ICommonContext, IStudioContext {
	/** Returns a ShowStyle blueprint config. If ShowStyleBlueprintManifest.preprocessConfig is provided, a config preprocessed by that function is returned, otherwise it is returned unprocessed */
	getShowStyleConfig: () => unknown
	/** Returns a reference to a showStyle config value, that can later be resolved in Core */
	getShowStyleConfigRef(configKey: string): string
}

export interface IShowStyleUserContext extends IUserNotesContext, IShowStyleContext, IPackageInfoContext {}

export interface IGetRundownContext extends IShowStyleUserContext {
	/** Returns a list of the Playlists in the studio */
	getPlaylists: () => Promise<Readonly<IBlueprintRundownPlaylist[]>>
	/** Returns the Playlist in which the Rundown currently is in. If it's a new Rundown, this will return undefined. */
	getCurrentPlaylist: () => Promise<Readonly<IBlueprintRundownPlaylist> | undefined>
	/** Returns a randomized string, intended to be used as ids. */
	getRandomId: () => string
}

/** Rundown */

export interface IRundownContext extends IShowStyleContext {
	readonly rundownId: string
	readonly playlistId: string
	readonly rundown: Readonly<IBlueprintSegmentRundown>
}

export interface IRundownUserContext extends IUserNotesContext, IRundownContext {}

export interface IRundownActivationContext extends IRundownContext {
	/** Execute an action on a certain PeripheralDevice */
	executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult>
	/** Returns a list of the PeripheralDevices */
	listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]>
}

export interface ISegmentUserContext extends IUserNotesContext, IRundownContext, IPackageInfoContext {
	/** Display a notification to the user of an error */
	notifyUserError: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of an warning */
	notifyUserWarning: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of a note */
	notifyUserInfo: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
}

/** Actions */
export interface IDataStoreActionExecutionContext extends IShowStyleUserContext, IEventContext {
	/**
	 * Setting a value in the datastore allows us to overwrite parts of a timeline content object with that value
	 * @param key Key to use when referencing from the timeline object
	 * @param value Value to overwrite the timeline object's content with
	 * @param mode In temporary mode the value may be removed when the key is no longer on the timeline
	 */
	setTimelineDatastoreValue(key: string, value: any, mode: DatastorePersistenceMode): Promise<void>
	/** Deletes a previously set value from the datastore */
	removeTimelineDatastoreValue(key: string): Promise<void>
}

export interface IActionExecutionContext
	extends IShowStyleUserContext,
		IEventContext,
		IDataStoreActionExecutionContext {
	/** Data fetching */
	// getIngestRundown(): IngestRundown // TODO - for which part?
	/** Get a PartInstance which can be modified */
	getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined>
	/** Get the PieceInstances for a modifiable PartInstance */
	getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]>
	/** Get the resolved PieceInstances for a modifiable PartInstance */
	getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]>
	/** Get the last active piece on given layer */
	findLastPieceOnLayer(
		sourceLayerId: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			pieceMetaDataFilter?: any // Mongo query against properties inside of piece.metaData
		}
	): Promise<IBlueprintPieceInstance | undefined>
	/** Get the previous scripted piece on a given layer, looking backwards from the current part. */
	findLastScriptedPieceOnLayer(
		sourceLayerId: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			pieceMetaDataFilter?: any
		}
	): Promise<IBlueprintPiece | undefined>
	/** Gets the PartInstance for a PieceInstance retrieved from findLastPieceOnLayer. This primarily allows for accessing metadata of the PartInstance */
	getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance>
	/** Gets the Part for a Piece retrieved from findLastScriptedPieceOnLayer. This primarily allows for accessing metadata of the Part */
	getPartForPreviousPiece(piece: IBlueprintPieceDB): Promise<IBlueprintPart | undefined>
	/** Fetch the showstyle config for the specified part */
	// getNextShowStyleConfig(): Readonly<{ [key: string]: ConfigItemValue }>

	/** Creative actions */
	/** Insert a pieceInstance. Returns id of new PieceInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	insertPiece(part: 'current' | 'next', piece: IBlueprintPiece): Promise<IBlueprintPieceInstance>
	/** Update a piecesInstance */
	updatePieceInstance(pieceInstanceId: string, piece: Partial<IBlueprintPiece>): Promise<IBlueprintPieceInstance>
	/** Insert a queued part to follow the current part */
	queuePart(part: IBlueprintPart, pieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance>
	/** Update a partInstance */
	updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance>

	/** Destructive actions */
	/** Stop any piecesInstances on the specified sourceLayers. Returns ids of piecesInstances that were affected */
	stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number): Promise<string[]>
	/** Stop piecesInstances by id. Returns ids of piecesInstances that were removed */
	stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number): Promise<string[]>
	/** Remove piecesInstances by id. Returns ids of piecesInstances that were removed. Note: For now we only allow removing from the next, but this might change to include current if there is justification */
	removePieceInstances(part: 'next', pieceInstanceIds: string[]): Promise<string[]>

	/** Move the next part through the rundown. Can move by either a number of parts, or segments in either direction. */
	moveNextPart(partDelta: number, segmentDelta: number): Promise<void>
	/** Set flag to perform take after executing the current action. Returns state of the flag after each call. */
	takeAfterExecuteAction(take: boolean): Promise<boolean>
	/** Inform core that a take out of the current partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>

	/** Misc actions */
	// updateAction(newManifest: Pick<IBlueprintAdLibActionManifest, 'description' | 'payload'>): void // only updates itself. to allow for the next one to do something different
	// executePeripheralDeviceAction(deviceId: string, functionName: string, args: any[]): Promise<any>
	// openUIDialogue(message: string) // ?????
	/** Returns a list of the PeripheralDevices */
	listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]>
	/** Execute an action on a certain PeripheralDevice */
	executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult>
}

/** Actions */
export interface ISyncIngestUpdateToPartInstanceContext extends IRundownUserContext {
	/** Sync a pieceInstance. Inserts the pieceInstance if new, updates if existing. Optionally pass in a mutated Piece, to override the content of the instance */
	syncPieceInstance(
		pieceInstanceId: string,
		mutatedPiece?: Omit<IBlueprintPiece, 'lifespan'>
	): IBlueprintPieceInstance

	/** Insert a pieceInstance. Returns id of new PieceInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	insertPieceInstance(piece: IBlueprintPiece): IBlueprintPieceInstance
	/** Update a pieceInstance */
	updatePieceInstance(pieceInstanceId: string, piece: Partial<IBlueprintPiece>): IBlueprintPieceInstance
	/** Remove a pieceInstance */
	removePieceInstances(...pieceInstanceIds: string[]): string[]

	// Upcoming interface:
	// /** Insert a AdlibInstance. Returns id of new AdlibInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	// insertAdlibInstance(adlibPiece: IBlueprintAdLibPiece): IBlueprintAdlibPieceInstance
	// /** Update a AdlibInstance */
	// updateAdlibInstance(adlibInstanceId: string, adlibPiece: Partial<OmitId<IBlueprintAdLibPiece>>): IBlueprintAdlibPieceInstance
	// /** Remove a AdlibInstance */
	// removeAdlibInstances(...adlibInstanceId: string[]): string[]

	// Upcoming interface:
	// /** Insert a ActionInstance. Returns id of new ActionInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	// insertActionInstance(action: IBlueprintAdlibAction): IBlueprintAdlibActionInstance
	// /** Update a ActionInstance */
	// updateActionInstance(actionInstanceId: string, action: Partial<OmitId<IBlueprintAdlibAction>>): IBlueprintAdlibActionInstance
	// /** Remove a ActionInstance */
	// removeActionInstances(...actionInstanceIds: string[]): string[]

	/** Update a partInstance */
	updatePartInstance(props: Partial<IBlueprintMutatablePart>): IBlueprintPartInstance

	/** Remove the partInstance. This is only valid when `playstatus: 'next'` */
	removePartInstance(): void
}

/** Events */

export interface IEventContext {
	getCurrentTime(): number
}

export interface ITimelineEventContext extends IEventContext, IRundownContext {
	readonly currentPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly nextPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly previousPartInstance: Readonly<IBlueprintPartInstance> | undefined

	/**
	 * Get the full session id for an ab playback session.
	 * Note: sessionName should be unique within the segment unless pieces want to share a session
	 */
	getPieceABSessionId(piece: IBlueprintPieceInstance, sessionName: string): string
	/**
	 * Get the full session id for a timelineobject that belongs to an ab playback session
	 * sessionName should also be used in calls to getPieceABSessionId for the owning piece
	 */
	getTimelineObjectAbSessionId(
		obj: OnGenerateTimelineObj<TSR.TSRTimelineContent, any, any>,
		sessionName: string
	): string | undefined
}

export interface IPartEventContext extends IEventContext, IRundownContext {
	readonly part: Readonly<IBlueprintPartInstance>
}

export interface IRundownDataChangedEventContext extends IEventContext, IRundownContext {
	formatDateAsTimecode(time: number): string
	formatDurationAsTimecode(time: number): string

	/** Get all unsent and queued messages in the rundown */
	getAllUnsentQueuedMessages(): Promise<Readonly<IBlueprintExternalMessageQueueObj[]>>
}

export interface IRundownTimingEventContext extends IRundownDataChangedEventContext {
	readonly previousPart: Readonly<IBlueprintPartInstance> | undefined
	readonly currentPart: Readonly<IBlueprintPartInstance>
	readonly nextPart: Readonly<IBlueprintPartInstance> | undefined

	/**
	 * Returns the first PartInstance in the Rundown within the current playlist activation.
	 * This allows for a start time for the Rundown to be determined
	 * @param allowUntimed Whether to consider a Part which has the untimed property set
	 */
	getFirstPartInstanceInRundown(allowUntimed?: boolean): Promise<Readonly<IBlueprintPartInstance>>

	/**
	 * Returns the partInstances in the Segment, limited to the playthrough of the segment that refPartInstance is part of
	 * @param refPartInstance PartInstance to use as the basis of the search
	 */
	getPartInstancesInSegmentPlayoutId(
		refPartInstance: Readonly<IBlueprintPartInstance>
	): Promise<Readonly<IBlueprintPartInstance[]>>

	/**
	 * Returns pieces in a partInstance
	 * @param id Id of partInstance to fetch items in
	 */
	getPieceInstances(...partInstanceIds: string[]): Promise<Readonly<IBlueprintPieceInstance[]>>

	/**
	 * Returns a segment
	 * @param id Id of segment to fetch
	 */
	getSegment(id: string): Promise<Readonly<IBlueprintSegmentDB> | undefined>
}
