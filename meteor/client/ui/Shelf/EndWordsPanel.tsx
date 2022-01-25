import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutEndsWords,
	RundownLayoutBase,
	RundownLayoutEndWords,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { GetScriptPreview } from '../scriptPreview'
import { getIsFilterActive } from '../../lib/rundownLayouts'
import { DBShowStyleBase } from '../../../lib/collections/ShowStyleBases'

interface IEndsWordsPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutEndWords
	playlist: RundownPlaylist
	showStyleBase: DBShowStyleBase
}

interface IEndsWordsPanelTrackedProps {
	livePieceInstance?: PieceInstance
}

interface IState {}

export class EndWordsPanelInner extends MeteorReactComponent<
	Translated<IEndsWordsPanelProps & IEndsWordsPanelTrackedProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		const { t, livePieceInstance, panel } = this.props
		const content = livePieceInstance?.piece.content as Partial<ScriptContent> | undefined

		const { endOfScript } = GetScriptPreview(content?.fullScript || '')

		return (
			<div
				className={ClassNames(
					'end-words-panel timing',
					isDashboardLayout ? (panel as DashboardLayoutEndsWords).customClasses : undefined
				)}
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutEndsWords) }),
								fontSize: ((panel as DashboardLayoutEndsWords).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<div className="timing-clock left">
					{!this.props.panel.hideLabel && <span className="timing-clock-label">{t('End Words')}</span>}
					<span className="text">&lrm;{endOfScript}&lrm;</span>
				</div>
			</div>
		)
	}
}

export const EndWordsPanel = translateWithTracker<IEndsWordsPanelProps, IState, IEndsWordsPanelTrackedProps>(
	(props: IEndsWordsPanelProps) => {
		const { activePieceInstance } = getIsFilterActive(props.playlist, props.showStyleBase, props.panel)
		return { livePieceInstance: activePieceInstance }
	},
	(_data, props: IEndsWordsPanelProps, nextProps: IEndsWordsPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(EndWordsPanelInner)
