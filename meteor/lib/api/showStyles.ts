import { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import { ShowStyleVariantId } from '../collections/ShowStyleVariants'
import { ProtectedString } from '../lib'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'insertShowStyleVariant' = 'showstyles.insertShowStyleVariant',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
}

export type DBSourceLayerId = ProtectedString<'DBSourceLayer'>
export interface DBSourceLayer {
	_id: DBSourceLayerId
	showStyleBaseId: ShowStyleBaseId
	sourceLayer: ISourceLayer
}

export type DBOutputLayerId = ProtectedString<'DBOutputLayer'>
export interface DBOutputLayer {
	_id: DBOutputLayerId
	showStyleBaseId: ShowStyleBaseId
	outputLayer: IOutputLayer
}
