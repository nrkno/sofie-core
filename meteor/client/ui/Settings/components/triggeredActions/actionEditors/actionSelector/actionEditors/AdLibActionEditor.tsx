import * as React from 'react'
import _ from 'underscore'
import { useTranslation } from 'react-i18next'
import { PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { EditAttribute } from '../../../../../../../lib/EditAttribute'
import { useTracker } from '../../../../../../../lib/ReactMeteorData/ReactMeteorData'
import { AdLibActions, RundownBaselineAdLibActions } from '../../../../../../../collections'
import { ToggleSwitchControl } from '../../../../../../../lib/Components/ToggleSwitch'

export function AdLibActionEditor({
	action,
	onChange,
}: Readonly<{
	action: SomeAction
	onChange: (newVal: Partial<typeof action>) => void
}>): JSX.Element | null {
	const { t } = useTranslation()
	const allTriggerModes = useTracker<string[]>(
		() => {
			return _.chain([
				...RundownBaselineAdLibActions.find().map((action) =>
					action.triggerModes?.map((triggerMode) => triggerMode.data)
				),
				...AdLibActions.find().map((action) => action.triggerModes?.map((triggerMode) => triggerMode.data)),
			])
				.flatten()
				.compact()
				.uniq()
				.value()
		},
		[],
		[]
	)

	// this Editor only renders for AdLib
	if (action.action !== PlayoutActions.adlib) return null

	return (
		<>
			<div className="mts">
				<ToggleSwitchControl
					classNames={'form-control'}
					value={!!action.arguments}
					label={t('Use Trigger Mode')}
					handleUpdate={(newVal) => {
						onChange({
							...action,
							arguments: newVal ? { triggerMode: '' } : null,
						})
					}}
				/>
			</div>
			{action.arguments && (
				<div className="mts">
					<label className="block">{t('Trigger Mode')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						type="dropdowntext"
						options={allTriggerModes}
						overrideDisplayValue={action.arguments.triggerMode}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								arguments: {
									...action.arguments,
									triggerMode: newVal,
								},
							})
						}}
					/>
				</div>
			)}
		</>
	)
}
