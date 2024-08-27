import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutStudioName,
	RundownLayoutBase,
	RundownLayoutStudioName,
} from '../../../lib/collections/RundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { useTranslation } from 'react-i18next'
import { UIStudio } from '../../../lib/api/studios'

interface IStudioNamePanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutStudioName
	studio: UIStudio
}

export function StudioNamePanel({ layout, panel, studio }: Readonly<IStudioNamePanelProps>): JSX.Element {
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
