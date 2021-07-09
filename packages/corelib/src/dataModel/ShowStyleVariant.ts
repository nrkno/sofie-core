import { IBlueprintShowStyleVariant } from '@sofie-automation/blueprints-integration'
import { ProtectedStringProperties } from '../protectedString'
import { ShowStyleVariantId, ShowStyleBaseId } from './Ids'

export interface DBShowStyleVariant extends ProtectedStringProperties<IBlueprintShowStyleVariant, '_id'> {
	_id: ShowStyleVariantId
	/** Id of parent ShowStyleBase */
	showStyleBaseId: ShowStyleBaseId

	_rundownVersionHash: string
}
