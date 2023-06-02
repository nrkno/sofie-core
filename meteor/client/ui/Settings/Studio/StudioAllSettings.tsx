import React from 'react'
import { useParams } from 'react-router-dom'
import { generateStudioSettings } from '../../../lib/guiSettings/studioSettings'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { Studios } from '../../../collections'
import { useTranslation } from 'react-i18next'
import { RenderGUISettings } from '../../../lib/guiSettings/RenderGUISettings'
import { GUIRenderContext } from '../../../lib/guiSettings/guiSettings'

export const StudioAllSettings: React.FC<{ studioId: StudioId }> = ({ studioId }) => {
	const { t } = useTranslation()

	const params = useParams()
	let settingsURL = params['settingsUrl'] as string | undefined
	if (settingsURL === 'all') settingsURL = undefined

	// Generate settings
	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	if (!studio) return <>{t('No Studio found')}</>
	const studioSettings = generateStudioSettings(t, studio)
	const renderContext = getStudioSettingsContext(studio._id, settingsURL)

	return (
		<>
			<RenderGUISettings settings={studioSettings} context={renderContext} />
		</>
	)
}

export function getStudioSettingsContext(studioId: StudioId, gotoUrl: string | undefined): GUIRenderContext {
	return {
		baseURL: `/settings/studio/${studioId}`,
		startURL: `/settings/studio/${studioId}/all`,
		gotoUrl,
	}
}
