import * as React from 'react'
import * as _ from 'underscore'
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

interface IEndsWordsPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutEndWords
	playlist: RundownPlaylist
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

		let { t, livePieceInstance, panel } = this.props
		let content = livePieceInstance?.piece.content as Partial<ScriptContent> | undefined

		let { endOfScript } = GetScriptPreview(content?.fullScript || '')

		return (
			<div
				className="end-words-panel timing"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutEndsWords), height: 1 }),
								fontSize: ((panel as DashboardLayoutEndsWords).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<div className="timing-clock left">
					<span className="timing-clock-label">{t('End Words')}</span>
					<span className="text">&lrm;{endOfScript}&lrm;</span>
				</div>
			</div>
		)
	}
}

export const EndWordsPanel = translateWithTracker<IEndsWordsPanelProps, IState, IEndsWordsPanelTrackedProps>(
	(props: IEndsWordsPanelProps) => {
		let { activePieceInstance } = getIsFilterActive(props.playlist, props.panel)
		return { livePieceInstance: activePieceInstance }
	},
	(_data, props: IEndsWordsPanelProps, nextProps: IEndsWordsPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(EndWordsPanelInner)
