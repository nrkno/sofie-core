import React, { useMemo } from 'react'
import { TFunction } from 'react-i18next'
import { Studio } from '../../../../../lib/collections/Studios'
import { EditAttribute } from '../../../EditAttribute'
import { Blueprints, Studios } from '../../../../collections'
import { useTracker } from '../../../ReactMeteorData/ReactMeteorData'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { RedirectToBlueprintButton } from '../../../SettingsNavigation'

export const SelectBlueprint: React.FC<{ t: TFunction; studio: Studio }> = ({ t, studio }) => {
	const allStudioBlueprints = useTracker(() => {
		return Blueprints.find({
			blueprintType: BlueprintManifestType.STUDIO,
		}).fetch()
	}, [])
	const blueprintOptions = useMemo(() => {
		const options: { name: string; value: BlueprintId | null }[] = [
			{
				name: t('None'),
				value: protectString(''),
			},
		]

		if (allStudioBlueprints) {
			options.push(
				...allStudioBlueprints.map((blueprint) => {
					return {
						name: blueprint.name ? blueprint.name + ` (${blueprint._id})` : unprotectString(blueprint._id),
						value: blueprint._id,
					}
				})
			)
		}

		return options
	}, [t, allStudioBlueprints])

	return (
		<>
			<EditAttribute
				modifiedClassName="bghl"
				attribute="blueprintId"
				obj={studio}
				type="dropdown"
				options={blueprintOptions}
				mutateDisplayValue={(v) => v || ''}
				mutateUpdateValue={(v) => (v === '' ? undefined : v)}
				collection={Studios}
				className="input text-input input-l"
			/>
			<RedirectToBlueprintButton id={studio.blueprintId} />
		</>
	)
}
