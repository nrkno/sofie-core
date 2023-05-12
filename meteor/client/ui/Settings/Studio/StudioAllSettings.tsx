import React from 'react'
import { generateStudioSettings } from '../../../lib/guiSettings/studioSettings'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { Studios } from '../../../collections'
import { useTranslation } from 'react-i18next'
import { RenderGUISettings } from '../../../lib/guiSettings/RenderGUISettings'

export const StudioAllSettings: React.FC<{ studioId: StudioId }> = ({ studioId }) => {
	const { t } = useTranslation()
	// Generate settings
	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	// const studioMappings = useMemo(
	// 	() => (studio ? applyAndValidateOverrides(studio.mappingsWithOverrides).obj : {}),
	// 	[studio?.mappingsWithOverrides]
	// )

	if (!studio) return <>{t('No Studio found')}</>
	const studioSettings = generateStudioSettings(t, studio)

	const renderContext = {
		baseURL: `/settings/studio/${studio._id}`,
	}

	return (
		<>
			<RenderGUISettings settings={studioSettings} context={renderContext} />
		</>
	)
}
