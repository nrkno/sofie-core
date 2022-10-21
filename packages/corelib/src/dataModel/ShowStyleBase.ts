import { IBlueprintShowStyleBase, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { ProtectedStringProperties } from '../protectedString'
import { BlueprintId, OrganizationId, ShowStyleBaseId } from './Ids'

export interface HotkeyDefinition {
	_id: string
	/** Reference to the hotkey in Sofie */
	key: string
	/** Label of the key, to be displayed in GUI */
	label: string

	// --------- Note: The properties below are used in a TV2-only feature --------------

	/** Alternate hotkey that can be used through AutoHotKey, after importing the script */
	platformKey?: string
	/** Used for the color */
	sourceLayerType?: SourceLayerType
	/** Alternate color */
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

	/** A list of hotkeys, used to display a legend of hotkeys for the user in GUI */
	hotkeyLegend?: Array<HotkeyDefinition>

	_rundownVersionHash: string
}
