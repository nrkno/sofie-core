import React from 'react'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { JSONBlobParse, UserEditingType, UserOperationTarget } from '@sofie-automation/blueprints-integration'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { MenuItem } from '@jstarpl/react-contextmenu'
import { i18nTranslator } from '../i18n'
import { doModalDialog } from '../../lib/ModalDialog'
import { SchemaFormInPlace } from '../../lib/forms/SchemaFormInPlace'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'

export function RenderUserEditOperations(
	isFormEditable: boolean,
	rundownId: RundownId,
	targetName: string,
	userEditOperations: CoreUserEditingDefinition[] | undefined,
	operationTarget: UserOperationTarget
): React.JSX.Element | null {
	const t = i18nTranslator
	if (!userEditOperations || userEditOperations.length === 0) return null
	return (
		<>
			<hr />
			{userEditOperations.map((userEditOperation, i) => {
				switch (userEditOperation.type) {
					case UserEditingType.ACTION:
						return (
							<MenuItem
								key={`${userEditOperation.id}_${i}`}
								onClick={(e) => {
									doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
										MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, operationTarget, {
											id: userEditOperation.id,
										})
									)
								}}
							>
								{
									// ToDo: use CSS to Style state instead of asterix
									userEditOperation.isActive ? <span className="action-protected">{'• '}</span> : null
								}
								<span>{translateMessage(userEditOperation.label, i18nTranslator)}</span>
							</MenuItem>
						)
					case UserEditingType.FORM:
						return (
							<MenuItem
								disabled={!isFormEditable}
								key={`${userEditOperation.id}_${i}`}
								onClick={(e) => {
									const schema = JSONBlobParse(userEditOperation.schema)
									const values = clone(userEditOperation.currentValues)

									// TODO:
									doModalDialog({
										title: t(`Edit {{targetName}}`, { targetName }),
										message: (
											<SchemaFormInPlace
												schema={schema}
												object={values}
												translationNamespaces={userEditOperation.translationNamespaces}
											/>
										),
										// acceptText: 'OK',
										yes: t('Save Changes'),
										no: t('Cancel'),
										onAccept: () => {
											doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
												MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, operationTarget, {
													...values,
													id: userEditOperation.id,
												})
											)
										},
									})
								}}
							>
								<span>{translateMessage(userEditOperation.label, i18nTranslator)}</span>
							</MenuItem>
						)
					default:
						assertNever(userEditOperation)
						return null
				}
			})}
		</>
	)
}
