import * as _ from 'underscore'
import * as moment from 'moment'
import { SaferEval } from 'safer-eval'
import { SegmentLine, DBSegmentLine, SegmentLineNote, SegmentLineNoteType, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { formatDateAsTimecode, formatDurationAsTimecode, literal, normalizeArray, getCurrentTime } from '../../lib/lib'
import { getHash } from '../lib'
import { logger } from '../logging'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { TimelineObj } from '../../lib/collections/Timeline'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import {
	BlueprintManifest,
	ICommonContext,
	MOS,
	ConfigItemValue,
	TimelineObjectCoreExt,
	IBlueprintSegmentLineItem,
	IBlueprintSegmentLineAdLibItem,
	BlueprintRuntimeArguments,
	NotesContext as INotesContext,
	RunningOrderContextPure as IRunningOrderContextPure,
	RunningOrderContext as IRunningOrderContext,
	SegmentContextPure as ISegmentContextPure,
	SegmentContext as ISegmentContext,
	SegmentLineContextPure as ISegmentLineContextPure,
	SegmentLineContext as ISegmentLineContext,
	EventContext as IEventContext,
	AsRunEventContext as IAsRunEventContext
} from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from '../../lib/api/runningOrder'

import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import * as bodyParser from 'body-parser'
import { Random } from 'meteor/random'
import { getShowStyleCompound } from '../../lib/collections/ShowStyleVariants'
import { check, Match } from 'meteor/check'
import { parse as parseUrl } from 'url'
import { BlueprintAPI } from '../../lib/api/blueprint'
import { Methods, setMeteorMethods, wrapMethods } from '../methods'
import { parseVersion } from '../../lib/collections/CoreSystem'
import { Segment } from '../../lib/collections/Segments'
import { AsRunLogEvent, AsRunLog } from '../../lib/collections/AsRunLog'
import { CachePrefix } from '../../lib/collections/RunningOrderDataCache'

// export { MOS, RunningOrder, SegmentLine, ISegmentLineContext }
export class CommonContext implements ICommonContext {

	private _idPrefix: string = ''
	private hashI = 0
	private hashed: {[hash: string]: string} = {}

	constructor (idPrefix) {
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

	private _runningOrderId: string
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
		this._runningOrderId	= runningOrderId
		this._segmentId			= segmentId
		this._segmentLineId		= segmentLineId

	}
	/** Throw Error and display message to the user in the GUI */
	error (message: string) {
		logger.error('Error from blueprint: ' + message)
		this._pushNote(
			SegmentLineNoteType.ERROR,
			message
		)
		throw new Meteor.Error(500, message)
	}
	/** Save note, which will be displayed to the user in the GUI */
	warning (message: string) {
		this._pushNote(
			SegmentLineNoteType.WARNING,
			message
		)
	}
	getNotes () {
		return this.savedNotes
	}
	private _pushNote (type: SegmentLineNoteType, message: string) {
		this.savedNotes.push({
			type: SegmentLineNoteType.WARNING,
			origin: {
				name: this._getLoggerName(),
				roId: this._runningOrderId,
				segmentId: this._segmentId,
				segmentLineId: this._segmentLineId
			},
			message: message
		})
	}
	private _getLoggerName () {
		return this._contextName

	}
}

export class RunningOrderContext extends NotesContext implements IRunningOrderContext {
	runningOrderId: string
	runningOrder: RunningOrder

	constructor (runningOrder: RunningOrder, contextName?: string) {
		super(contextName || runningOrder.name, runningOrder._id)

		this.runningOrderId = runningOrder._id
		this.runningOrder = runningOrder
	}

	getStudioInstallation (): StudioInstallation {
		const studio = StudioInstallations.findOne(this.runningOrder.studioInstallationId)
		if (!studio) throw new Meteor.Error(404, 'StudioInstallation "' + this.runningOrder.studioInstallationId + '" not found')

		return studio
	}
	getShowStyleBase (): ShowStyleBase {
		const showStyleBase = ShowStyleBases.findOne(this.runningOrder.showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, 'ShowStyleBase "' + this.runningOrder.showStyleBaseId + '" not found')

		return showStyleBase
	}
	getStudioConfig (): {[key: string]: ConfigItemValue} {
		const studio: StudioInstallation = this.getStudioInstallation()

		const res: {[key: string]: ConfigItemValue} = {}
		_.each(studio.config, (c) => {
			res[c._id] = c.value
		})

		// Expose special values as defined in the studio
		res['SofieHostURL'] = studio.settings.sofieUrl

		return res
	}
	getShowStyleConfig (): {[key: string]: ConfigItemValue} {
		const showStyleCompound = getShowStyleCompound(this.runningOrder.showStyleVariantId)
		if (!showStyleCompound) throw new Meteor.Error(404, `no showStyleCompound for "${this.runningOrder.showStyleVariantId}"`)

		const res: {[key: string]: ConfigItemValue} = {}
		_.each(showStyleCompound.config, (c) => {
			res[c._id] = c.value
		})
		return res
	}
	/** return segmentLines in this runningOrder */
	getSegmentLines (): Array<SegmentLine> {
		return this.runningOrder.getSegmentLines()
	}
}
export class SegmentLineContext extends RunningOrderContext implements ISegmentLineContext {
	readonly segmentLine: SegmentLine
	constructor (runningOrder: RunningOrder, segmentLine: SegmentLine, story?: MOS.IMOSStory) {
		super(runningOrder, ((story ? story.Slug : '') || segmentLine.mosId) + '')

		this.segmentLine = segmentLine

	}
	getRuntimeArguments (): BlueprintRuntimeArguments {
		return this.segmentLine.runtimeArguments || {}
	}
	getSegmentLineIndex (): number {
		return this.getSegmentLines().findIndex((sl: SegmentLine) => sl._id === this.segmentLine._id)
	}
	/** return segmentLines in this segment */
	getSegmentLines (): Array<SegmentLine> {
		return super.getSegmentLines().filter((sl: SegmentLine) => sl.segmentId === this.segmentLine.segmentId)
	}
}

export class EventContext extends CommonContext implements IEventContext {
	// TDB: Certain actions that can be triggered in Core by the Blueprint
}
export class AsRunEventContext extends RunningOrderContext implements IAsRunEventContext {

	public asRunEvent: AsRunLogEvent

	constructor (runningOrder: RunningOrder) {
		super(runningOrder)
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
	/** Get all segmentLines in this runningOrder */
	getSegmentLines (): Array<SegmentLine> {
		return this.runningOrder.getSegmentLines()
	}
	/** Get the segmentLine related to this AsRunEvent */
	getSegmentLine (): SegmentLine | undefined {
		if (this.asRunEvent.segmentLineId) {
			return SegmentLines.findOne(this.asRunEvent.segmentLineId)
		}
	}
	/** Get the mos story related to a segmentLine */
	getStoryForSegmentLine (segmentLine: SegmentLine): MOS.IMOSROFullStory {
		return this.runningOrder.fetchCache(CachePrefix.FULLSTORY + segmentLine._id)
	}
	/** Get the mos story related to the runningOrder */
	getStoryForRunningOrder (): MOS.IMOSRunningOrder {
		return this.runningOrder.fetchCache(CachePrefix.ROCREATE + this.runningOrder._id)
	}
	formatDateAsTimecode (time: number): string {
		return formatDateAsTimecode(new Date(time))
	}
	formatDurationAsTimecode (time: number): string {
		return formatDurationAsTimecode(time)
	}
}
export function insertBlueprint (name?: string): string {
	return Blueprints.insert({
		_id: Random.id(),
		name: name || 'Default Blueprint',
		code: '',
		modified: getCurrentTime(),
		created: getCurrentTime(),

		studioConfigManifest: [],
		showStyleConfigManifest: [],

		databaseVersion: {
			studio: {},
			showStyle: {}
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		minimumCoreVersion: ''
	})
}
export function removeBlueprint (id: string) {
	check(id, String)
	Blueprints.remove(id)
}

const blueprintCache: {[id: string]: Cache} = {}
interface Cache {
	modified: number,
	fcn: BlueprintManifest
}

export function getBlueprintOfRunningOrder (runnningOrder: RunningOrder): BlueprintManifest {

	if (!runnningOrder.showStyleBaseId) throw new Meteor.Error(400, `RunningOrder is missing showStyleBaseId!`)
	let showStyleBase = ShowStyleBases.findOne(runnningOrder.showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${runnningOrder.showStyleBaseId}" not found!`)
	return loadBlueprints(showStyleBase)
}

export function loadBlueprints (showStyleBase: ShowStyleBase): BlueprintManifest {
	let blueprint = Blueprints.findOne({
		_id: showStyleBase.blueprintId
	})
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${showStyleBase.blueprintId}" not found! (referenced by ShowStyleBase "${showStyleBase._id}"`)

	if (blueprint.code) {
		try {
			return evalBlueprints(blueprint, false)
		} catch (e) {
			throw new Meteor.Error(402, 'Syntax error in blueprint "' + blueprint._id + '": ' + e.toString())
		}
	} else {
		throw new Meteor.Error(500, `Blueprint "${showStyleBase.blueprintId}" code not set!`)
	}
}
export function evalBlueprints (blueprint: Blueprint, noCache?: boolean): BlueprintManifest {
	let cached: Cache | null = null
	if (!noCache) {
		// First, check if we've got the function cached:
		cached = blueprintCache[blueprint._id] ? blueprintCache[blueprint._id] : null
		if (cached && (!cached.modified || cached.modified !== blueprint.modified)) {
			// the function has been updated, invalidate it then:
			cached = null
		}
	}

	if (cached) {
		return cached.fcn
	} else {
		const context = {
			_,
			moment,
		}

		const entry = new SaferEval(context, { filename: (blueprint.name || blueprint._id) + '.js' }).runInContext(blueprint.code)
		return entry.default
	}
}

export function postProcessSegmentLineItems (innerContext: IRunningOrderContext, segmentLineItems: IBlueprintSegmentLineItem[], blueprintId: string, firstSegmentLineId: string): SegmentLineItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineItems), (itemOrig: IBlueprintSegmentLineItem) => {
		let item: SegmentLineItem = {
			runningOrderId: innerContext.runningOrder._id,
			segmentLineId: itemOrig.segmentLineId || firstSegmentLineId,
			status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
			...itemOrig
		}

		if (!item._id) item._id = innerContext.getHashId(blueprintId + '_sli_' + (i++))
		if (!item.mosId && !item.isTransition) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": mosId not set for segmentLineItem in ' + firstSegmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			item.content.timelineObjects = _.map(_.compact(item.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const item = convertTimelineObject(o)

				if (!item._id) item._id = innerContext.getHashId(blueprintId + '_' + (i++))

				if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
				timelineUniqueIds[item._id] = true

				return item
			})
		}

		return item
	})
}

export function postProcessSegmentLineAdLibItems (innerContext: IRunningOrderContext, segmentLineAdLibItems: IBlueprintSegmentLineAdLibItem[], blueprintId: string, segmentLineId?: string): SegmentLineAdLibItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineAdLibItems), (itemOrig: IBlueprintSegmentLineAdLibItem) => {
		let item: SegmentLineAdLibItem = {
			_id: innerContext.getHashId(blueprintId + '_adlib_sli_' + (i++)),
			runningOrderId: innerContext.runningOrder._id,
			segmentLineId: segmentLineId,
			status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
			trigger: undefined,
			disabled: false,
			...itemOrig
		}

		if (!item.mosId) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": mosId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			item.content.timelineObjects = _.map(_.compact(item.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const item = convertTimelineObject(o)

				if (!item._id) item._id = innerContext.getHashId(blueprintId + '_adlib_' + (i++))

				if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
				timelineUniqueIds[item._id] = true

				return item
			})
		}

		return item
	})
}

function convertTimelineObject (o: TimelineObjectCoreExt): TimelineObj {
	let item: TimelineObj = {
		_id: o.id,
		siId: '',
		roId: '',
		deviceId: [''],
		...o,
		id: '' // To makes types match
	}
	delete item['id']

	return item
}

export function postProcessSegmentLineBaselineItems (innerContext: RunningOrderContext, baselineItems: TimelineObj[]): TimelineObj[] {
	let i = 0
	let timelineUniqueIds: { [id: string]: true } = {}

	return _.map(_.compact(baselineItems), (o: TimelineObj): TimelineObj => {
		const item: TimelineObj = convertTimelineObject(o)

		if (!item._id) item._id = innerContext.getHashId('baseline_' + (i++))

		if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in baseline blueprint: ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
		timelineUniqueIds[item._id] = true
		return item
	})
}

const postRoute = Picker.filter((req, res) => req.method === 'POST')
postRoute.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb'
}))
postRoute.route('/blueprints/restore/:blueprintId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let blueprintId = params.blueprintId
	let url = parseUrl(req.url!, true)

	let blueprintName = url.query['name'] || undefined

	check(blueprintId, String)
	check(blueprintName, Match.Maybe(String))

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Restore Blueprint: Missing request body')

		if (typeof body !== 'string' || body.length < 10) throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')

		logger.info('Got new blueprint. ' + body.length + ' bytes')

		const blueprint = Blueprints.findOne(blueprintId)
		// if (!blueprint) throw new Meteor.Error(404, `Blueprint "${blueprintId}" not found`)

		const newBlueprint: Blueprint = {
			_id: blueprintId,
			name: blueprint ? blueprint.name : (blueprintName || blueprintId),
			created: blueprint ? blueprint.created : getCurrentTime(),
			code: body as string,
			modified: getCurrentTime(),
			studioConfigManifest: [],
			showStyleConfigManifest: [],
			databaseVersion: {
				studio: {},
				showStyle: {}
			},
			blueprintVersion: '',
			integrationVersion: '',
			TSRVersion: '',
			minimumCoreVersion: ''
		}

		const blueprintManifest: BlueprintManifest = evalBlueprints(newBlueprint, false)
		newBlueprint.blueprintVersion			= blueprintManifest.blueprintVersion
		newBlueprint.integrationVersion			= blueprintManifest.integrationVersion
		newBlueprint.TSRVersion					= blueprintManifest.TSRVersion
		newBlueprint.minimumCoreVersion			= blueprintManifest.minimumCoreVersion
		newBlueprint.studioConfigManifest		= blueprintManifest.studioConfigManifest
		newBlueprint.showStyleConfigManifest	= blueprintManifest.showStyleConfigManifest

		// Parse the versions, just to verify that the format is correct:
		parseVersion(blueprintManifest.blueprintVersion)
		parseVersion(blueprintManifest.integrationVersion)
		parseVersion(blueprintManifest.TSRVersion)
		parseVersion(blueprintManifest.minimumCoreVersion)

		Blueprints.upsert(newBlueprint._id, newBlueprint)

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.debug('Blueprint restore failed: ' + e)
	}

	res.end(content)
})

let methods: Methods = {}
methods[BlueprintAPI.methods.insertBlueprint] = () => {
	return insertBlueprint()
}
methods[BlueprintAPI.methods.removeBlueprint] = (id: string) => {
	return removeBlueprint(id)
}
setMeteorMethods(wrapMethods(methods))
