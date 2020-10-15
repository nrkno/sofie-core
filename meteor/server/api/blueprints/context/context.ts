import * as _ from 'underscore'
import * as objectPath from 'object-path'
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
	objectPathGet,
	objectPathSet,
	waitForPromise,
} from '../../../../lib/lib'
import { DBPart, PartId } from '../../../../lib/collections/Parts'
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
} from 'tv-automation-sofie-blueprints-integration'

import { Studio, StudioId } from '../../../../lib/collections/Studios'
import {
	ConfigRef,
	getStudioBlueprintConfig,
	resetStudioBlueprintConfig,
	getShowStyleBlueprintConfig,
	resetShowStyleBlueprintConfig,
} from '../config'
import { Rundown, DBRundown } from '../../../../lib/collections/Rundowns'
import { ShowStyleBase, ShowStyleBases, ShowStyleBaseId } from '../../../../lib/collections/ShowStyleBases'
import {
	ShowStyleVariantId,
	ShowStyleVariants,
	ShowStyleVariant,
	ShowStyleCompound,
} from '../../../../lib/collections/ShowStyleVariants'
import { AsRunLogEvent, AsRunLog } from '../../../../lib/collections/AsRunLog'
import { NoteType, INoteBase } from '../../../../lib/api/notes'
import { loadCachedRundownData, loadIngestDataCachePart } from '../../ingest/ingestCache'
import { RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import { PieceInstances, unprotectPieceInstance } from '../../../../lib/collections/PieceInstances'
import { unprotectPartInstance, PartInstance } from '../../../../lib/collections/PartInstances'
import { ExternalMessageQueue } from '../../../../lib/collections/ExternalMessageQueue'
import { extendIngestRundownCore } from '../../ingest/lib'
import { loadStudioBlueprint, loadShowStyleBlueprint } from '../cache'
import { DeepReadonly } from 'utility-types'

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
	protected readonly studio: DeepReadonly<Studio>
	constructor(studio: DeepReadonly<Studio>) {
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
		studio: DeepReadonly<Studio>,
		private readonly showStyleCompound: DeepReadonly<ShowStyleCompound>,
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
	readonly _rundown: DeepReadonly<DBRundown>
	readonly playlistId: RundownPlaylistId

	constructor(
		studio: DeepReadonly<Studio>,
		rundown: DeepReadonly<DBRundown>,
		showStyleCompound: DeepReadonly<ShowStyleCompound>,
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
	// constructor(rundown: DeepReadonly<DBRundown>, cache: ReadOnlyCache<CacheForIngest>, notesContext: NotesContext) {
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
		studio: DeepReadonly<Studio>,
		rundown: DeepReadonly<Rundown>,
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

export class TimelineEventContext extends RundownContext implements ITimelineEventContext {
	readonly currentPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly nextPartInstance: Readonly<IBlueprintPartInstance> | undefined

	constructor(
		studio: DeepReadonly<Studio>,
		rundown: DeepReadonly<DBRundown>,
		showStyleCompound: DeepReadonly<ShowStyleCompound>,
		currentPartInstance: PartInstance | undefined,
		nextPartInstance: PartInstance | undefined
	) {
		super(
			studio,
			rundown,
			showStyleCompound,
			new NotesContext(
				rundown.name,
				`rundownId=${rundown._id},currentPartInstance=${currentPartInstance?._id},nextPartInstance=${nextPartInstance?._id}`,
				false
			)
		)

		this.currentPartInstance = currentPartInstance ? unprotectPartInstance(currentPartInstance) : undefined
		this.nextPartInstance = nextPartInstance ? unprotectPartInstance(nextPartInstance) : undefined
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

export class AsRunEventContext extends RundownContext implements IAsRunEventContext {
	public readonly asRunEvent: Readonly<IBlueprintAsRunLogEvent>

	constructor(
		studio: DeepReadonly<Studio>,
		rundown: DeepReadonly<DBRundown>,
		showStyleCompound: DeepReadonly<ShowStyleCompound>,
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
		// TODO-CACHE
		return []
		// return unprotectObjectArray(this.cache.Segments.findFetch({ rundownId: this._rundown._id }))
	}
	/**
	 * Returns a segment
	 * @param segmentId Id of segment to fetch. If is omitted, return the segment related to this AsRunEvent
	 */
	getSegment(segmentId?: string): IBlueprintSegmentDB | undefined {
		// TODO-CACHE
		return undefined
		// segmentId = segmentId || this.asRunEvent.segmentId
		// check(segmentId, String)
		// if (segmentId) {
		// 	return unprotectObject(
		// 		this.cache.Segments.findOne({
		// 			rundownId: this._rundown._id,
		// 			_id: protectString(segmentId),
		// 		})
		// 	)
		// }
	}
	/** Get all parts in this rundown */
	getParts(): Array<IBlueprintPartDB> {
		// TODO-CACHE
		return []
		// return unprotectObjectArray(this.cache.Parts.findFetch({ rundownId: this._rundown._id }))
	}
	/** Get the part related to this AsRunEvent */
	getPartInstance(partInstanceId?: string): IBlueprintPartInstance | undefined {
		// TODO-CACHE
		return undefined
		// partInstanceId = partInstanceId || this.asRunEvent.partInstanceId
		// check(partInstanceId, String)
		// if (partInstanceId) {
		// 	return unprotectPartInstance(
		// 		this._rundown.getAllPartInstances({
		// 			_id: protectString(partInstanceId),
		// 		})[0]
		// 	)
		// }
	}
	/** Get the mos story related to a part */
	getIngestDataForPart(part: IBlueprintPartDB): IngestPart | undefined {
		// TODO-CACHE
		return undefined
		// check(part._id, String)

		// try {
		// 	return loadIngestDataCachePart(
		// 		this._rundown._id,
		// 		this.rundown.externalId,
		// 		protectString<PartId>(part._id),
		// 		part.externalId
		// 	).data
		// } catch (e) {
		// 	return undefined
		// }
	}
	getIngestDataForPartInstance(partInstance: IBlueprintPartInstance): IngestPart | undefined {
		return this.getIngestDataForPart(partInstance.part)
	}
	/** Get the mos story related to the rundown */
	getIngestDataForRundown(): ExtendedIngestRundown | undefined {
		// TODO-CACHE
		return undefined
		// try {
		// 	const ingestRundown = loadCachedRundownData(this._rundown._id, this.rundown.externalId)
		// 	return extendIngestRundownCore(ingestRundown, this._rundown)
		// } catch (e) {
		// 	return undefined
		// }
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
