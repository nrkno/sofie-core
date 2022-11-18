import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariantId } from '../collections/ShowStyleVariants'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	createDefaultShowStyleVariant(showStyleBaseId: ShowStyleBaseId, rank: number): Promise<ShowStyleVariantId>
	importShowStyleVariant(showStyleVariant: ShowStyleVariant): Promise<ShowStyleVariantId>
	copyShowStyleVariant(showStyleVariant: ShowStyleVariant): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
	reorderAllShowStyleVariants(showStyleBaseId: ShowStyleBaseId, orderedVariants: ShowStyleVariant[]): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'createDefaultShowStyleVariant' = 'showstyles.createDefaultShowStyleVariant',
	'importShowStyleVariant' = 'showstyles.importShowStyleVariant',
	'copyShowStyleVariant' = 'showstyles.copyShowStyleVariant',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
	'reorderAllShowStyleVariants' = 'showstyles.reorderAllShowStyleVariants',
}
