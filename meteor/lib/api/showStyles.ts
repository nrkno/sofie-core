import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariantId } from '../collections/ShowStyleVariants'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	insertShowStyleVariantWithProperties(
		showStyleVariant: ShowStyleVariant,
		id?: ShowStyleVariantId
	): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'insertShowStyleVariant' = 'showstyles.insertShowStyleVariant',
	'insertShowStyleVariantWithProperties' = 'showstyles.insertShowStyleVariantWithProperties',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
}
