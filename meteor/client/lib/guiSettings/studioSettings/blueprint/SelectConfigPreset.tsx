import React, { useMemo } from 'react'
import { TFunction } from 'react-i18next'
import { DBStudio } from '../../../../../lib/collections/Studios'
import { EditAttribute } from '../../../EditAttribute'
import { Studios } from '../../../../collections'
import { IStudioConfigPreset } from '@sofie-automation/blueprints-integration'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export const SelectConfigPreset: React.FC<{ t: TFunction; studio: DBStudio; blueprint: Blueprint | undefined }> = ({
	studio,
	blueprint,
}) => {
	const configPresetOptions = useMemo(() => {
		const options: { name: string; value: string | null }[] = []

		if (blueprint?.studioConfigPresets) {
			if (blueprint.studioConfigPresets) {
				for (const [id, preset] of Object.entries<IStudioConfigPreset>(blueprint.studioConfigPresets)) {
					options.push({
						value: id,
						name: preset.name,
					})
				}
			}
		}

		return options
	}, [blueprint?.studioConfigPresets])

	return (
		<>
			<EditAttribute
				modifiedClassName="bghl"
				attribute="blueprintConfigPresetId"
				obj={studio}
				type="dropdown"
				options={configPresetOptions}
				mutateDisplayValue={(v) => v || ''}
				mutateUpdateValue={(v) => (v === '' ? undefined : v)}
				collection={Studios}
				className="input text-input input-l"
			/>
		</>
	)
}
