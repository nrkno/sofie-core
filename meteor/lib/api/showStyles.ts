import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import { ShowStyleVariantId } from '../collections/ShowStyleVariants'
import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	insertShowStyleVariantWithBlueprint(
		showStyleBaseId: ShowStyleBaseId,
		blueprintConfig: IBlueprintConfig,
		name: string
	): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'insertShowStyleVariant' = 'showstyles.insertShowStyleVariant',
	'insertShowStyleVariantWithBlueprint' = 'showstyles.insertShowStyleVariantWithBlueprint',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
}
