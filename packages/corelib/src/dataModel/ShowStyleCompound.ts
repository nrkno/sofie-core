import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { ShowStyleVariantId } from './Ids'
import { DBShowStyleBase } from './ShowStyleBase'

export interface ShowStyleCompound extends Omit<DBShowStyleBase, 'blueprintConfigWithOverrides'> {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
	combinedBlueprintConfig: IBlueprintConfig
}
