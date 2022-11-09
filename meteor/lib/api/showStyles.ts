import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import {ShowStyleVariant, ShowStyleVariantId, ShowStyleVariantsOrder} from '../collections/ShowStyleVariants'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	insertShowStyleVariantWithProperties(
		showStyleVariant: ShowStyleVariant,
		id?: ShowStyleVariantId
	): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
	getOrderedShowStyleVariants(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariant[]>
	updateShowStyleVariantsOrder(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantsOrder[]>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'insertShowStyleVariant' = 'showstyles.insertShowStyleVariant',
	'insertShowStyleVariantWithProperties' = 'showstyles.insertShowStyleVariantWithProperties',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
	'getOrderedShowStyleVariants' = 'showstyles.getOrderedShowStyleVariants',
	'updateShowStyleVariantsOrder' = 'showstyles.updateShowStyleVariantsOrder',
}
