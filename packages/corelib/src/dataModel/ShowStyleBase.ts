import { IBlueprintShowStyleBase, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { ProtectedStringProperties } from '../protectedString'
import { BlueprintId, OrganizationId, ShowStyleBaseId, ShowStyleVariantId } from './Ids'

export interface ShowStyleCompound extends DBShowStyleBase {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
}

export interface HotkeyDefinition {
	_id: string
	key: string
	label: string
	platformKey?: string
	sourceLayerType?: SourceLayerType
	buttonColor?: string
	up?: (e: any) => void
	down?: (e: any) => void
}
export interface DBShowStyleBase extends ProtectedStringProperties<IBlueprintShowStyleBase, '_id' | 'blueprintId'> {
	_id: ShowStyleBaseId

	/** Name of this show style */
	name: string
	/** Id of the blueprint used by this show-style */
	blueprintId: BlueprintId
	/** If set, the Organization that owns this ShowStyleBase */
	organizationId: OrganizationId | null

	hotkeyLegend?: Array<HotkeyDefinition>

	_rundownVersionHash: string
}
