import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { ISourceLayerBase, IOutputLayerBase } from './StudioInstallations'

export interface TemplateMappings {
	[key: string]: string
}

export interface ShowStyle {
	_id: string
	name: string
	/** Override studio-level source-layer properties (UI name, rank) */
	sourceLayerOverrides?: Array<ISourceLayerBase>
	/** Override studio-level output-layer properties (UI name, rank) */
	outputLayerOverrides?: Array<IOutputLayerBase>
	/** Map a template name to a runtime function? */
	templateMappings: TemplateMappings | never[]
	/** The name of the template to be run for the baseline state when the running order is activated */
	baselineTemplate: string
}

export const ShowStyles: TransformedCollection<ShowStyle, ShowStyle>
	= new Mongo.Collection<ShowStyle>('showStyles')
