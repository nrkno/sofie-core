import React from 'react'
import { useParams } from 'react-router-dom'
import { generateStudioSettings } from '../../../lib/guiSettings/studioSettings'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { Studios } from '../../../collections'
import { useTranslation } from 'react-i18next'
import { RenderGUISettings } from '../../../lib/guiSettings/RenderGUISettings'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { GUIRenderContext } from '../../../lib/guiSettings/guiSettings'

export const StudioAllSettings: React.FC<{ studioId: StudioId }> = ({ studioId }) => {
	const { t } = useTranslation()

	const params = useParams()
	const settingsURL = params['settingsUrl'] as string | undefined

	// Generate settings
	const studio = useTracker(() => {
		console.log('studio updated')
		return Studios.findOne(studioId)
	}, [studioId])

	if (!studio) return <>{t('No Studio found')}</>
	const studioSettings = generateStudioSettings(t, studio)

	const renderContext = literal<GUIRenderContext>({
		baseURL: `/settings/studio/${studio._id}/all-settings`,
		filterString: settingsURL,
	})

	return (
		<>
			<RenderGUISettings settings={studioSettings} context={renderContext} />
		</>
	)
}
