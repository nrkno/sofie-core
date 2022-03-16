import {
	ICommonContext,
	IStudioContext,
	BlueprintMappings,
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	IShowStyleContext,
	IRundownContext,
	IEventContext,
	ITimelineEventContext,
	PackageInfo,
	IStudioBaselineContext,
	IShowStyleUserContext,
	IPartEventContext,
	IStudioUserContext,
	ISegmentUserContext,
	IRundownDataChangedEventContext,
	IBlueprintExternalMessageQueueObj,
	IBlueprintSegmentDB,
	IRundownTimingEventContext,
	NoteSeverity,
	IBlueprintSegmentRundown,
	IRundownUserContext,
	IGetRundownContext,
	IBlueprintRundownPlaylist,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../../logging'
import { ReadonlyDeep } from 'type-fest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	protectString,
	protectStringArray,
	unDeepString,
	unpartialString,
	unprotectObjectArray,
	unprotectString,
} from '@sofie-automation/corelib/dist/protectedString'
import {
	PartId,
	PartInstanceId,
	PieceInstanceId,
	RundownPlaylistId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	assertNever,
	clone,
	formatDateAsTimecode,
	formatDurationAsTimecode,
	getHash,
	getRandomString,
	omit,
} from '@sofie-automation/corelib/dist/lib'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ABSessionInfo, DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime } from '../../lib'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { getShowStyleConfigRef, getStudioConfigRef, ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config'
import _ = require('underscore')
import { WatchedPackagesHelper } from './watchedPackages'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { JobContext } from '../../jobs'
import { MongoQuery } from '../../db'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { convertPartInstanceToBlueprints, convertPieceInstanceToBlueprints, convertSegmentToBlueprints } from './lib'

export interface ContextInfo {
	/** Short name for the context (eg the blueprint function being called) */
	name: string
	/** Full identifier info for the context. Should be able to identify the rundown/studio/blueprint etc being executed */
	identifier: string
}
export interface UserContextInfo extends ContextInfo {
	tempSendUserNotesIntoBlackHole?: boolean // TODO-CONTEXT remove this
}

/** Common */

export class CommonContext implements ICommonContext {
	private readonly _contextIdentifier: string
	private readonly _contextName: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(info: ContextInfo) {
		this._contextIdentifier = info.identifier
		this._contextName = info.name
	}
	getHashId(str: string, isNotUnique?: boolean): string {
		if (!str) str = 'hash' + this.hashI++

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(this._contextIdentifier + '_' + str.toString())
		this.hashed[id] = str
		return id
	}
	unhashId(hash: string): string {
		return this.hashed[hash] || hash
	}

	logDebug(message: string): void {
		logger.debug(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logInfo(message: string): void {
		logger.info(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logWarning(message: string): void {
		logger.warn(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logError(message: string): void {
		logger.error(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	protected logNote(message: string, type: NoteSeverity): void {
		if (type === NoteSeverity.ERROR) {
			this.logError(message)
		} else if (type === NoteSeverity.WARNING) {
			this.logWarning(message)
		} else if (type === NoteSeverity.INFO) {
			this.logInfo(message)
		} else {
			assertNever(type)
			this.logDebug(message)
		}
	}
}

/** Studio */

export class StudioContext extends CommonContext implements IStudioContext {
	constructor(
		contextInfo: ContextInfo,
		public readonly studio: ReadonlyDeep<DBStudio>,
		public readonly studioBlueprintConfig: ProcessedStudioConfig
	) {
		super(contextInfo)
	}

	public get studioId(): string {
		return unprotectString(this.studio._id)
	}

	public get studioIdProtected(): StudioId {
		return this.studio._id
	}

	getStudioConfig(): unknown {
		return this.studioBlueprintConfig
	}
	getStudioConfigRef(configKey: string): string {
		return getStudioConfigRef(this.studio._id, configKey)
	}
	getStudioMappings(): Readonly<BlueprintMappings> {
		// @ts-expect-error ProtectedString deviceId not compatible with string
		return this.studio.mappings
	}
}

export class StudioBaselineContext extends StudioContext implements IStudioBaselineContext {
	constructor(
		contextInfo: UserContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, studio, studioBlueprintConfig)
	}

	getPackageInfo(packageId: string): readonly PackageInfo.Any[] {
		return this.watchedPackages.getPackageInfo(packageId)
	}
}

export class StudioUserContext extends StudioContext implements IStudioUserContext {
	public readonly notes: INoteBase[] = []
	private readonly tempSendNotesIntoBlackHole: boolean

	constructor(
		contextInfo: UserContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig
	) {
		super(contextInfo, studio, studioBlueprintConfig)
		this.tempSendNotesIntoBlackHole = contextInfo.tempSendUserNotesIntoBlackHole ?? false
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.ERROR, message, params)
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.WARNING, message, params)
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.INFO, message, params)
	}
	private addNote(type: NoteSeverity, message: string, params?: { [key: string]: any }) {
		if (this.tempSendNotesIntoBlackHole) {
			this.logNote(`UserNotes: "${message}", ${JSON.stringify(params)}`, type)
		} else {
			this.notes.push({
				type: type,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}
}

/** Show Style Variant */
export class ShowStyleContext extends StudioContext implements IShowStyleContext {
	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		public readonly showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		public readonly showStyleBlueprintConfig: ProcessedShowStyleConfig
	) {
		super(contextInfo, studio, studioBlueprintConfig)
	}

	getShowStyleConfig(): unknown {
		return this.showStyleBlueprintConfig
	}
	getShowStyleConfigRef(configKey: string): string {
		return getShowStyleConfigRef(this.showStyleCompound.showStyleVariantId, configKey)
	}
}

export class ShowStyleUserContext extends ShowStyleContext implements IShowStyleUserContext {
	public readonly notes: INoteBase[] = []
	private readonly tempSendNotesIntoBlackHole: boolean

	constructor(
		contextInfo: UserContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, studio, studioBlueprintConfig, showStyleCompound, showStyleBlueprintConfig)
		this.tempSendNotesIntoBlackHole = contextInfo.tempSendUserNotesIntoBlackHole ?? false
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logError(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteSeverity.ERROR,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logWarning(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteSeverity.WARNING,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logInfo(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteSeverity.INFO,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		return this.watchedPackages.getPackageInfo(packageId)
	}
}
export class GetRundownContext extends ShowStyleUserContext implements IGetRundownContext {
	private cachedPlaylistsInStudio: Promise<Readonly<IBlueprintRundownPlaylist>[]> | undefined
	constructor(
		contextInfo: UserContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		watchedPackages: WatchedPackagesHelper,
		private getPlaylistsInStudio: () => Promise<DBRundownPlaylist[]>,
		private getRundownsInStudio: () => Promise<Pick<Rundown, '_id' | 'playlistId'>[]>,
		private getExistingRundown: () => Promise<ReadonlyObjectDeep<Rundown> | undefined>
	) {
		super(contextInfo, studio, studioBlueprintConfig, showStyleCompound, showStyleBlueprintConfig, watchedPackages)
	}
	private async _getPlaylistsInStudio() {
		if (!this.cachedPlaylistsInStudio) {
			this.cachedPlaylistsInStudio = Promise.resolve().then(async () => {
				const [rundownsInStudio, playlistsInStudio] = await Promise.all([
					this.getRundownsInStudio(),
					this.getPlaylistsInStudio(),
				])

				return playlistsInStudio.map((playlist) => this.stripPlaylist(playlist, rundownsInStudio))
			})
		}
		return this.cachedPlaylistsInStudio
	}
	async getPlaylists(): Promise<Readonly<IBlueprintRundownPlaylist[]>> {
		return this._getPlaylistsInStudio()
	}
	async getCurrentPlaylist(): Promise<Readonly<IBlueprintRundownPlaylist | undefined>> {
		const existingRundown = await this.getExistingRundown()
		if (!existingRundown) return undefined

		const rundownPlaylistId = unprotectString(existingRundown.playlistId)

		const playlists = await this._getPlaylistsInStudio()
		return playlists.find((playlist) => playlist._id === rundownPlaylistId)
	}
	public getRandomId(): string {
		return getRandomString()
	}
	private stripPlaylist(
		playlist: DBRundownPlaylist,
		rundownsInStudio: Pick<Rundown, '_id' | 'playlistId'>[]
	): IBlueprintRundownPlaylist {
		return {
			name: playlist.name,

			timing: playlist.timing,
			outOfOrderTiming: playlist.outOfOrderTiming,
			loop: playlist.loop,
			timeOfDayCountdowns: playlist.timeOfDayCountdowns,

			metaData: playlist.metaData,

			_id: unprotectString(playlist._id),
			externalId: playlist.externalId,
			created: playlist.created,
			modified: playlist.modified,
			isActive: !!playlist.activationId,
			rehearsal: playlist.rehearsal ?? false,
			startedPlayback: playlist.startedPlayback,

			rundownCount: rundownsInStudio.filter((rundown) => rundown.playlistId === playlist._id).length,
		}
	}
}

/** Rundown */

export class RundownContext extends ShowStyleContext implements IRundownContext {
	readonly rundownId: string
	readonly rundown: Readonly<IBlueprintSegmentRundown>
	readonly _rundown: ReadonlyDeep<DBRundown>
	readonly playlistId: RundownPlaylistId

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(contextInfo, studio, studioBlueprintConfig, showStyleCompound, showStyleBlueprintConfig)

		this.rundownId = unprotectString(rundown._id)
		this.rundown = rundownToSegmentRundown(rundown)
		this._rundown = rundown
		this.playlistId = rundown.playlistId
	}
}

export class RundownUserContext extends RundownContext implements IRundownUserContext {
	public readonly notes: INoteBase[] = []

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.ERROR, message, params)
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.WARNING, message, params)
	}
	notifyUserInfo(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.INFO, message, params)
	}
	private addNote(type: NoteSeverity, message: string, params?: { [key: string]: any }) {
		this.notes.push({
			type: type,
			message: {
				key: message,
				args: params,
			},
		})
	}
}

export class RundownEventContext extends RundownContext implements IEventContext {
	constructor(
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(
			{
				name: rundown.name,
				identifier: `rundownId=${rundown._id},blueprintId=${showStyleCompound.blueprintId}`,
			},
			studio,
			studioBlueprintConfig,
			showStyleCompound,
			showStyleBlueprintConfig,
			rundown
		)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

export interface RawPartNote extends INoteBase {
	partExternalId: string | undefined
}

export class SegmentUserContext extends RundownContext implements ISegmentUserContext {
	public readonly notes: RawPartNote[] = []

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, studio, studioBlueprintConfig, showStyleCompound, showStyleBlueprintConfig, rundown)
	}

	notifyUserError(message: string, params?: { [key: string]: any }, partExternalId?: string): void {
		this.notes.push({
			type: NoteSeverity.ERROR,
			message: {
				key: message,
				args: params,
			},
			partExternalId: partExternalId,
		})
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }, partExternalId?: string): void {
		this.notes.push({
			type: NoteSeverity.WARNING,
			message: {
				key: message,
				args: params,
			},
			partExternalId: partExternalId,
		})
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }, partExternalId?: string): void {
		this.notes.push({
			type: NoteSeverity.INFO,
			message: {
				key: message,
				args: params,
			},
			partExternalId: partExternalId,
		})
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		return this.watchedPackages.getPackageInfo(packageId)
	}
}

// /** Events */

// export class EventContext extends CommonContext implements IEventContext {
// 	// TDB: Certain actions that can be triggered in Core by the Blueprint

// 	getCurrentTime(): number {
// 		return getCurrentTime()
// 	}
// }

export class PartEventContext extends RundownContext implements IPartEventContext {
	readonly part: Readonly<IBlueprintPartInstance>

	constructor(
		eventName: string,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>,
		partInstance: DBPartInstance
	) {
		super(
			{
				name: `Event: ${eventName}`,
				identifier: `rundownId=${rundown._id},blueprintId=${showStyleCompound.blueprintId}`,
			},
			studio,
			studioBlueprintConfig,
			showStyleCompound,
			showStyleBlueprintConfig,
			rundown
		)

		this.part = convertPartInstanceToBlueprints(partInstance)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

interface ABSessionInfoExt extends ABSessionInfo {
	/** Whether to store this session on the playlist (ie, whether it is still valid) */
	keep?: boolean
}

export class OnTimelineGenerateContext extends RundownContext implements ITimelineEventContext {
	private readonly partInstances: ReadonlyDeep<Array<DBPartInstance>>
	readonly currentPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly nextPartInstance: Readonly<IBlueprintPartInstance> | undefined

	private readonly _knownSessions: ABSessionInfoExt[]

	private readonly pieceInstanceCache = new Map<PieceInstanceId, PieceInstance>()

	public get knownSessions(): ABSessionInfo[] {
		return this._knownSessions.filter((s) => s.keep).map((s) => omit(s, 'keep'))
	}

	public trackPieceInstances(pieceInstances: PieceInstance[]): void {
		for (const pieceInstance of pieceInstances) {
			this.pieceInstanceCache.set(pieceInstance._id, pieceInstance)
		}
	}

	constructor(
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		playlist: ReadonlyDeep<DBRundownPlaylist>,
		rundown: ReadonlyDeep<DBRundown>,
		previousPartInstance: DBPartInstance | undefined,
		currentPartInstance: DBPartInstance | undefined,
		nextPartInstance: DBPartInstance | undefined
	) {
		super(
			{
				name: rundown.name,
				identifier: `rundownId=${rundown._id},previousPartInstance=${previousPartInstance?._id},currentPartInstance=${currentPartInstance?._id},nextPartInstance=${nextPartInstance?._id}`,
			},
			studio,
			studioBlueprintConfig,
			showStyleCompound,
			showStyleBlueprintConfig,
			rundown
		)

		this.currentPartInstance = currentPartInstance && convertPartInstanceToBlueprints(currentPartInstance)
		this.nextPartInstance = nextPartInstance && convertPartInstanceToBlueprints(nextPartInstance)

		this.partInstances = _.compact([previousPartInstance, currentPartInstance, nextPartInstance])

		this._knownSessions = clone<ABSessionInfo[]>(playlist.trackedAbSessions ?? [])
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	/** Internal, for overriding in tests */
	getNewSessionId(): string {
		return getRandomString()
	}

	getPieceABSessionId(pieceInstance0: Pick<IBlueprintPieceInstance, '_id'>, sessionName: string): string {
		const pieceInstance = this.pieceInstanceCache.get(protectString(pieceInstance0._id))
		const partInstanceId = pieceInstance?.partInstanceId
		if (!partInstanceId) throw new Error('Missing partInstanceId in call to getPieceABSessionId')

		const partInstanceIndex = this.partInstances.findIndex((p) => p._id === partInstanceId)
		const partInstance = partInstanceIndex >= 0 ? this.partInstances[partInstanceIndex] : undefined
		if (!partInstance) throw new Error('Unknown partInstanceId in call to getPieceABSessionId')

		const infiniteId = pieceInstance.infinite?.infiniteInstanceId
		const preserveSession = (session: ABSessionInfoExt): string => {
			session.keep = true
			session.infiniteInstanceId = unpartialString(infiniteId)
			delete session.lookaheadForPartId
			return session.id
		}

		// If this is an infinite continuation, then reuse that
		if (infiniteId) {
			const infiniteSession = this._knownSessions.find(
				(s) => s.infiniteInstanceId === infiniteId && s.name === sessionName
			)
			if (infiniteSession) {
				return preserveSession(infiniteSession)
			}
		}

		// We only want to consider sessions already tagged to this partInstance
		const existingSession = this._knownSessions.find(
			(s) => s.partInstanceIds?.includes(unpartialString(partInstanceId)) && s.name === sessionName
		)
		if (existingSession) {
			return preserveSession(existingSession)
		}

		// Check if we can continue sessions from the part before, or if we should create new ones
		const canReuseFromPartInstanceBefore =
			partInstanceIndex > 0 && this.partInstances[partInstanceIndex - 1].part._rank < partInstance.part._rank

		if (canReuseFromPartInstanceBefore) {
			// Try and find a session from the part before that we can use
			const previousPartInstanceId = this.partInstances[partInstanceIndex - 1]._id
			const continuedSession = this._knownSessions.find(
				(s) => s.partInstanceIds?.includes(previousPartInstanceId) && s.name === sessionName
			)
			if (continuedSession) {
				continuedSession.partInstanceIds = [
					...(continuedSession.partInstanceIds || []),
					unpartialString(partInstanceId),
				]
				return preserveSession(continuedSession)
			}
		}

		// Find an existing lookahead session to convert
		const partId = partInstance.part._id
		const lookaheadSession = this._knownSessions.find(
			(s) => s.name === sessionName && s.lookaheadForPartId === partId
		)
		if (lookaheadSession) {
			lookaheadSession.partInstanceIds = [unpartialString(partInstanceId)]
			return preserveSession(lookaheadSession)
		}

		// Otherwise define a new session
		const sessionId = this.getNewSessionId()
		const newSession: ABSessionInfoExt = {
			id: sessionId,
			name: sessionName,
			infiniteInstanceId: unpartialString(infiniteId),
			partInstanceIds: _.compact([!infiniteId ? unpartialString(partInstanceId) : undefined]),
			keep: true,
		}
		this._knownSessions.push(newSession)
		return sessionId
	}

	getTimelineObjectAbSessionId(tlObj: OnGenerateTimelineObjExt, sessionName: string): string | undefined {
		// Find an infinite
		const searchId = tlObj.infinitePieceInstanceId
		if (searchId) {
			const infiniteSession = this._knownSessions.find(
				(s) => s.infiniteInstanceId === searchId && s.name === sessionName
			)
			if (infiniteSession) {
				infiniteSession.keep = true
				return infiniteSession.id
			}
		}

		// Find an normal partInstance
		const partInstanceId = tlObj.partInstanceId
		if (partInstanceId) {
			const partInstanceSession = this._knownSessions.find(
				(s) => s.partInstanceIds?.includes(partInstanceId) && s.name === sessionName
			)
			if (partInstanceSession) {
				partInstanceSession.keep = true
				return partInstanceSession.id
			}
		}

		// If it is lookahead, then we run differently
		let partId = protectString<PartId>(unprotectString(partInstanceId))
		if (tlObj.isLookahead && partInstanceId && partId) {
			// If partId is a known partInstanceId, then convert it to a partId
			const partInstance = this.partInstances.find((p) => p._id === partInstanceId)
			if (partInstance) partId = partInstance.part._id

			const lookaheadSession = this._knownSessions.find((s) => s.lookaheadForPartId === partId)
			if (lookaheadSession) {
				lookaheadSession.keep = true
				if (partInstance) {
					lookaheadSession.partInstanceIds = [partInstanceId]
				}
				return lookaheadSession.id
			} else {
				const sessionId = this.getNewSessionId()
				this._knownSessions.push({
					id: sessionId,
					name: sessionName,
					lookaheadForPartId: partId,
					partInstanceIds: partInstance ? [partInstanceId] : undefined,
					keep: true,
				})
				return sessionId
			}
		}

		return undefined
	}
}

export class RundownDataChangedEventContext extends RundownContext implements IRundownDataChangedEventContext {
	constructor(
		protected readonly context: JobContext,
		contextInfo: ContextInfo,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(
			contextInfo,
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	/** Get all unsent and queued messages in the rundown */
	async getAllUnsentQueuedMessages(): Promise<Readonly<IBlueprintExternalMessageQueueObj[]>> {
		return unprotectObjectArray(
			await this.context.directCollections.ExternalMessageQueue.findFetch(
				{
					rundownId: this._rundown._id,
					queueForLaterReason: { $exists: true },
				},
				{
					sort: {
						created: 1,
					},
				}
			)
		)
	}

	formatDateAsTimecode(time: number): string {
		if (typeof time !== 'number') throw new Error(`formatDateAsTimecode: time must be a number`)
		return formatDateAsTimecode(this.context.studio.settings, new Date(time))
	}
	formatDurationAsTimecode(time: number): string {
		if (typeof time !== 'number') throw new Error(`formatDurationAsTimecode: time must be a number`)
		return formatDurationAsTimecode(this.context.studio.settings, time)
	}
}

export class RundownTimingEventContext extends RundownDataChangedEventContext implements IRundownTimingEventContext {
	readonly previousPart: Readonly<IBlueprintPartInstance<unknown>> | undefined
	private readonly _currentPart: DBPartInstance
	readonly nextPart: Readonly<IBlueprintPartInstance<unknown>> | undefined

	private readonly partInstanceCache = new Map<PartInstanceId, DBPartInstance>()

	public get currentPart(): Readonly<IBlueprintPartInstance<unknown>> {
		return convertPartInstanceToBlueprints(this._currentPart)
	}

	constructor(
		context: JobContext,
		contextInfo: ContextInfo,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>,
		previousPartInstance: DBPartInstance | undefined,
		partInstance: DBPartInstance,
		nextPartInstance: DBPartInstance | undefined
	) {
		super(context, contextInfo, showStyleCompound, rundown)

		if (previousPartInstance) this.partInstanceCache.set(previousPartInstance._id, previousPartInstance)
		if (partInstance) this.partInstanceCache.set(partInstance._id, partInstance)
		if (nextPartInstance) this.partInstanceCache.set(nextPartInstance._id, nextPartInstance)

		this.previousPart = previousPartInstance && convertPartInstanceToBlueprints(previousPartInstance)
		this._currentPart = partInstance
		this.nextPart = nextPartInstance && convertPartInstanceToBlueprints(nextPartInstance)
	}

	async getFirstPartInstanceInRundown(allowUntimed?: boolean): Promise<Readonly<IBlueprintPartInstance<unknown>>> {
		const query: MongoQuery<DBPartInstance> = {
			rundownId: this._rundown._id,
			playlistActivationId: this._currentPart.playlistActivationId,
			'part.untimed': { $ne: true },
		}

		if (allowUntimed) {
			// This is a weird way to define the query, but its necessary to make typings happy
			delete query['part.untimed']
		}

		const partInstance = await this.context.directCollections.PartInstances.findOne(query, {
			sort: {
				takeCount: 1,
			},
		})

		// If this doesn't find anything, then where did our reference PartInstance come from?
		if (!partInstance)
			throw new Error(
				`No PartInstances found for Rundown "${this._rundown._id}" (PlaylistActivationId "${this._currentPart.playlistActivationId}")`
			)

		this.partInstanceCache.set(partInstance._id, partInstance)

		return convertPartInstanceToBlueprints(partInstance)
	}

	async getPartInstancesInSegmentPlayoutId(
		refPartInstance: Readonly<Pick<IBlueprintPartInstance<unknown>, '_id'>>
	): Promise<Array<IBlueprintPartInstance<unknown>>> {
		// Pull the PartInstance from the cached list, so that we can access 'secret' values
		const refPartInstance2 = this.partInstanceCache.get(protectString(refPartInstance._id))
		if (!refPartInstance2 || !refPartInstance2.segmentId || !refPartInstance2.segmentPlayoutId)
			throw new Error('Missing partInstance to use a reference for the segment')

		const partInstances = await this.context.directCollections.PartInstances.findFetch(
			{
				rundownId: this._rundown._id,
				playlistActivationId: this._currentPart.playlistActivationId,
				segmentId: unDeepString(refPartInstance2.segmentId),
				segmentPlayoutId: unDeepString(refPartInstance2.segmentPlayoutId),
			},
			{
				sort: {
					takeCount: 1,
				},
			}
		)

		const res: Array<IBlueprintPartInstance<unknown>> = []
		for (const partInstance of partInstances) {
			this.partInstanceCache.set(partInstance._id, partInstance)
			res.push(convertPartInstanceToBlueprints(partInstance))
		}

		return res
	}

	async getPieceInstances(...partInstanceIds: string[]): Promise<Array<IBlueprintPieceInstance<unknown>>> {
		if (partInstanceIds.length === 0) return []

		const pieceInstances = await this.context.directCollections.PieceInstances.findFetch({
			rundownId: this._rundown._id,
			playlistActivationId: this._currentPart.playlistActivationId,
			partInstanceId: { $in: protectStringArray(partInstanceIds) },
		})

		return pieceInstances.map(convertPieceInstanceToBlueprints)
	}

	async getSegment(segmentId: string): Promise<Readonly<IBlueprintSegmentDB<unknown>> | undefined> {
		if (!segmentId) return undefined

		const segment = await this.context.directCollections.Segments.findOne({
			_id: protectString(segmentId),
			rundownId: this._rundown._id,
		})

		return segment && convertSegmentToBlueprints(segment)
	}
}

export function rundownToSegmentRundown(rundown: ReadonlyDeep<DBRundown>): IBlueprintSegmentRundown {
	return {
		externalId: rundown.externalId,
		metaData: rundown.metaData,
	}
}
