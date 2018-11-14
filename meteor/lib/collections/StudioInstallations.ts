import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { applyClassToDocument, registerCollection } from '../lib'
import * as _ from 'underscore'
import { logger } from '../logging'
import { Mappings, Mapping, ChannelFormat } from 'timeline-state-resolver-types'
import { LookaheadMode } from '../../lib/api/playout'

export interface MappingsExt extends Mappings {
	[layerName: string]: MappingExt
}
export interface MappingExt extends Mapping {
	/** @todo: write documentation about lookahead */
	lookahead: LookaheadMode
	/** Internal mappings are hidden in the UI */
	internal?: boolean
}

export interface IStudioInstallationSettings {
	/** URL to endpoint where media preview are exposed */
	mediaPreviewsUrl: string // (former media_previews_url in config)
	/** URL to Sofie Core endpoint */
	sofieUrl: string // (former sofie_url in config)
}
/** A set of available layer groups in a given installation */
export interface DBStudioInstallation {
	_id: string
	/** User-presentable name for the studio installation */
	name: string
	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	/** RunningOrders will have this, if nothing else is specified */
	defaultShowStyleVariant: string

	/** List of which ShowStyleBases this studio wants to support */
	supportedShowStyleBase: Array<string>

	/** Config values are used by the Blueprints */
	config: Array<IConfigItem>
	testToolsConfig?: ITestToolsConfig

	settings: IStudioInstallationSettings

	runtimeArguments?: Array<IStudioRuntimeArgumentsItem>
}

export interface IStudioRuntimeArgumentsItem {
	label?: string
	hotkeys: string
	property: string
	value: string
}

export interface IConfigItem {
	_id: string
	/** Value */
	value: any
}

export interface ITestToolsConfig {
	recordings: {
		deviceId?: string
		channelIndex?: number
		channelFormat: ChannelFormat
		decklinkDevice?: number
		filePrefix?: string
		urlPrefix?: string
	}
}

export class StudioInstallation implements DBStudioInstallation {
	public _id: string
	public name: string
	public mappings: MappingsExt
	public defaultShowStyleVariant: string
	public supportedShowStyleBase: Array<string>
	public config: Array<IConfigItem>
	public settings: IStudioInstallationSettings
	public testToolsConfig?: ITestToolsConfig
	public runtimeArguments: Array<IStudioRuntimeArgumentsItem>

	constructor (document: DBStudioInstallation) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	public getConfigValue (name: string): string | null {
		const item = this.config.find((item) => {
			return (item._id === name)
		})
		if (item) {
			return item.value
		} else {
			// logger.warn(`Studio "${this._id}": Config "${name}" not set`)
			return null
		}
	}
}

export const StudioInstallations: TransformedCollection<StudioInstallation, DBStudioInstallation>
	= new Mongo.Collection<StudioInstallation>('studioInstallation', {transform: (doc) => applyClassToDocument(StudioInstallation, doc) })
registerCollection('StudioInstallations', StudioInstallations)
