import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { ObjectWithOverrides } from '../settings/objectWithOverrides'
import { ShowStyleVariantId, ShowStyleBaseId } from './Ids'

export interface DBShowStyleVariant {
	_id: ShowStyleVariantId
	/** Id of parent ShowStyleBase */
	showStyleBaseId: ShowStyleBaseId

	name: string

	/** Config values are used by the Blueprints */
	blueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>

	_rundownVersionHash: string
}
