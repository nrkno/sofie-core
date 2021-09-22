import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutStudioName,
	RundownLayoutBase,
	RundownLayoutStudioName,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Studio } from '../../../lib/collections/Studios'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'

interface IStudioNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutStudioName
	playlist: RundownPlaylist
	studio: Studio
}

interface IState {}

interface IStudioNamePanelTrackedProps {}

class StudioNamePanelInner extends MeteorReactComponent<
	Translated<IStudioNamePanelProps & IStudioNamePanelTrackedProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t, panel } = this.props

		return (
			<div
				className={ClassNames(
					'studio-name-panel',
					isDashboardLayout ? (panel as DashboardLayoutStudioName).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutStudioName) : {}}
			>
				<div className="wrapper">
					<span className="studio-name-title">{t('Studio Name')}</span>
					<span className="studio-name">{this.props.studio.name}</span>
				</div>
			</div>
		)
	}
}

export const StudioNamePanel = withTranslation()(StudioNamePanelInner)
