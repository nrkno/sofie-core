import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import type { ITranslatableMessage } from './translations'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

/**
 * Description of a user performed editing operation allowed on an document
 */
export type UserEditingDefinition = UserEditingDefinitionAction | UserEditingDefinitionForm

/**
 * A simple 'action' that can be performed
 */
export interface UserEditingDefinitionAction {
	type: UserEditingType.ACTION
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** Icon to show to when this action is 'active' */
	svgIcon?: string
	/** Whether this action should be indicated as being active */
	isActive?: boolean
}

/**
 * A simple form based operation
 */
export interface UserEditingDefinitionForm {
	type: UserEditingType.FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** The json schema describing the form to display */
	schema: JSONBlob<JSONSchema>
	/** Current values to populate the form with */
	currentValues: Record<string, any>
}

export enum UserEditingType {
	/** Action */
	ACTION = 'action',
	/** Form of selections */
	FORM = 'form',
}
