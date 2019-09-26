import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { getHash, formatDateAsTimecode, formatDurationAsTimecode } from '../../../lib/lib'
import { Part, DBPart } from '../../../lib/collections/Parts'
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
	IBlueprintPiece,
	IBlueprintSegmentDB,
	IngestRundown,
	IBlueprintPartDB,
	IngestPart
} from 'tv-automation-sofie-blueprints-integration'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { ConfigRef, compileStudioconfig } from './config'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { getShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { AsRunLogEvent, AsRunLog } from '../../../lib/collections/AsRunLog'
import { Pieces } from '../../../lib/collections/Pieces'
import { PartNote, NoteType } from '../../../lib/api/notes'
import { loadCachedIngestPart, loadCachedRundownData } from '../ingest/ingestCache'

/** Common */

export class CommonContext implements ICommonContext {

	private _idPrefix: string = ''
	private hashI = 0
	private hashed: {[hash: string]: string} = {}

	constructor (idPrefix: string) {
		this._idPrefix = idPrefix
	}
	getHashId (str?: any) {

		if (!str) str = 'hash' + (this.hashI++)

		let id
		id = getHash(
			this._idPrefix + '_' +
			str.toString()
		)
		this.hashed[id] = str
		return id
		// return Random.id()
	}
	unhashId (hash: string): string {
		return this.hashed[hash] || hash
	}
}

export class NotesContext extends CommonContext implements INotesContext {

	/** If the notes will be handled externally (using .getNotes()), set this to true */
	public handleNotesExternally: boolean = false

	protected _rundownId: string
	private _contextName: string
	private _segmentId?: string
	private _partId?: string

	private savedNotes: Array<PartNote> = []

	constructor (
		contextName: string,
		rundownId: string,
		segmentId?: string,
		partId?: string,
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

	getStudio (): Studio {
		const studio = Studios.findOne(this.studio._id)
		if (!studio) throw new Meteor.Error(404, 'Studio "' + this.studio._id + '" not found')

		return studio
	}
	getStudioConfig (): {[key: string]: ConfigItemValue} {
		return compileStudioconfig(this.getStudio())
	}
	getStudioConfigRef (configKey: string): string {
		return ConfigRef.getStudioConfigRef(this.studio._id, configKey)
	}
}

export class StudioContext extends StudioConfigContext implements IStudioContext {
	getStudioMappings (): BlueprintMappings {
		return this.studio.mappings
	}
}

/** Show Style Variant */

export class ShowStyleContext extends StudioContext implements IShowStyleContext {
	private showStyleBaseId: string
	private showStyleVariantId: string

	private notes: NotesContext

	constructor (studio: Studio, showStyleBaseId: string, showStyleVariantId: string, contextName?: string, rundownId?: string, segmentId?: string, partId?: string) {
		super(studio)

		this.showStyleBaseId = showStyleBaseId
		this.showStyleVariantId = showStyleVariantId
		this.notes = new NotesContext(contextName || studio.name, rundownId || '', segmentId, partId)
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
	getShowStyleRef (configKey: string): string { // to be deprecated
		return this.getShowStyleConfigRef(configKey)
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
	getHashId (str?: any) {
		return this.notes.getHashId(str)
	}
	unhashId (hash: string) {
		return this.notes.unhashId(hash)
	}
}

/** Rundown */

export class RundownContext extends ShowStyleContext implements IRundownContext {
	rundownId: string
	rundown: Rundown

	constructor (rundown: Rundown, studio?: Studio, contextName?: string, segmentId?: string, partId?: string) {
		super(studio || rundown.getStudio(), rundown.showStyleBaseId, rundown.showStyleVariantId, contextName || rundown.name, rundown._id, segmentId, partId)

		this.rundownId = rundown._id
		this.rundown = rundown
	}
}

export type BlueprintRuntimeArgumentsSet = { [key: string]: BlueprintRuntimeArguments }
export class SegmentContext extends RundownContext implements ISegmentContext {
	private runtimeArguments: BlueprintRuntimeArgumentsSet

	constructor (rundown: Rundown, studio: Studio | undefined, runtimeArguments: BlueprintRuntimeArgumentsSet | DBPart[]) {
		super(rundown, studio)

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
	private runtimeArguments: BlueprintRuntimeArguments

	constructor (rundown: Rundown, studio: Studio | undefined, runtimeArguments: BlueprintRuntimeArguments) {
		super(rundown, studio)

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
	part: IBlueprintPartDB

	constructor (rundown: Rundown, studio: Studio | undefined, part: IBlueprintPartDB) {
		super(rundown, studio)

		this.part = part
	}
}

export class AsRunEventContext extends RundownContext implements IAsRunEventContext {

	public asRunEvent: AsRunLogEvent

	constructor (rundown: Rundown, studio: Studio | undefined, asRunEvent: AsRunLogEvent) {
		super(rundown, studio)
		this.asRunEvent = asRunEvent
	}

	/** Get all asRunEvents in the rundown */
	getAllAsRunEvents (): Array<AsRunLogEvent> {
		return AsRunLog.find({
			rundownId: this.rundown._id
		}, {
			sort: {
				timestamp: 1
			}
		}).fetch()
	}
	/** Get all segments in this rundown */
	getSegments (): Array<IBlueprintSegmentDB> {
		return this.rundown.getSegments()
	}
	/**
	 * Returns a segment
	 * @param id Id of segment to fetch. If is omitted, return the segment related to this AsRunEvent
	 */
	getSegment (id?: string): IBlueprintSegmentDB | undefined {
		id = id || this.asRunEvent.segmentId
		check(id, String)
		if (id) {
			return this.rundown.getSegments({
				_id: id
			})[0]
		}
	}
	/** Get all parts in this rundown */
	getParts (): Array<Part> {
		return this.rundown.getParts()
	}
	/** Get the part related to this AsRunEvent */
	getPart (id?: string): Part | undefined {
		id = id || this.asRunEvent.partId
		check(id, String)
		if (id) {
			return this.rundown.getParts({
				_id: id
			})[0]
		}
	}
	/** Get the mos story related to a part */
	getIngestDataForPart (part: IBlueprintPartDB): IngestPart | undefined {
		check(part._id, String)

		return loadCachedIngestPart(this.rundown._id, this.rundown.externalId, part._id, part.externalId)
	}
	/** Get the mos story related to the rundown */
	getIngestDataForRundown (): IngestRundown | undefined {
		return loadCachedRundownData(this.rundown._id, this.rundown.externalId)
	}

	/**
	 * Returns a piece.
	 * @param id Id of piece to fetch. If omitted, return the piece related to this AsRunEvent
	 */
	getPiece (pieceId?: string): IBlueprintPiece | undefined {
		check(pieceId, Match.Optional(String))
		pieceId = pieceId || this.asRunEvent.pieceId
		if (pieceId) {
			return Pieces.findOne({
				rundownId: this.rundown._id,
				_id: pieceId
			})
		}
	}
	/**
	 * Returns pieces in a part
	 * @param id Id of part to fetch pieces in
	 */
	getPieces (partId: string): Array<IBlueprintPiece> {
		check(partId, String)
		if (partId) {
			return Pieces.find({
				rundownId: this.rundown._id,
				partId: partId
			}).fetch()
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
		if (this.asRunEvent.partId) ids.push('partId: ' + this.asRunEvent.partId)
		if (this.asRunEvent.pieceId) ids.push('pieceId: ' + this.asRunEvent.pieceId)
		if (this.asRunEvent.timelineObjectId) ids.push('timelineObjectId: ' + this.asRunEvent.timelineObjectId)
		return ids.join(',')
	}
}
