import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutStudioName,
	RundownLayoutBase,
	RundownLayoutStudioName,
} from '../../../lib/collections/RundownLayouts'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Studio } from '../../../lib/collections/Studios'
import { useTranslation } from 'react-i18next'

interface IStudioNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutStudioName
	playlist: RundownPlaylist
	studio: Studio
}

export function StudioNamePanel({ layout, panel, studio }: IStudioNamePanelProps) {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)
	const { t } = useTranslation()

	return (
		<div
			className={ClassNames(
				'studio-name-panel',
				isDashboardLayout ? (panel as DashboardLayoutStudioName).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutStudioName) : {}}
		>
			<div className="wrapper">
				<span className="studio-name-title">{t('Studio Name')}</span>
				<span className="studio-name">{studio.name}</span>
			</div>
		</div>
	)
}
