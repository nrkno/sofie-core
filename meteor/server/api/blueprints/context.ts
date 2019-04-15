import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { getHash, formatDateAsTimecode, formatDurationAsTimecode } from '../../../lib/lib'
import { SegmentLineNote, SegmentLineNoteType, SegmentLine, DBSegmentLine } from '../../../lib/collections/SegmentLines'
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
	IBlueprintSegmentLineDB,
	IngestPart
} from 'tv-automation-sofie-blueprints-integration'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { ConfigRef, compileStudioConfig } from './config'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { getShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { AsRunLogEvent, AsRunLog } from '../../../lib/collections/AsRunLog'
import { CachePrefix } from '../../../lib/collections/RundownDataCache'
import { Pieces } from '../../../lib/collections/Pieces'

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
	private _segmentLineId?: string

	private savedNotes: Array<SegmentLineNote> = []

	constructor (
		contextName: string,
		rundownId: string,
		segmentId?: string,
		segmentLineId?: string,
	) {
		super(
			rundownId +
			(
				segmentLineId ? '_' + segmentLineId :
				(
					segmentId ? '_' + segmentId : ''
				)
			)
		)
		this._contextName		= contextName

		// TODO - we should fill these in just before inserting into the DB instead
		this._rundownId	= rundownId
		this._segmentId			= segmentId
		this._segmentLineId		= segmentLineId

	}
	/** Throw Error and display message to the user in the GUI */
	error (message: string) {
		check(message, String)
		logger.error('Error from blueprint: ' + message)
		this._pushNote(
			SegmentLineNoteType.ERROR,
			message
		)
		throw new Meteor.Error(500, message)
	}
	/** Save note, which will be displayed to the user in the GUI */
	warning (message: string) {
		check(message, String)
		this._pushNote(
			SegmentLineNoteType.WARNING,
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
		if (this._segmentLineId) ids.push('segmentLineId: ' + this._segmentLineId)
		return ids.join(',')
	}
	private _pushNote (type: SegmentLineNoteType, message: string) {
		if (this.handleNotesExternally) {
			this.savedNotes.push({
				type: type,
				origin: {
					name: this._getLoggerName(),
					rundownId: this._rundownId,
					segmentId: this._segmentId,
					segmentLineId: this._segmentLineId
				},
				message: message
			})
		} else {
			if (type === SegmentLineNoteType.WARNING) {
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
	protected readonly studioInstallation: StudioInstallation
	constructor (studioInstallation: StudioInstallation) {
		this.studioInstallation = studioInstallation
	}

	getStudioInstallation (): StudioInstallation {
		const studio = StudioInstallations.findOne(this.studioInstallation._id)
		if (!studio) throw new Meteor.Error(404, 'StudioInstallation "' + this.studioInstallation._id + '" not found')

		return studio
	}
	getStudioConfig (): {[key: string]: ConfigItemValue} {
		return compileStudioConfig(this.getStudioInstallation())
	}
	getStudioConfigRef (configKey: string): string {
		return ConfigRef.getStudioConfigRef(this.studioInstallation._id, configKey)
	}
}

export class StudioContext extends StudioConfigContext implements IStudioContext {
	getStudioMappings (): BlueprintMappings {
		return this.studioInstallation.mappings
	}
}

/** Show Style Variant */

export class ShowStyleContext extends StudioContext implements IShowStyleContext {
	private showStyleBaseId: string
	private showStyleVariantId: string

	private notes: NotesContext

	constructor (studioInstallation: StudioInstallation, showStyleBaseId: string, showStyleVariantId: string, contextName?: string, rundownId?: string, segmentId?: string, segmentLineId?: string) {
		super(studioInstallation)

		this.showStyleBaseId = showStyleBaseId
		this.showStyleVariantId = showStyleVariantId
		this.notes = new NotesContext(contextName || studioInstallation.name, rundownId || '', segmentId, segmentLineId)
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

	constructor (rundown: Rundown, studioInstallation?: StudioInstallation, contextName?: string, segmentId?: string, segmentLineId?: string) {
		super(studioInstallation || rundown.getStudioInstallation(), rundown.showStyleBaseId, rundown.showStyleVariantId, contextName || rundown.name, rundown._id, segmentId, segmentLineId)

		this.rundownId = rundown._id
		this.rundown = rundown
	}
}

export type BlueprintRuntimeArgumentsSet = { [key: string]: BlueprintRuntimeArguments }
export class SegmentContext extends RundownContext implements ISegmentContext {
	private runtimeArguments: BlueprintRuntimeArgumentsSet

	constructor (rundown: Rundown, studioInstallation: StudioInstallation | undefined, runtimeArguments: BlueprintRuntimeArgumentsSet | DBSegmentLine[]) {
		super(rundown, studioInstallation)

		if (_.isArray(runtimeArguments)) {
			const existingRuntimeArguments: BlueprintRuntimeArgumentsSet = {}
			_.each(runtimeArguments, p => {
				if (p.runtimeArguments) {
					// TODO - what about collisions from virtuals?
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

	constructor (rundown: Rundown, studioInstallation: StudioInstallation | undefined, runtimeArguments: BlueprintRuntimeArguments) {
		super(rundown, studioInstallation)

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
	part: IBlueprintSegmentLineDB

	constructor (rundown: Rundown, studioInstallation: StudioInstallation | undefined, part: IBlueprintSegmentLineDB) {
		super(rundown, studioInstallation)

		this.part = part
	}
}

export class AsRunEventContext extends RundownContext implements IAsRunEventContext {

	public asRunEvent: AsRunLogEvent

	constructor (rundown: Rundown, studioInstallation: StudioInstallation | undefined, asRunEvent: AsRunLogEvent) {
		super(rundown, studioInstallation)
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
	/** Get all segmentLines in this rundown */
	getSegmentLines (): Array<SegmentLine> {
		return this.rundown.getSegmentLines()
	}
	/** Get the segmentLine related to this AsRunEvent */
	getSegmentLine (id?: string): SegmentLine | undefined {
		id = id || this.asRunEvent.segmentLineId
		check(id, String)
		if (id) {
			return this.rundown.getSegmentLines({
				_id: id
			})[0]
		}
	}
	/** Get the mos story related to a segmentLine */
	getStoryForSegmentLine (segmentLine: SegmentLine): IngestPart {
		let segmentLineId = segmentLine._id
		check(segmentLineId, String)
		return this.rundown.fetchCache(CachePrefix.INGEST_PART + segmentLineId)
	}
	/** Get the mos story related to the rundown */
	getStoryForRundown (): IngestRundown {
		return this.rundown.fetchCache(CachePrefix.INGEST_RUNDOWN + this.rundown._id)
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
	 * Returns pieces in a segmentLine
	 * @param id Id of segmentLine to fetch items in
	 */
	getPieces (segmentLineId: string): Array<IBlueprintPiece> {
		check(segmentLineId, String)
		if (segmentLineId) {
			return Pieces.find({
				rundownId: this.rundown._id,
				segmentLineId: segmentLineId
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
		if (this.asRunEvent.segmentLineId) ids.push('segmentLineId: ' + this.asRunEvent.segmentLineId)
		if (this.asRunEvent.pieceId) ids.push('pieceId: ' + this.asRunEvent.pieceId)
		if (this.asRunEvent.timelineObjectId) ids.push('timelineObjectId: ' + this.asRunEvent.timelineObjectId)
		return ids.join(',')
	}
}
