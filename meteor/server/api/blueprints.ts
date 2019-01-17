import * as _ from 'underscore'
import * as moment from 'moment'
import { SaferEval } from 'safer-eval'
import { SegmentLine, DBSegmentLine, SegmentLineNote, SegmentLineNoteType, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { formatDateAsTimecode, formatDurationAsTimecode, literal, normalizeArray, getCurrentTime, OmitId, trimIfString, extendMandadory } from '../../lib/lib'
import { getHash } from '../lib'
import { logger } from '../logging'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { TimelineObjGeneric, TimelineObjRunningOrder, TimelineObjType } from '../../lib/collections/Timeline'
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
	RunningOrderContext as IRunningOrderContext,
	SegmentContext as ISegmentContext,
	SegmentLineContext as ISegmentLineContext,
	EventContext as IEventContext,
	AsRunEventContext as IAsRunEventContext,
	MigrationContextStudio as IMigrationContextStudio,
	MigrationContextShowStyle as IMigrationContextShowStyle,
	BlueprintMapping,
	IConfigItem,
	IOutputLayer,
	ISourceLayer,
	ShowStyleVariantPart,
	IBlueprintShowStyleVariant,
	IBlueprintSegment,
	IBlueprintRuntimeArgumentsItem
} from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from '../../lib/api/runningOrder'

import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import * as bodyParser from 'body-parser'
import { Random } from 'meteor/random'
import { getShowStyleCompound, ShowStyleVariants, ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { check, Match } from 'meteor/check'
import { parse as parseUrl } from 'url'
import { BlueprintAPI } from '../../lib/api/blueprint'
import { Methods, setMeteorMethods, wrapMethods } from '../methods'
import { parseVersion } from '../../lib/collections/CoreSystem'
import { Segment } from '../../lib/collections/Segments'
import { AsRunLogEvent, AsRunLog } from '../../lib/collections/AsRunLog'
import { CachePrefix } from '../../lib/collections/RunningOrderDataCache'
import {
	DeviceOptions as PlayoutDeviceSettingsDevice, Timeline
} from 'timeline-state-resolver-types'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, PlayoutDeviceSettings } from '../../lib/collections/PeripheralDevices'

export namespace ConfigRef {
	export function getStudioConfigRef (configKey: string): string {
		return '${studio.' + this.runningOrder.studioInstallationId + '.' + configKey + '}'
	}
	export function getShowStyleRef (configKey: string): string {
		return '${showStyle.' + this.runningOrder.showStyleVariantId + '.' + configKey + '}'
	}
	export function retrieveRefs (stringWithReferences: string, modifier?: (str: string) => string, bailOnError?: boolean) {
		if (!stringWithReferences) return stringWithReferences

		const refs = stringWithReferences.match(/\$\{[^}]+\}/g) || []
		_.each(refs, (ref) => {
			if (ref) {
				let value = retrieveRef(ref, bailOnError) + ''
				if (value) {
					if (modifier) value = modifier(value)
					stringWithReferences.replace(ref, value)
				}
			}
		})
		return stringWithReferences
	}
	function retrieveRef (reference: string, bailOnError?: boolean): ConfigItemValue | string | undefined {
		if (!reference) return undefined

		let m = reference.match(/\$\{([^.}]+)\.([^.}]+)\.([^.}]+)\}/)
		if (m) {
			if (
				m[1] === 'studio' &&
				_.isString(m[2]) &&
				_.isString(m[3])
			) {
				const studioId = m[2]
				const configId = m[3]
				const studio = StudioInstallations.findOne(studioId)
				if (studio) {
					return studio.getConfigValue(configId)
				} else if (bailOnError) throw new Meteor.Error(404,`Ref "${reference}": Studio "${studioId}" not found`)
			} else if (
				m[1] === 'showStyle' &&
				_.isString(m[2]) &&
				_.isString(m[3])
			) {
				const showStyleVariantId = m[2]
				const configId = m[3]
				const showStyleCompound = getShowStyleCompound(showStyleVariantId)
				if (showStyleCompound) {
					const config = _.find(showStyleCompound.config, (config) => {
						return config._id === configId
					})
					if (config) {
						return config.value
					} else if (bailOnError) throw new Meteor.Error(404,`Ref "${reference}": Showstyle variant "${showStyleVariantId}" not found`)
				}
			}
		}
		return undefined
	}
}

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

export class RunningOrderContext extends NotesContext implements IRunningOrderContext {
	runningOrderId: string
	runningOrder: RunningOrder

	constructor (runningOrder: RunningOrder, contextName?: string, segmentId?: string, segmentLineId?: string) {
		super(contextName || runningOrder.name, runningOrder._id, segmentId, segmentLineId)

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
	getStudioConfigRef (configKey: string): string {
		return ConfigRef.getStudioConfigRef(configKey)
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
	getShowStyleRef (configKey: string): string {
		return ConfigRef.getShowStyleRef(configKey)
	}
	/** return segmentLines in this runningOrder */
	getSegmentLines (): Array<SegmentLine> {
		return this.runningOrder.getSegmentLines()
	}
}

export class SegmentContext extends RunningOrderContext implements ISegmentContext {
	readonly segment: Segment
	constructor (runningOrder: RunningOrder, segment: Segment) {
		super(runningOrder, undefined, segment._id)
		this.segment = segment
	}
	getSegmentLines (): Array<SegmentLine> {
		return this.segment.getSegmentLines()
	}
}
export class SegmentLineContext extends RunningOrderContext implements ISegmentLineContext {
	readonly segmentLine: SegmentLine
	constructor (runningOrder: RunningOrder, segmentLine: SegmentLine, story?: MOS.IMOSStory) {
		super(runningOrder, ((story ? story.Slug : '') || segmentLine.mosId) + '', undefined, segmentLine._id)

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
	/** Return true if segmentLine is the first in the Segment */
	getIsFirstSegmentLine (): boolean {
		let sls = this.getSegmentLines()
		let first = sls[0]
		return (first && first._id === this.segmentLine._id)
	}
	/** Return true if segmentLine is the false in the Segment */
	getIsLastSegmentLine (): boolean {
		let sls = this.getSegmentLines()
		if (sls.length) {
			let last = sls[sls.length - 1]
			return (last && last._id === this.segmentLine._id)
		}
		return false
	}
}

export class EventContext extends CommonContext implements IEventContext {
	// TDB: Certain actions that can be triggered in Core by the Blueprint
}
export class AsRunEventContext extends RunningOrderContext implements IAsRunEventContext {

	public asRunEvent: AsRunLogEvent

	constructor (runningOrder: RunningOrder, asRunEvent: AsRunLogEvent) {
		super(runningOrder)
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
	getSegments (): Array<IBlueprintSegment> {
		return this.runningOrder.getSegments()
	}
	/**
	 * Returns a segment
	 * @param id Id of segment to fetch. If is omitted, return the segment related to this AsRunEvent
	 */
	getSegment (id?: string): IBlueprintSegment | undefined {
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
	getStoryForSegmentLine (segmentLine: SegmentLine): MOS.IMOSROFullStory {
		let segmentLineId = segmentLine._id
		check(segmentLineId, String)
		return this.runningOrder.fetchCache(CachePrefix.FULLSTORY + segmentLineId)
	}
	/** Get the mos story related to the runningOrder */
	getStoryForRunningOrder (): MOS.IMOSRunningOrder {
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
		if (this._runningOrderId) ids.push('roId: ' + this._runningOrderId)
		if (this.asRunEvent.segmentId) ids.push('segmentId: ' + this.asRunEvent.segmentId)
		if (this.asRunEvent.segmentLineId) ids.push('segmentLineId: ' + this.asRunEvent.segmentLineId)
		if (this.asRunEvent.segmentLineItemId) ids.push('segmentLineItemId: ' + this.asRunEvent.segmentLineItemId)
		if (this.asRunEvent.timelineObjectId) ids.push('timelineObjectId: ' + this.asRunEvent.timelineObjectId)
		return ids.join(',')
	}
}
export class MigrationContextStudio implements IMigrationContextStudio {

	private studio: StudioInstallation

	constructor (studio: StudioInstallation) {
		this.studio = studio
	}

	getMapping (mappingId: string): BlueprintMapping | undefined {
		check(mappingId, String)
		let mapping = this.studio.mappings[mappingId]
		if (mapping) return _.clone(mapping)
	}
	insertMapping (mappingId: string, mapping: OmitId<BlueprintMapping>): string {
		check(mappingId, String)
		let m: any = {}
		m['mappings.' + mappingId] = mapping
		StudioInstallations.update(this.studio._id, {$set: m})
		this.studio.mappings[mappingId] = m['mappings.' + mappingId] // Update local
		return mappingId
	}
	updateMapping (mappingId: string, mapping: Partial<BlueprintMapping>): void {
		check(mappingId, String)
		let m: any = {}
		m['mappings.' + mappingId] = _.extend(this.studio.mappings[mappingId], mapping)
		StudioInstallations.update(this.studio._id, {$set: m})
		this.studio.mappings[mappingId] = m['mappings.' + mappingId] // Update local
	}
	removeMapping (mappingId: string): void {
		check(mappingId, String)
		let m: any = {}
		m['mappings.' + mappingId] = 1
		StudioInstallations.update(this.studio._id, {$unset: m})
		delete this.studio.mappings[mappingId] // Update local
	}
	getConfig (configId: string): ConfigItemValue | undefined {
		check(configId, String)
		let configItem = _.find(this.studio.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setConfig (configId: string, value: ConfigItemValue): void {
		check(configId, String)

		value = trimIfString(value)

		let configItem = _.find(this.studio.config, c => c._id === configId)
		if (configItem) {
			StudioInstallations.update({
				_id: this.studio._id,
				'config._id': configId
			}, {$set: {
				'config.$.value' : value
			}})
			configItem.value = value // Update local
		} else {
			let config: IConfigItem = {
				_id: configId,
				value: value
			}
			StudioInstallations.update({
				_id: this.studio._id,
			}, {$push: {
				config : config
			}})
			if (!this.studio.config) this.studio.config = []
			this.studio.config.push(config) // Update local
		}
	}
	removeConfig (configId: string): void {
		check(configId, String)

		StudioInstallations.update({
			_id: this.studio._id,
		}, {$pull: {
			'config': {
				_id: configId
			}
		}})
		// Update local:
		this.studio.config = _.reject(this.studio.config, c => c._id === configId)
	}

	getDevice (deviceId: string): PlayoutDeviceSettingsDevice | undefined {
		check(deviceId, String)

		const selector = {
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioInstallationId: this.studio._id
		}
		selector[`settings.devices.${deviceId}`] = { $exists: 1 }

		const parentDevice = PeripheralDevices.findOne(selector, {
			sort: {
				created: 1
			}
		})

		if (!parentDevice || !parentDevice.settings) return undefined
		return (parentDevice.settings as PlayoutDeviceSettings).devices[deviceId] as PlayoutDeviceSettingsDevice
	}
	insertDevice (deviceId: string, device: PlayoutDeviceSettingsDevice): string | null {
		check(deviceId, String)

		const parentDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioInstallationId: this.studio._id
		}, {
			sort: {
				created: 1
			}
		})
		if (!parentDevice) return null

		let m: any = {}
		m[`settings.devices.${deviceId}`] = device

		PeripheralDevices.update(parentDevice._id, {
			$set: m
		})

		return ''
	}
	updateDevice (deviceId: string, device: Partial<PlayoutDeviceSettingsDevice>): void {
		check(deviceId, String)

		const selector = {
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioInstallationId: this.studio._id
		}
		selector[`settings.devices.${deviceId}`] = { $exists: 1 }

		const parentDevice = PeripheralDevices.findOne(selector, {
			sort: {
				created: 1
			}
		})
		if (!parentDevice || !parentDevice.settings) return

		let m: any = {}
		m[`settings.devices.${deviceId}`] = _.extend((parentDevice.settings as PlayoutDeviceSettings).devices[deviceId], device)
		PeripheralDevices.update(selector, {
			$set: m
		})
	}
	removeDevice (deviceId: string): void {
		check(deviceId, String)

		let m: any = {}
		m[`settings.devices.${deviceId}`] = 1
		PeripheralDevices.update({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioInstallationId: this.studio._id
		}, {
			$unset: m
		})
	}
}
export class MigrationContextShowStyle implements IMigrationContextShowStyle {

	private showStyleBase: ShowStyleBase

	constructor (showStyleBase: ShowStyleBase) {
		this.showStyleBase = showStyleBase
	}

	getAllVariants (): IBlueprintShowStyleVariant[] {
		return ShowStyleVariants.find({
			showStyleBaseId: this.showStyleBase._id
		}).fetch()
	}
	getVariantId (variantId: string): string {
		return getHash(this.showStyleBase._id + '_' + variantId)
	}
	getVariant (variantId: string): IBlueprintShowStyleVariant | undefined {
		check(variantId, String)
		return ShowStyleVariants.findOne({
			showStyleBaseId: this.showStyleBase._id,
			_id: this.getVariantId(variantId)
		})
	}
	insertVariant (variantId: string, variant: OmitId<ShowStyleVariantPart>): string {
		return ShowStyleVariants.insert(_.extend({}, variant, {
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}))
	}
	updateVariant (variantId: string, variant: Partial<ShowStyleVariantPart>): void {
		check(variantId, String)
		ShowStyleVariants.update({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id,
		}, {$set: variant})
	}
	removeVariant (variantId: string): void {
		check(variantId, String)
		ShowStyleVariants.remove({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id,
		})
	}
	getSourceLayer (sourceLayerId: string): ISourceLayer | undefined {
		check(sourceLayerId, String)
		return _.find(this.showStyleBase.sourceLayers, sl => sl._id === sourceLayerId)
	}
	insertSourceLayer (sourceLayerId: string, layer: OmitId<ISourceLayer>): string {
		if (sourceLayerId) {
			let oldLayer = _.find(this.showStyleBase.sourceLayers, sl => sl._id === sourceLayerId)
			if (oldLayer) throw new Meteor.Error(500, `Can't insert SourceLayer, _id "${sourceLayerId}" already exists!`)
		}

		let sl: ISourceLayer = _.extend(layer, {
			_id: sourceLayerId
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			sourceLayers: sl
		}})
		if (!this.showStyleBase.sourceLayers) this.showStyleBase.sourceLayers = []
		this.showStyleBase.sourceLayers.push(sl) // Update local
		return sl._id
	}
	updateSourceLayer (sourceLayerId: string, layer: Partial<ISourceLayer>): void {
		check(sourceLayerId, String)
		let sl = _.find(this.showStyleBase.sourceLayers, sl => sl._id === sourceLayerId) as ISourceLayer
		if (!sl) throw new Meteor.Error(404, `SourceLayer "${sourceLayerId}" not found`)

		_.each(layer, (value, key) => {
			sl[key] = value // Update local
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'sourceLayers._id': sourceLayerId
		}, {$set: {
			'sourceLayers.$' : sl
		}})

	}
	removeSourceLayer (sourceLayerId: string): void {
		check(sourceLayerId, String)

		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$pull: {
			'sourceLayers': {
				_id: sourceLayerId
			}
		}})
		// Update local:
		this.showStyleBase.sourceLayers = _.reject(this.showStyleBase.sourceLayers, c => c._id === sourceLayerId)
	}
	getOutputLayer (outputLayerId: string): IOutputLayer | undefined {
		check(outputLayerId, String)
		return _.find(this.showStyleBase.outputLayers, sl => sl._id === outputLayerId)
	}
	insertOutputLayer (outputLayerId: string, layer: OmitId<IOutputLayer>): string {
		if (outputLayerId) {
			let oldLayer = _.find(this.showStyleBase.outputLayers, sl => sl._id === outputLayerId)
			if (oldLayer) throw new Meteor.Error(500, `Can't insert OutputLayer, _id "${outputLayerId}" already exists!`)
		}

		let sl: IOutputLayer = _.extend(layer, {
			_id: outputLayerId
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			outputLayers: sl
		}})
		if (!this.showStyleBase.outputLayers) this.showStyleBase.outputLayers = []
		this.showStyleBase.outputLayers.push(sl) // Update local
		return sl._id
	}
	updateOutputLayer (outputLayerId: string, layer: Partial<IOutputLayer>): void {
		check(outputLayerId, String)
		let sl = _.find(this.showStyleBase.outputLayers, sl => sl._id === outputLayerId) as IOutputLayer
		if (!sl) throw new Meteor.Error(404, `OutputLayer "${outputLayerId}" not found`)

		_.each(layer, (value, key) => {
			sl[key] = value // Update local
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'outputLayers._id': outputLayerId
		}, {$set: {
			'outputLayers.$' : sl
		}})
	}
	removeOutputLayer (outputLayerId: string): void {
		check(outputLayerId, String)
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$pull: {
			'outputLayers': {
				_id: outputLayerId
			}
		}})
		// Update local:
		this.showStyleBase.outputLayers = _.reject(this.showStyleBase.outputLayers, c => c._id === outputLayerId)
	}
	getBaseConfig (configId: string): ConfigItemValue | undefined {
		check(configId, String)
		let configItem = _.find(this.showStyleBase.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setBaseConfig (configId: string, value: ConfigItemValue): void {
		check(configId, String)
		if (_.isUndefined(value)) throw new Meteor.Error(400, `setBaseConfig "${configId}": value is undefined`)

		value = trimIfString(value)

		let configItem = _.find(this.showStyleBase.config, c => c._id === configId)
		if (configItem) {
			ShowStyleBases.update({
				_id: this.showStyleBase._id,
				'config._id': configId
			}, {$set: {
				'config.$.value' : value
			}})
			configItem.value = value // Update local
		} else {
			let config: IConfigItem = {
				_id: configId,
				value: value
			}
			ShowStyleBases.update({
				_id: this.showStyleBase._id,
			}, {$push: {
				config : config
			}})
			if (!this.showStyleBase.config) this.showStyleBase.config = []
			this.showStyleBase.config.push(config) // Update local
		}
	}
	removeBaseConfig (configId: string): void {
		check(configId, String)
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$pull: {
			'config': {
				_id: configId
			}
		}})
		// Update local:
		this.showStyleBase.config = _.reject(this.showStyleBase.config, c => c._id === configId)
	}
	getVariantConfig (variantId: string, configId: string): ConfigItemValue | undefined {
		check(variantId, String)
		check(configId, String)

		let variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}) as ShowStyleVariant
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		let configItem = _.find(variant.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setVariantConfig (variantId: string, configId: string, value: ConfigItemValue): void {
		check(variantId, String)
		check(configId, String)

		value = trimIfString(value)

		if (_.isUndefined(value)) throw new Meteor.Error(400, `setVariantConfig "${variantId}", "${configId}": value is undefined`)

		console.log('setVariantConfig', variantId, configId, value)

		let variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}) as ShowStyleVariant
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		let configItem = _.find(variant.config, c => c._id === configId)
		if (configItem) {
			ShowStyleVariants.update({
				_id: variant._id,
				'config._id': configId
			}, {$set: {
				'config.$.value' : value
			}})
			configItem.value = value // Update local
		} else {
			let config: IConfigItem = {
				_id: configId,
				value: value
			}
			ShowStyleVariants.update({
				_id: variant._id,
			}, {$push: {
				config : config
			}})
			if (!variant.config) variant.config = []
			variant.config.push(config) // Update local
		}
	}
	removeVariantConfig (variantId: string, configId: string): void {
		check(variantId, String)
		check(configId, String)

		let variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}) as ShowStyleVariant
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		ShowStyleVariants.update({
			_id: variant._id,
		}, {$pull: {
			'config': {
				_id: configId
			}
		}})
		// Update local:
		this.showStyleBase.config = _.reject(this.showStyleBase.config, c => c._id === configId)
	}

	getRuntimeArgument (argumentId: string): IBlueprintRuntimeArgumentsItem | undefined {
		check(argumentId, String)
		return _.find(this.showStyleBase.runtimeArguments || [], ra => ra._id === argumentId)
	}
	insertRuntimeArgument (argumentId: string, argument: IBlueprintRuntimeArgumentsItem) {
		if (argumentId && this.showStyleBase.runtimeArguments) {
			let oldLayer = _.find(this.showStyleBase.runtimeArguments, ra => ra._id === argumentId)
			if (oldLayer) throw new Meteor.Error(500, `Can't insert RuntimeArgument, _id "${argumentId}" already exists!`)
		}

		let ra: IBlueprintRuntimeArgumentsItem = _.extend(argument, {
			_id: argumentId
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			runtimeArguments: ra
		}})
		if (!this.showStyleBase.outputLayers) this.showStyleBase.outputLayers = []
		this.showStyleBase.runtimeArguments.push(ra) // Update local
	}
	updateRuntimeArgument (argumentId: string, argument: Partial<OmitId<IBlueprintRuntimeArgumentsItem>>) {
		check(argumentId, String)
		let ra = _.find(this.showStyleBase.runtimeArguments, ra => ra._id === argumentId) as IBlueprintRuntimeArgumentsItem
		if (!ra) throw new Meteor.Error(404, `RuntimeArgument "${argumentId}" not found`)

		_.each(argument, (value, key) => {
			ra[key] = value // Update local
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'runtimeArguments._id': argumentId
		}, {$set: {
			'runtimeArguments.$' : ra
		}})
	}
	removeRuntimeArgument (argumentId: string) {
		check(argumentId, String)
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$pull: {
			'runtimeArguments': {
				_id: argumentId
			}
		}})
		// Update local:
		this.showStyleBase.runtimeArguments = _.reject(this.showStyleBase.runtimeArguments, c => c._id === argumentId)
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
		let manifest = entry.default

		// Wrap the functions in manifest, to emit better errors
		_.each(_.keys(manifest), (key) => {
			let value = manifest[key]
			if (_.isFunction(value)) {
				manifest[key] = (...args: any[]) => {
					try {
						return value(...args)
					} catch (e) {
						let msg = `Error in Blueprint "${blueprint._id}".${key}: "${e.toString()}"`
						if (e.stack) msg += '\n' + e.stack
						logger.error(msg)
						throw e
					}
				}
			}
		})

		return manifest
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
				const item = convertTimelineObject(innerContext.runningOrder._id, o)

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
				const item = convertTimelineObject(innerContext.runningOrder._id, o)

				if (!item._id) item._id = innerContext.getHashId(blueprintId + '_adlib_' + (i++))

				if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
				timelineUniqueIds[item._id] = true

				return item
			})
		}

		return item
	})
}

function convertTimelineObject (runningOrderId: string, o: TimelineObjectCoreExt): TimelineObjRunningOrder {
	let item: TimelineObjRunningOrder = extendMandadory<TimelineObjectCoreExt, TimelineObjRunningOrder>(o, {
		_id: o.id,
		siId: '', // set later
		roId: runningOrderId,
		objectType: TimelineObjType.RUNNINGORDER,
	})
	delete item['id']

	return item
}

export function postProcessSegmentLineBaselineItems (innerContext: RunningOrderContext, baselineItems: Timeline.TimelineObject[]): TimelineObjGeneric[] {
	let i = 0
	let timelineUniqueIds: { [id: string]: true } = {}

	return _.map(_.compact(baselineItems), (o: TimelineObjGeneric): TimelineObjGeneric => {
		const item: TimelineObjGeneric = convertTimelineObject(innerContext.runningOrder._id, o)

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
	let url = parseUrl(req.url || '', true)

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
