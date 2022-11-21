import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariantId } from '../collections/ShowStyleVariants'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	createDefaultShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	importShowStyleVariant(showStyleVariant: ShowStyleVariant): Promise<ShowStyleVariantId>
	importShowStyleVariantAsNew(showStyleVariant: ShowStyleVariant): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
	reorderAllShowStyleVariants(showStyleBaseId: ShowStyleBaseId, orderedVariants: ShowStyleVariant[]): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'createDefaultShowStyleVariant' = 'showstyles.createDefaultShowStyleVariant',
	'importShowStyleVariant' = 'showstyles.importShowStyleVariant',
	'importShowStyleVariantAsNew' = 'showstyles.importShowStyleVariantAsNew',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
	'reorderAllShowStyleVariants' = 'showstyles.reorderAllShowStyleVariants',
}
