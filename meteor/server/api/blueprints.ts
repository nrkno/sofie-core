import * as _ from 'underscore'
import * as moment from 'moment'
import { SaferEval } from 'safer-eval'
import { SegmentLine, DBSegmentLine, SegmentLineNote, SegmentLineNoteType } from '../../lib/collections/SegmentLines'
import { SegmentLineItem } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { formatDateAsTimecode, formatDurationAsTimecode, literal, normalizeArray, getCurrentTime } from '../../lib/lib'
import { getHash } from '../lib'
import { logger } from '../logging'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { TimelineObj } from '../../lib/collections/Timeline'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import {
	BlueprintManifest,
	ICommonContext,
	RunStoryContext,
	BaselineContext,
	PostProcessContext,
	MessageContext,
	LayerType,
	MOS
} from 'tv-automation-sofie-blueprints-integration'
import { IBlueprintSegmentLineItem, IBlueprintSegmentLineAdLibItem, BlueprintRuntimeArguments, IBlueprintSegmentLine } from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from '../../lib/api/runningOrder'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'

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

class CommonContext implements ICommonContext {
	runningOrderId: string
	runningOrder: RunningOrder
	segmentLine: SegmentLine | undefined

	private hashI = 0
	private hashed: {[hash: string]: string} = {}
	private savedNotes: Array<SegmentLineNote> = []

	private story: MOS.IMOSStory | undefined

	constructor (runningOrder: RunningOrder, segmentLine?: SegmentLine, story?: MOS.IMOSStory) {
		this.runningOrderId = runningOrder._id
		this.runningOrder = runningOrder
		this.segmentLine = segmentLine
		this.story = story
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
	getHashId (str?: any) {

		if (!str) str = 'hash' + (this.hashI++)

		let id
		id = getHash(
			this.runningOrderId + '_' +
			(this.segmentLine ? this.segmentLine._id + '_' : '') +
			str.toString()
		)
		this.hashed[id] = str
		return id
		// return Random.id()
	}
	unhashId (hash: string): string {
		return this.hashed[hash] || hash
	}
	getLayer (type: LayerType, name: string): string {
		const studio: StudioInstallation = this.getStudioInstallation()
		const showStyleBase: ShowStyleBase = this.getShowStyleBase()

		let layer: any
		switch (type) {
			case LayerType.Output:
				layer = showStyleBase.outputLayers.find(l => l._id === name)
				break
			case LayerType.Source:
				layer = showStyleBase.sourceLayers.find(l => l._id === name)
				break
			case LayerType.LLayer:
				layer = _.find(studio.mappings, (v, k) => k === name)
				break
			default:
				throw new Meteor.Error(404, 'getLayer: LayerType "' + type + '" unknown')
		}

		if (layer) {
			return name
		}

		throw new Meteor.Error(404, 'Missing layer "' + name + '" of type LayerType."' + type + '"')
	}
	getStudioConfig (): {[key: string]: string} {
		const studio: StudioInstallation = this.getStudioInstallation()

		const res: {[key: string]: string} = {}
		_.each(studio.config, (c) => {
			res[c._id] = c.value
		})

		return res
	}
	getShowStyleConfig (): {[key: string]: string} {
		const showStyleCompound = getShowStyleCompound(this.runningOrder.showStyleVariantId)
		if (!showStyleCompound) throw new Meteor.Error(404, `no showStyleCompound for "${this.runningOrder.showStyleVariantId}"`)

		const res: {[key: string]: string} = {}
		_.each(showStyleCompound.config, (c) => {
			res[c._id] = c.value
		})
		return res
	}

	getLoggerName () {
		if (this.story && this.story.Slug) {
			return this.story.Slug.toString()
		} else if (this.segmentLine) {
			return this.segmentLine.mosId
		} else {
			return ''
		}
	}
	error (message: string) {
		logger.error('Error from blueprint: ' + message)

		const name = this.getLoggerName()

		this.savedNotes.push({
			type: SegmentLineNoteType.ERROR,
			origin: {
				name: name,
				roId: this.runningOrderId,
				segmentId: this.story || !this.segmentLine ? undefined : this.segmentLine.segmentId,
				segmentLineId: this.story && this.segmentLine ? this.segmentLine._id : undefined
				// segmentLineItemId?: string,
			},
			message: message
		})

		throw new Meteor.Error(500, message)
	}
	warning (message: string) {
		// logger.warn('Warning from blueprint: ' + message)
		// @todo: save warnings, maybe to the RO somewhere?
		// it should be displayed to the user in the UI

		const name = this.getLoggerName()

		this.savedNotes.push({
			type: SegmentLineNoteType.WARNING,
			origin: {
				name: name,
				roId: this.runningOrderId,
				segmentId: this.story || !this.segmentLine ? undefined : this.segmentLine.segmentId,
				segmentLineId: this.story && this.segmentLine ? this.segmentLine._id : undefined
				// segmentLineItemId?: string,
			},
			message: message
		})
	}
	getNotes () {
		return this.savedNotes
	}
}

export function getRunStoryContext (runningOrder: RunningOrder, segmentLine: SegmentLine, story: MOS.IMOSROFullStory): RunStoryContext {
	class RunStoryContextImpl extends CommonContext implements RunStoryContext {
		segmentLine: SegmentLine

		getRuntimeArguments (): BlueprintRuntimeArguments {
			return segmentLine.runtimeArguments || {}
		}

		getSegmentLines (): Array<SegmentLine> {
			// return stories in segmentLine
			const ro: RunningOrder = this.runningOrder
			return ro.getSegmentLines().filter((sl: SegmentLine) => sl.segmentId === this.segmentLine.segmentId)
		}
		getSegmentLineIndex (): number {
			return this.getSegmentLines().findIndex((sl: SegmentLine) => sl._id === this.segmentLine._id)
		}
	}

	return new RunStoryContextImpl(runningOrder, segmentLine, story)
}

export function getPostProcessContext (runningOrder: RunningOrder, segmentLine: SegmentLine): PostProcessContext {
	class PostProcessContextImpl extends CommonContext implements PostProcessContext {
		segmentLine: SegmentLine

		getSegmentLines (): Array<SegmentLine> {
			// return stories in segmentLine
			const ro: RunningOrder = this.runningOrder
			return ro.getSegmentLines().filter((sl: SegmentLine) => sl.segmentId === this.segmentLine.segmentId)
		}
	}

	return new PostProcessContextImpl(runningOrder, segmentLine)
}

export function getBaselineContext (runningOrder: RunningOrder): BaselineContext {
	class BaselineContextImpl extends CommonContext implements BaselineContext {
	}

	return new BaselineContextImpl(runningOrder)
}

export function getMessageContext (runningOrder: RunningOrder): MessageContext {
	class MessageContextImpl extends CommonContext implements MessageContext {
		getCachedStoryForRunningOrder (): MOS.IMOSRunningOrder {
			return this.runningOrder.fetchCache('roCreate' + this.runningOrder._id)
		}
		getCachedStoryForSegmentLine (segmentLine: IBlueprintSegmentLine): MOS.IMOSROFullStory {
			return this.runningOrder.fetchCache('fullStory' + segmentLine._id)
		}

		getAllSegmentLines (): Array<SegmentLine> {
			return this.runningOrder.getSegmentLines()
		}

		formatDateAsTimecode (time: Date | number): string {
			let date = (
				_.isDate(time) ?
				time :
				new Date(time)
			)
			return formatDateAsTimecode(date)
		}
		formatDurationAsTimecode (time: number): string {
			return formatDurationAsTimecode(time)
		}
	}

	return new MessageContextImpl(runningOrder)
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

export function postProcessSegmentLineItems (innerContext: ICommonContext, segmentLineItems: IBlueprintSegmentLineItem[], blueprintId: string, segmentLineId: string): SegmentLineItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineItems), (itemOrig: IBlueprintSegmentLineItem) => {
		let item: SegmentLineItem = {
			runningOrderId: innerContext.runningOrder._id,
			segmentLineId: itemOrig.segmentLineId || segmentLineId,
			status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
			...itemOrig
		}

		if (!item._id) item._id = innerContext.getHashId(blueprintId + '_sli_' + (i++))
		if (!item.mosId && !item.isTransition) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": mosId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

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

export function postProcessSegmentLineAdLibItems (innerContext: ICommonContext, segmentLineAdLibItems: IBlueprintSegmentLineAdLibItem[], blueprintId: string, segmentLineId?: string): SegmentLineAdLibItem[] {
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

export function postProcessSegmentLineBaselineItems (innerContext: BaselineContext, baselineItems: TimelineObj[]): TimelineObj[] {
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
