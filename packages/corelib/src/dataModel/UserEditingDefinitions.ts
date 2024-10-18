import type { UserEditingType, JSONBlob, JSONSchema } from '@sofie-automation/blueprints-integration'
import type { ITranslatableMessage } from '../TranslatableMessage'

export type CoreUserEditingDefinition = CoreUserEditingDefinitionAction | CoreUserEditingDefinitionForm

export interface CoreUserEditingDefinitionAction {
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

export interface CoreUserEditingDefinitionForm {
	type: UserEditingType.FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** The json schema describing the form to display */
	schema: JSONBlob<JSONSchema>
	/** Current values to populate the form with */
	currentValues: Record<string, any>
	/** Translation namespaces to use when rendering this form */
	translationNamespaces: string[]
}
