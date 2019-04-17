import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { applyClassToDocument, registerCollection } from '../lib'
import * as _ from 'underscore'
import { ChannelFormat } from 'timeline-state-resolver-types'
import {
	IConfigItem,
	BlueprintMappings,
	BlueprintMapping,
	ConfigItemValue
} from 'tv-automation-sofie-blueprints-integration'
import { Meteor } from 'meteor/meteor'
import { ObserveChangesForHash } from './lib'

export interface MappingsExt extends BlueprintMappings {
	[layerName: string]: MappingExt
}
export interface MappingExt extends BlueprintMapping {
	/** Internal mappings are hidden in the UI */
	internal?: boolean
}

export interface IStudioSettings {
	/** URL to endpoint where media preview are exposed */
	mediaPreviewsUrl: string // (former media_previews_url in config)
	/** URL to Sofie Core endpoint */
	sofieUrl: string // (former sofie_url in config)
}
/** A set of available layer groups in a given installation */
export interface DBStudio {
	_id: string
	/** User-presentable name for the studio installation */
	name: string
	/** Id of the blueprint used by this studio-installation */
	blueprintId?: string

	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	/** List of which ShowStyleBases this studio wants to support */
	supportedShowStyleBase: Array<string>

	/** Config values are used by the Blueprints */
	config: Array<IConfigItem>
	testToolsConfig?: ITestToolsConfig

	settings: IStudioSettings

	_rundownVersionHash: string
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

export class Studio implements DBStudio {
	public _id: string
	public name: string
	public blueprintId?: string
	public mappings: MappingsExt
	public supportedShowStyleBase: Array<string>
	public config: Array<IConfigItem>
	public settings: IStudioSettings
	public testToolsConfig?: ITestToolsConfig

	public _rundownVersionHash: string

	constructor (document: DBStudio) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	public getConfigValue (name: string): ConfigItemValue | undefined {
		const item = this.config.find((item) => {
			return (item._id === name)
		})
		if (item) {
			return item.value
		} else {
			// logger.warn(`Studio "${this._id}": Config "${name}" not set`)
			return undefined
		}
	}
}

export const Studios: TransformedCollection<Studio, DBStudio>
	= new Mongo.Collection<Studio>('studios', {transform: (doc) => applyClassToDocument(Studio, doc) })
registerCollection('Studios', Studios)

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(Studios, '_rundownVersionHash', ['config'])
	}
})
