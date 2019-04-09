import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { getHash, formatDateAsTimecode, formatDurationAsTimecode } from '../../../lib/lib'
import { SegmentLineNote, SegmentLineNoteType, SegmentLine } from '../../../lib/collections/SegmentLines'
import { check, Match } from 'meteor/check'
import { logger } from '../../../lib/logging'
import {
	ICommonContext,
	NotesContext as INotesContext,
	ShowStyleContext as IShowStyleContext,
	RunningOrderContext as IRunningOrderContext,
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
	IBlueprintSegment,
	IBlueprintSegmentLineItem,
	IBlueprintSegmentDB,
	IngestRunningOrder,
	IBlueprintSegmentLineDB,
	IngestPart
} from 'tv-automation-sofie-blueprints-integration'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { ConfigRef, compileStudioConfig } from './config'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { getShowStyleCompound, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { AsRunLogEvent, AsRunLog } from '../../../lib/collections/AsRunLog'
import { CachePrefix } from '../../../lib/collections/RunningOrderDataCache'
import { SegmentLineItems } from '../../../lib/collections/SegmentLineItems'

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

	protected _runningOrderId: string
	private _contextName: string
	private _segmentId?: string
	private _segmentLineId?: string

	private savedNotes: Array<SegmentLineNote> = []

	constructor (
		contextName: string,
		runningOrderId: string,
		segmentId?: string,
		segmentLineId?: string,
	) {
		super(
			runningOrderId +
			(
				segmentLineId ? '_' + segmentLineId :
				(
					segmentId ? '_' + segmentId : ''
				)
			)
		)
		this._contextName		= contextName

		// TODO - we should fill these in just before inserting into the DB instead
		this._runningOrderId	= runningOrderId
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
		if (this._runningOrderId) ids.push('roId: ' + this._runningOrderId)
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
					roId: this._runningOrderId,
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

	constructor (studioInstallation: StudioInstallation, showStyleBaseId: string, showStyleVariantId: string, contextName?: string, runningOrderId?: string, segmentId?: string, segmentLineId?: string) {
		super(studioInstallation)

		this.showStyleBaseId = showStyleBaseId
		this.showStyleVariantId = showStyleVariantId
		this.notes = new NotesContext(contextName || studioInstallation.name, runningOrderId || '', segmentId, segmentLineId)
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

/** Running Order */

export class RunningOrderContext extends ShowStyleContext implements IRunningOrderContext {
	runningOrderId: string
	runningOrder: RunningOrder

	constructor (runningOrder: RunningOrder, studioInstallation?: StudioInstallation, contextName?: string, segmentId?: string, segmentLineId?: string) {
		super(studioInstallation || runningOrder.getStudioInstallation(), runningOrder.showStyleBaseId, runningOrder.showStyleVariantId, contextName || runningOrder.name, runningOrder._id, segmentId, segmentLineId)

		this.runningOrderId = runningOrder._id
		this.runningOrder = runningOrder
	}
}

export type BlueprintRuntimeArgumentsSet = { [key: string]: BlueprintRuntimeArguments }
export class SegmentContext extends RunningOrderContext implements ISegmentContext {
	private runtimeArguments: BlueprintRuntimeArgumentsSet

	constructor (runningOrder: RunningOrder, studioInstallation: StudioInstallation | undefined, runtimeArguments: BlueprintRuntimeArgumentsSet) {
		super(runningOrder, studioInstallation)

		this.runtimeArguments = runtimeArguments
	}

	getRuntimeArguments (externalId: string): BlueprintRuntimeArguments | undefined {
		return this.runtimeArguments[externalId]
	}
}

export class PartContext extends RunningOrderContext implements IPartContext {
	private runtimeArguments: BlueprintRuntimeArguments

	constructor (runningOrder: RunningOrder, studioInstallation: StudioInstallation | undefined, runtimeArguments: BlueprintRuntimeArguments) {
		super(runningOrder, studioInstallation)

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

export class PartEventContext extends RunningOrderContext implements IPartEventContext {
	part: IBlueprintSegmentLineDB

	constructor (runningOrder: RunningOrder, studioInstallation: StudioInstallation | undefined, part: IBlueprintSegmentLineDB) {
		super(runningOrder, studioInstallation)

		this.part = part
	}
}

export class AsRunEventContext extends RunningOrderContext implements IAsRunEventContext {

	public asRunEvent: AsRunLogEvent

	constructor (runningOrder: RunningOrder, studioInstallation: StudioInstallation | undefined, asRunEvent: AsRunLogEvent) {
		super(runningOrder, studioInstallation)
		this.asRunEvent = asRunEvent
	}

	/** Get all asRunEvents in the runningOrder */
	getAllAsRunEvents (): Array<AsRunLogEvent> {
		return AsRunLog.find({
			runningOrderId: this.runningOrder._id
		}, {
			sort: {
				timestamp: 1
			}
		}).fetch()
	}
	/** Get all segments in this runningOrder */
	getSegments (): Array<IBlueprintSegmentDB> {
		return this.runningOrder.getSegments()
	}
	/**
	 * Returns a segment
	 * @param id Id of segment to fetch. If is omitted, return the segment related to this AsRunEvent
	 */
	getSegment (id?: string): IBlueprintSegmentDB | undefined {
		id = id || this.asRunEvent.segmentId
		check(id, String)
		if (id) {
			return this.runningOrder.getSegments({
				_id: id
			})[0]
		}
	}
	/** Get all segmentLines in this runningOrder */
	getSegmentLines (): Array<SegmentLine> {
		return this.runningOrder.getSegmentLines()
	}
	/** Get the segmentLine related to this AsRunEvent */
	getSegmentLine (id?: string): SegmentLine | undefined {
		id = id || this.asRunEvent.segmentLineId
		check(id, String)
		if (id) {
			return this.runningOrder.getSegmentLines({
				_id: id
			})[0]
		}
	}
	/** Get the mos story related to a segmentLine */
	getStoryForSegmentLine (segmentLine: SegmentLine): IngestPart {
		let segmentLineId = segmentLine._id
		check(segmentLineId, String)
		return this.runningOrder.fetchCache(CachePrefix.FULLSTORY + segmentLineId)
	}
	/** Get the mos story related to the runningOrder */
	getStoryForRunningOrder (): IngestRunningOrder {
		return this.runningOrder.fetchCache(CachePrefix.ROCREATE + this.runningOrder._id)
	}
	/**
	 * Returns a segmentLineItem.
	 * @param id Id of segmentLineItem to fetch. If omitted, return the segmentLineItem related to this AsRunEvent
	 */
	getSegmentLineItem (segmentLineItemId?: string): IBlueprintSegmentLineItem | undefined {
		check(segmentLineItemId, Match.Optional(String))
		segmentLineItemId = segmentLineItemId || this.asRunEvent.segmentLineItemId
		if (segmentLineItemId) {
			return SegmentLineItems.findOne({
				runningOrderId: this.runningOrder._id,
				_id: segmentLineItemId
			})
		}
	}
	/**
	 * Returns segmentLineItems in a segmentLine
	 * @param id Id of segmentLine to fetch items in
	 */
	getSegmentLineItems (segmentLineId: string): Array<IBlueprintSegmentLineItem> {
		check(segmentLineId, String)
		if (segmentLineId) {
			return SegmentLineItems.find({
				runningOrderId: this.runningOrder._id,
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
		if (this.runningOrderId) ids.push('roId: ' + this.runningOrderId)
		if (this.asRunEvent.segmentId) ids.push('segmentId: ' + this.asRunEvent.segmentId)
		if (this.asRunEvent.segmentLineId) ids.push('segmentLineId: ' + this.asRunEvent.segmentLineId)
		if (this.asRunEvent.segmentLineItemId) ids.push('segmentLineItemId: ' + this.asRunEvent.segmentLineItemId)
		if (this.asRunEvent.timelineObjectId) ids.push('timelineObjectId: ' + this.asRunEvent.timelineObjectId)
		return ids.join(',')
	}
}
