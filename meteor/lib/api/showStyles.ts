import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import { ShowStyleVariantId } from '../collections/ShowStyleVariants'

export interface NewShowStylesAPI {
	insertShowStyleBase (): Promise<ShowStyleBaseId>
	insertShowStyleVariant (showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	removeShowStyleBase (showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant (showStyleVariantId: ShowStyleVariantId): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'insertShowStyleVariant' = 'showstyles.insertShowStyleVariant',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
}
