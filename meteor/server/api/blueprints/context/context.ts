import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import {
	getHash,
	formatDateAsTimecode,
	formatDurationAsTimecode,
	unprotectString,
	unprotectObject,
	unprotectObjectArray,
	protectString,
	getCurrentTime,
	omit,
	clone,
	getRandomId,
	unpartialString,
} from '../../../../lib/lib'
import { PartId, Parts } from '../../../../lib/collections/Parts'
import { check, Match } from '../../../../lib/check'
import { logger } from '../../../../lib/logging'
import {
	ICommonContext,
	NotesContext as INotesContext,
	ShowStyleContext as IShowStyleContext,
	RundownContext as IRundownContext,
	SegmentContext as ISegmentContext,
	EventContext as IEventContext,
	AsRunEventContext as IAsRunEventContext,
	PartEventContext as IPartEventContext,
	TimelineEventContext as ITimelineEventContext,
	IStudioConfigContext,
	IStudioContext,
	BlueprintMappings,
	IBlueprintSegmentDB,
	IngestPart,
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	IBlueprintPartDB,
	IBlueprintRundownDB,
	IBlueprintAsRunLogEvent,
	IBlueprintExternalMessageQueueObj,
	ExtendedIngestRundown,
} from '@sofie-automation/blueprints-integration'

import { Studio, StudioId } from '../../../../lib/collections/Studios'
import {
	ConfigRef,
	getStudioBlueprintConfig,
	resetStudioBlueprintConfig,
	getShowStyleBlueprintConfig,
	resetShowStyleBlueprintConfig,
} from '../config'
import { Rundown, DBRundown } from '../../../../lib/collections/Rundowns'
import { ShowStyleVariantId, ShowStyleCompound } from '../../../../lib/collections/ShowStyleVariants'
import { AsRunLogEvent, AsRunLog } from '../../../../lib/collections/AsRunLog'
import { NoteType, INoteBase } from '../../../../lib/api/notes'
import { ABSessionInfo, DBRundownPlaylist, RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import {
	PieceInstances,
	protectPieceInstance,
	unprotectPieceInstance,
} from '../../../../lib/collections/PieceInstances'
import { unprotectPartInstance, PartInstance, PartInstances } from '../../../../lib/collections/PartInstances'
import { ExternalMessageQueue } from '../../../../lib/collections/ExternalMessageQueue'
import { ReadonlyDeep } from 'type-fest'
import { Segments } from '../../../../lib/collections/Segments'
import { OnGenerateTimelineObjExt } from '../../../../lib/collections/Timeline'

/** Common */

export class CommonContext implements ICommonContext {
	private _idPrefix: string = ''
	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(idPrefix: string) {
		this._idPrefix = idPrefix
	}
	getHashId(str: string, isNotUnique?: boolean) {
		if (!str) str = 'hash' + this.hashI++

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(this._idPrefix + '_' + str.toString())
		this.hashed[id] = str
		return id
	}
	unhashId(hash: string): string {
		return this.hashed[hash] || hash
	}
}

export interface RawNote extends INoteBase {
	trackingId: string | undefined
}

export class NotesContext extends CommonContext implements INotesContext {
	private readonly _contextName: string
	private readonly _contextIdentifier: string
	private _handleNotesExternally: boolean

	private readonly savedNotes: Array<RawNote> = []

	constructor(contextName: string, contextIdentifier: string, handleNotesExternally: boolean) {
		super(contextIdentifier)
		this._contextName = contextName
		this._contextIdentifier = contextIdentifier
		/** If the notes will be handled externally (using .getNotes()), set this to true */
		this._handleNotesExternally = handleNotesExternally
	}
	/** Throw Error and display message to the user in the GUI */
	error(message: string, trackingId?: string) {
		check(message, String)
		logger.error('Error from blueprint: ' + message)
		this._pushNote(NoteType.ERROR, message, trackingId)
		throw new Meteor.Error(500, message)
	}
	/** Save note, which will be displayed to the user in the GUI */
	warning(message: string, trackingId?: string) {
		check(message, String)
		this._pushNote(NoteType.WARNING, message, trackingId)
	}
	getNotes(): RawNote[] {
		return this.savedNotes
	}
	get handleNotesExternally(): boolean {
		return this._handleNotesExternally
	}
	set handleNotesExternally(value: boolean) {
		this._handleNotesExternally = value
	}
	protected _pushNote(type: NoteType, message: string, trackingId: string | undefined) {
		if (this._handleNotesExternally) {
			this.savedNotes.push({
				type: type,
				message: message,
				trackingId: trackingId,
			})
		} else {
			if (type === NoteType.WARNING) {
				logger.warn(
					`Warning from "${this._contextName}"${trackingId ? `(${trackingId})` : ''}: "${message}"\n(${
						this._contextIdentifier
					})`
				)
			} else {
				logger.error(
					`Error from "${this._contextName}"${trackingId ? `(${trackingId})` : ''}: "${message}"\n(${
						this._contextIdentifier
					})`
				)
			}
		}
	}
}

/** Studio */

export class StudioConfigContext implements IStudioConfigContext {
	protected readonly studio: ReadonlyDeep<Studio>
	constructor(studio: ReadonlyDeep<Studio>) {
		this.studio = studio
	}

	public get studioId(): StudioId {
		return this.studio._id
	}

	getStudio(): Readonly<Studio> {
		return this.studio as any // TODO-CACHE
	}
	getStudioConfig(): unknown {
		return getStudioBlueprintConfig(this.studio)
	}
	protected wipeCache() {
		resetStudioBlueprintConfig(this.studio)
	}
	getStudioConfigRef(configKey: string): string {
		return ConfigRef.getStudioConfigRef(this.studio._id, configKey)
	}
}

export class StudioContext extends StudioConfigContext implements IStudioContext {
	getStudioMappings(): Readonly<BlueprintMappings> {
		return this.studio.mappings
	}
}

/** Show Style Variant */

export class ShowStyleContext extends StudioContext implements IShowStyleContext {
	readonly notesContext: NotesContext

	constructor(
		studio: ReadonlyDeep<Studio>,
		private readonly showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		notesContext: NotesContext
	) {
		super(studio)

		this.notesContext = notesContext
	}

	get showStyleVariantId(): ShowStyleVariantId {
		return this.showStyleCompound.showStyleVariantId
	}

	getShowStyleConfig(): unknown {
		return getShowStyleBlueprintConfig(this.showStyleCompound)
	}
	wipeCache() {
		super.wipeCache()
		resetShowStyleBlueprintConfig(this.showStyleCompound)
	}
	getShowStyleConfigRef(configKey: string): string {
		return ConfigRef.getShowStyleConfigRef(this.showStyleCompound.showStyleVariantId, configKey)
	}

	/** NotesContext */
	error(message: string, trackingId?: string) {
		this.notesContext.error(message, trackingId)
	}
	warning(message: string, trackingId?: string) {
		this.notesContext.warning(message, trackingId)
	}
	getHashId(str: string, isNotUnique?: boolean) {
		return this.notesContext.getHashId(str, isNotUnique)
	}
	unhashId(hash: string) {
		return this.notesContext.unhashId(hash)
	}
	get handleNotesExternally(): boolean {
		return this.notesContext.handleNotesExternally
	}
	set handleNotesExternally(value: boolean) {
		this.notesContext.handleNotesExternally = value
	}
}

/** Rundown */

export class RundownContext extends ShowStyleContext implements IRundownContext, IEventContext {
	readonly rundownId: string
	readonly rundown: Readonly<IBlueprintRundownDB>
	readonly _rundown: ReadonlyDeep<DBRundown>
	readonly playlistId: RundownPlaylistId

	constructor(
		studio: ReadonlyDeep<Studio>,
		rundown: ReadonlyDeep<DBRundown>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		notesContext: NotesContext | undefined
	) {
		super(
			studio,
			showStyleCompound,
			notesContext || new NotesContext(rundown.name, `rundownId=${rundown._id}`, false)
		)

		this.rundownId = unprotectString(rundown._id)
		this.rundown = unprotectObject(rundown)
		this._rundown = rundown
		this.playlistId = rundown.playlistId
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

export class SegmentContext extends RundownContext implements ISegmentContext {
	// constructor(rundown: ReadonlyDeep<DBRundown>, cache: ReadOnlyCache<CacheForIngest>, notesContext: NotesContext) {
	// 	super(cache.Studio.doc, rundown, null, notesContext)
	// }
}

/** Events */

export class EventContext extends CommonContext implements IEventContext {
	// TDB: Certain actions that can be triggered in Core by the Blueprint

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

export class PartEventContext extends RundownContext implements IPartEventContext {
	readonly part: Readonly<IBlueprintPartInstance>

	constructor(
		studio: ReadonlyDeep<Studio>,
		rundown: ReadonlyDeep<Rundown>,
		showStyle: ShowStyleCompound,
		partInstance: PartInstance
	) {
		super(
			studio,
			rundown,
			showStyle,
			new NotesContext(rundown.name, `rundownId=${rundown._id},partInstanceId=${partInstance._id}`, false)
		)

		this.part = unprotectPartInstance(partInstance)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

interface ABSessionInfoExt extends ABSessionInfo {
	/** Whether to store this session on the playlist (ie, whether it is still valid) */
	keep?: boolean
}

export class TimelineEventContext extends RundownContext implements ITimelineEventContext {
	private readonly partInstances: ReadonlyDeep<Array<PartInstance>>
	readonly currentPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly nextPartInstance: Readonly<IBlueprintPartInstance> | undefined

	private readonly _knownSessions: ABSessionInfoExt[]

	public get knownSessions() {
		return this._knownSessions.filter((s) => s.keep).map((s) => omit(s, 'keep'))
	}

	constructor(
		studio: ReadonlyDeep<Studio>,
		playlist: ReadonlyDeep<DBRundownPlaylist>,
		rundown: ReadonlyDeep<DBRundown>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		previousPartInstance: PartInstance | undefined,
		currentPartInstance: PartInstance | undefined,
		nextPartInstance: PartInstance | undefined
	) {
		super(
			studio,
			rundown,
			showStyleCompound,
			new NotesContext(
				rundown.name,
				`rundownId=${rundown._id},previousPartInstance=${previousPartInstance?._id},currentPartInstance=${currentPartInstance?._id},nextPartInstance=${nextPartInstance?._id}`,
				false
			)
		)

		this.currentPartInstance = currentPartInstance ? unprotectPartInstance(currentPartInstance) : undefined
		this.nextPartInstance = nextPartInstance ? unprotectPartInstance(nextPartInstance) : undefined

		this.partInstances = _.compact([previousPartInstance, currentPartInstance, nextPartInstance])

		this._knownSessions = clone(playlist.trackedAbSessions) ?? []
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	/** Internal, for overriding in tests */
	getNewSessionId(): string {
		return unprotectString(getRandomId())
	}

	getPieceABSessionId(pieceInstance0: IBlueprintPieceInstance, sessionName: string): string {
		const pieceInstance = protectPieceInstance(pieceInstance0)
		const partInstanceId = pieceInstance.partInstanceId
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

export class AsRunEventContext extends RundownContext implements IAsRunEventContext {
	public readonly asRunEvent: Readonly<IBlueprintAsRunLogEvent>

	constructor(
		studio: ReadonlyDeep<Studio>,
		rundown: ReadonlyDeep<DBRundown>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		asRunEvent: AsRunLogEvent
	) {
		super(
			studio,
			rundown,
			showStyleCompound,
			new NotesContext(rundown.name, `rundownId=${rundown._id},asRunEventId=${asRunEvent._id}`, false)
		)
		this.asRunEvent = unprotectObject(asRunEvent)
	}

	/** Get all asRunEvents in the rundown */
	getAllAsRunEvents(): Array<IBlueprintAsRunLogEvent> {
		return unprotectObjectArray(
			AsRunLog.find(
				{
					rundownId: this._rundown._id,
				},
				{
					sort: {
						timestamp: 1,
					},
				}
			).fetch()
		)
	}
	/** Get all unsent and queued messages in the rundown */
	getAllQueuedMessages(): Readonly<IBlueprintExternalMessageQueueObj[]> {
		return unprotectObjectArray(
			ExternalMessageQueue.find(
				{
					rundownId: this._rundown._id,
					queueForLaterReason: { $exists: true },
				},
				{
					sort: {
						created: 1,
					},
				}
			).fetch()
		)
	}
	/** Get all segments in this rundown */
	getSegments(): Array<IBlueprintSegmentDB> {
		return unprotectObjectArray(Segments.find({ rundownId: this._rundown._id }).fetch())
	}
	/**
	 * Returns a segment
	 * @param segmentId Id of segment to fetch. If is omitted, return the segment related to this AsRunEvent
	 */
	getSegment(segmentId?: string): IBlueprintSegmentDB | undefined {
		segmentId = segmentId || this.asRunEvent.segmentId
		check(segmentId, String)
		if (segmentId) {
			return unprotectObject(
				Segments.findOne({
					rundownId: this._rundown._id,
					_id: protectString(segmentId),
				})
			)
		}
	}
	/** Get all parts in this rundown */
	getParts(): Array<IBlueprintPartDB> {
		return unprotectObjectArray(Parts.find({ rundownId: this._rundown._id }).fetch())
	}
	/** Get the part related to this AsRunEvent */
	getPartInstance(partInstanceId?: string): IBlueprintPartInstance | undefined {
		partInstanceId = partInstanceId || this.asRunEvent.partInstanceId
		check(partInstanceId, String)
		if (partInstanceId) {
			return unprotectPartInstance(
				PartInstances.findOne({
					rundownId: this._rundown._id,
					_id: protectString(partInstanceId),
				})
			)
		}
	}
	/** Get the mos story related to a part */
	getIngestDataForPart(part: IBlueprintPartDB): IngestPart | undefined {
		throw new Meteor.Error(500, 'Removed')
	}
	getIngestDataForPartInstance(partInstance: IBlueprintPartInstance): IngestPart | undefined {
		return this.getIngestDataForPart(partInstance.part)
	}
	/** Get the mos story related to the rundown */
	getIngestDataForRundown(): ExtendedIngestRundown | undefined {
		throw new Meteor.Error(500, 'Removed')
	}

	/**
	 * Returns a piece.
	 * @param id Id of piece to fetch. If omitted, return the piece related to this AsRunEvent
	 */
	getPieceInstance(pieceInstanceId?: string): IBlueprintPieceInstance | undefined {
		check(pieceInstanceId, Match.Optional(String))
		pieceInstanceId = pieceInstanceId || this.asRunEvent.pieceInstanceId
		if (pieceInstanceId) {
			return unprotectPieceInstance(
				PieceInstances.findOne({
					rundownId: this._rundown._id,
					_id: protectString(pieceInstanceId),
				})
			)
		}
	}
	/**
	 * Returns pieces in a part
	 * @param id Id of part to fetch pieces in
	 */
	getPieceInstances(partInstanceId: string): Array<IBlueprintPieceInstance> {
		check(partInstanceId, String)
		if (partInstanceId) {
			return unprotectObjectArray(
				PieceInstances.find({
					rundownId: this._rundown._id,
					partInstanceId: protectString(partInstanceId),
				}).fetch()
			) as any // pieceinstande.piece is the issue
		}
		return []
	}

	formatDateAsTimecode(time: number): string {
		check(time, Number)
		return formatDateAsTimecode(new Date(time))
	}
	formatDurationAsTimecode(time: number): string {
		check(time, Number)
		return formatDurationAsTimecode(time)
	}
	protected getLoggerIdentifier(): string {
		// override NotesContext.getLoggerIdentifier
		let ids: string[] = []
		if (this.rundownId) ids.push('rundownId: ' + this.rundownId)
		if (this.asRunEvent.segmentId) ids.push('segmentId: ' + this.asRunEvent.segmentId)
		if (this.asRunEvent.partInstanceId) ids.push('partInstanceId: ' + this.asRunEvent.partInstanceId)
		if (this.asRunEvent.pieceInstanceId) ids.push('pieceInstanceId: ' + this.asRunEvent.pieceInstanceId)
		if (this.asRunEvent.timelineObjectId) ids.push('timelineObjectId: ' + this.asRunEvent.timelineObjectId)
		return ids.join(',')
	}
}
