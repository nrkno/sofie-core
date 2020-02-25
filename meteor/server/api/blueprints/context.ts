import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { getHash, formatDateAsTimecode, formatDurationAsTimecode, unprotectString, unprotectObject, unprotectObjectArray, protectString } from '../../../lib/lib'
import { DBPart, PartId } from '../../../lib/collections/Parts'
import { check, Match } from 'meteor/check'
import { logger } from '../../../lib/logging'
import {
	ICommonContext,
	NotesContext as INotesContext,
	ShowStyleContext as IShowStyleContext,
	RundownContext as IRundownContext,
	SegmentContext as ISegmentContext,
	PartContext as IPartContext,
	EventContext as IEventContext,
	AsRunEventContext as IAsRunEventContext,
	PartEventContext as IPartEventContext,
	IStudioConfigContext,
	ConfigItemValue,
	IStudioContext,
	BlueprintMappings,
	BlueprintRuntimeArguments,
	IBlueprintSegmentDB,
	IngestRundown,
	IngestPart,
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	IBlueprintPartDB,
	IBlueprintRundownDB,
	IBlueprintAsRunLogEvent
} from 'tv-automation-sofie-blueprints-integration'
import { Studio } from '../../../lib/collections/Studios'
import { ConfigRef, compileStudioConfig } from './config'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { ShowStyleBase, ShowStyleBases, ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { getShowStyleCompound, ShowStyleVariantId } from '../../../lib/collections/ShowStyleVariants'
import { AsRunLogEvent, AsRunLog } from '../../../lib/collections/AsRunLog'
import { PartNote, NoteType } from '../../../lib/api/notes'
import { loadCachedRundownData, loadIngestDataCachePart } from '../ingest/ingestCache'
import { RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Segment, SegmentId } from '../../../lib/collections/Segments'
import { PieceInstances, unprotectPieceInstance } from '../../../lib/collections/PieceInstances'
import { InternalIBlueprintPartInstance, PartInstanceId, unprotectPartInstance, PartInstance } from '../../../lib/collections/PartInstances'

/** Common */

export class CommonContext implements ICommonContext {

	private _idPrefix: string = ''
	private hashI = 0
	private hashed: {[hash: string]: string} = {}

	constructor (idPrefix: string) {
		this._idPrefix = idPrefix
	}
	getHashId (str: string, isNotUnique?: boolean) {
		if (!str) str = 'hash' + (this.hashI++)

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(
			this._idPrefix + '_' +
			str.toString()
		)
		this.hashed[id] = str
		return id
	}
	unhashId (hash: string): string {
		return this.hashed[hash] || hash
	}
}

export class NotesContext extends CommonContext implements INotesContext {

	/** If the notes will be handled externally (using .getNotes()), set this to true */
	public handleNotesExternally: boolean = false

	protected _rundownId: RundownId
	private _contextName: string
	private _segmentId?: SegmentId
	private _partId?: PartId

	private savedNotes: Array<PartNote> = []

	constructor (
		contextName: string,
		rundownId: RundownId,
		segmentId?: SegmentId,
		partId?: PartId,
	) {
		super(
			rundownId +
			(
				partId ? '_' + partId :
				(
					segmentId ? '_' + segmentId : ''
				)
			)
		)
		this._contextName		= contextName

		// TODO - we should fill these in just before inserting into the DB instead
		this._rundownId	= rundownId
		this._segmentId			= segmentId
		this._partId		= partId

	}
	/** Throw Error and display message to the user in the GUI */
	error (message: string) {
		check(message, String)
		logger.error('Error from blueprint: ' + message)
		this._pushNote(
			NoteType.ERROR,
			message
		)
		throw new Meteor.Error(500, message)
	}
	/** Save note, which will be displayed to the user in the GUI */
	warning (message: string) {
		check(message, String)
		this._pushNote(
			NoteType.WARNING,
			message
		)
	}
	getNotes () {
		return this.savedNotes
	}
	protected getLoggerIdentifier (): string {
		let ids: string[] = []
		if (this._rundownId) ids.push('rundownId: ' + this._rundownId)
		if (this._segmentId) ids.push('segmentId: ' + this._segmentId)
		if (this._partId) ids.push('partId: ' + this._partId)
		return ids.join(',')
	}
	private _pushNote (type: NoteType, message: string) {
		if (this.handleNotesExternally) {
			this.savedNotes.push({
				type: type,
				origin: {
					name: this._getLoggerName(),
					rundownId: this._rundownId,
					segmentId: this._segmentId,
					partId: this._partId
				},
				message: message
			})
		} else {
			if (type === NoteType.WARNING) {
				logger.warn(`Warning from "${this._getLoggerName()}": "${message}"\n(${this.getLoggerIdentifier()})`)
			} else {
				logger.error(`Error from "${this._getLoggerName()}": "${message}"\n(${this.getLoggerIdentifier()})`)
			}
		}
	}
	private _getLoggerName (): string {
		return this._contextName

	}
}

/** Studio */

export class StudioConfigContext implements IStudioConfigContext {
	protected readonly studio: Studio
	constructor (studio: Studio) {
		this.studio = studio
	}

	getStudio (): Readonly<Studio> {
		return this.studio
	}
	getStudioConfig (): Readonly<{[key: string]: ConfigItemValue}> {
		return compileStudioConfig(this.studio)
	}
	getStudioConfigRef (configKey: string): string {
		return ConfigRef.getStudioConfigRef(this.studio._id, configKey)
	}
}

export class StudioContext extends StudioConfigContext implements IStudioContext {
	getStudioMappings (): Readonly<BlueprintMappings> {
		return this.studio.mappings
	}
}

/** Show Style Variant */

export class ShowStyleContext extends StudioContext implements IShowStyleContext {
	private showStyleBaseId: ShowStyleBaseId
	private showStyleVariantId: ShowStyleVariantId

	private notes: NotesContext

	constructor (
		studio: Studio,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId,
		contextName?: string,
		rundownId?: RundownId,
		segmentId?: SegmentId,
		partId?: PartId
	) {
		super(studio)

		this.showStyleBaseId = showStyleBaseId
		this.showStyleVariantId = showStyleVariantId
		this.notes = new NotesContext(contextName || studio.name, rundownId || protectString(''), segmentId, partId)
	}

	get handleNotesExternally () {
		return this.notes.handleNotesExternally
	}
	set handleNotesExternally (val: boolean) {
		this.notes.handleNotesExternally = val
	}

	getShowStyleBase (): ShowStyleBase {
		const showStyleBase = ShowStyleBases.findOne(this.showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, 'ShowStyleBase "' + this.showStyleBaseId + '" not found')

		return showStyleBase
	}
	getShowStyleConfig (): {[key: string]: ConfigItemValue} {
		const showStyleCompound = getShowStyleCompound(this.showStyleVariantId)
		if (!showStyleCompound) throw new Meteor.Error(404, `no showStyleCompound for "${this.showStyleVariantId}"`)

		const res: {[key: string]: ConfigItemValue} = {}
		_.each(showStyleCompound.config, (c) => {
			res[c._id] = c.value
		})
		return res
	}
	getShowStyleConfigRef (configKey: string): string {
		return ConfigRef.getShowStyleConfigRef(this.showStyleVariantId, configKey)
	}

	/** NotesContext */
	error (message: string) {
		this.notes.error(message)
	}
	warning (message: string) {
		this.notes.warning(message)
	}
	getNotes () {
		return this.notes.getNotes()
	}
	getHashId (str: string, isNotUnique?: boolean) {
		return this.notes.getHashId(str, isNotUnique)
	}
	unhashId (hash: string) {
		return this.notes.unhashId(hash)
	}
}

/** Rundown */

export class RundownContext extends ShowStyleContext implements IRundownContext {
	readonly rundownId: string
	readonly rundown: Readonly<IBlueprintRundownDB>
	readonly _rundown: Rundown
	readonly playlistId: RundownPlaylistId

	constructor (rundown: Rundown, studio?: Studio, contextName?: string, segmentId?: SegmentId, partId?: PartId) {
		super(studio || rundown.getStudio(), rundown.showStyleBaseId, rundown.showStyleVariantId, contextName || rundown.name, rundown._id, segmentId, partId)

		this.rundownId = unprotectString(rundown._id)
		this.rundown = unprotectObject(rundown)
		this._rundown = rundown
		this.playlistId = rundown.playlistId
	}
}

export type BlueprintRuntimeArgumentsSet = { [key: string]: BlueprintRuntimeArguments | undefined }
export class SegmentContext extends RundownContext implements ISegmentContext {
	private readonly runtimeArguments: Readonly<BlueprintRuntimeArgumentsSet>
	private readonly segment: Readonly<Segment>

	constructor (rundown: Rundown, studio: Studio | undefined, runtimeArguments: BlueprintRuntimeArgumentsSet | DBPart[], contextName: string) {
		super(rundown, studio, contextName)

		if (_.isArray(runtimeArguments)) {
			const existingRuntimeArguments: BlueprintRuntimeArgumentsSet = {}
			_.each(runtimeArguments, p => {
				if (p.runtimeArguments) {
					existingRuntimeArguments[p.externalId] = p.runtimeArguments
				}
			})
			this.runtimeArguments = existingRuntimeArguments
		} else {
			this.runtimeArguments = runtimeArguments
		}
	}

	getRuntimeArguments (externalId: string): BlueprintRuntimeArguments | undefined {
		return this.runtimeArguments[externalId]
	}
}

export class PartContext extends RundownContext implements IPartContext {
	private readonly runtimeArguments: Readonly<BlueprintRuntimeArguments>

	constructor (rundown: Rundown, studio: Studio | undefined, runtimeArguments: BlueprintRuntimeArguments, contextName: string) {
		super(rundown, studio, contextName)

		this.runtimeArguments = runtimeArguments
	}

	getRuntimeArguments (): BlueprintRuntimeArguments {
		return this.runtimeArguments
	}
}

/** Events */

export class EventContext extends CommonContext implements IEventContext {
	// TDB: Certain actions that can be triggered in Core by the Blueprint
}

export class PartEventContext extends RundownContext implements IPartEventContext {
	readonly part: Readonly<IBlueprintPartInstance>

	constructor (rundown: Rundown, studio: Studio | undefined, partInstance: PartInstance) {
		super(rundown, studio)

		this.part = unprotectPartInstance(partInstance)
	}
}

export class AsRunEventContext extends RundownContext implements IAsRunEventContext {
	public readonly asRunEvent: Readonly<IBlueprintAsRunLogEvent>

	constructor (rundown: Rundown, studio: Studio | undefined, asRunEvent: AsRunLogEvent) {
		super(rundown, studio)
		this.asRunEvent = unprotectObject(asRunEvent)
	}

	/** Get all asRunEvents in the rundown */
	getAllAsRunEvents (): Array<IBlueprintAsRunLogEvent> {
		return unprotectObjectArray(AsRunLog.find({
			rundownId: this._rundown._id
		}, {
			sort: {
				timestamp: 1
			}
		}).fetch())
	}
	/** Get all segments in this rundown */
	getSegments (): Array<IBlueprintSegmentDB> {
		return unprotectObjectArray(this._rundown.getSegments())
	}
	/**
	 * Returns a segment
	 * @param segmentId Id of segment to fetch. If is omitted, return the segment related to this AsRunEvent
	 */
	getSegment (segmentId?: string): IBlueprintSegmentDB | undefined {
		segmentId = segmentId || this.asRunEvent.segmentId
		check(segmentId, String)
		if (segmentId) {
			return unprotectObject(this._rundown.getSegments({
				_id: protectString(segmentId)
			})[0])
		}
	}
	/** Get all parts in this rundown */
	getParts (): Array<IBlueprintPartDB> {
		return unprotectObjectArray(this._rundown.getParts())
	}
	/** Get the part related to this AsRunEvent */
	getPartInstance (partInstanceId?: string): IBlueprintPartInstance | undefined {
		partInstanceId = partInstanceId || this.asRunEvent.partInstanceId
		check(partInstanceId, String)
		if (partInstanceId) {
			return unprotectPartInstance(this._rundown.getAllPartInstances({
				_id: protectString(partInstanceId)
			})[0])
		}
	}
	/** Get the mos story related to a part */
	getIngestDataForPart (part: IBlueprintPartDB): IngestPart | undefined {
		check(part._id, String)

		try {
			return loadIngestDataCachePart(this._rundown._id, this.rundown.externalId, protectString<PartId>(part._id), part.externalId).data
		} catch (e) {
			return undefined
		}
	}
	getIngestDataForPartInstance (partInstance: IBlueprintPartInstance): IngestPart | undefined {
		return this.getIngestDataForPart(partInstance.part)
	}
	/** Get the mos story related to the rundown */
	getIngestDataForRundown (): IngestRundown | undefined {
		try {
			return loadCachedRundownData(this._rundown._id, this.rundown.externalId)
		} catch (e) {
			return undefined
		}
	}

	/**
	 * Returns a piece.
	 * @param id Id of piece to fetch. If omitted, return the piece related to this AsRunEvent
	 */
	getPieceInstance (pieceInstanceId?: string): IBlueprintPieceInstance | undefined {
		check(pieceInstanceId, Match.Optional(String))
		pieceInstanceId = pieceInstanceId || this.asRunEvent.pieceInstanceId
		if (pieceInstanceId) {
			return unprotectPieceInstance(PieceInstances.findOne({
				rundownId: this._rundown._id,
				_id: protectString(pieceInstanceId)
			}))
		}
	}
	/**
	 * Returns pieces in a part
	 * @param id Id of part to fetch pieces in
	 */
	getPieceInstances (partInstanceId: string): Array<IBlueprintPieceInstance> {
		check(partInstanceId, String)
		if (partInstanceId) {
			return unprotectObjectArray(PieceInstances.find({
				rundownId: this._rundown._id,
				partInstanceId: protectString(partInstanceId)
			}).fetch()) as any // pieceinstande.piece is the issue
		}
		return []
	}

	formatDateAsTimecode (time: number): string {
		check(time, Number)
		return formatDateAsTimecode(new Date(time))
	}
	formatDurationAsTimecode (time: number): string {
		check(time, Number)
		return formatDurationAsTimecode(time)
	}
	protected getLoggerIdentifier (): string {
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
