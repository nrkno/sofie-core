import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutEndsWords,
	RundownLayoutBase,
	RundownLayoutEndWords,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition, getUnfinishedPieceInstancesReactive } from './DashboardPanel'
import { Translated, translateWithTracker, withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { GetScriptPreview } from '../scriptPreview'

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
	(props: IEndsWordsPanelProps & IEndsWordsPanelTrackedProps) => {
		const unfinishedPieces = getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId, true)
		let livePieceInstance: PieceInstance | undefined
		let activeLayers = unfinishedPieces.map((p) => p.piece.sourceLayerId)
		let containsEveryRequiredLayer = props.panel.requireAllSourcelayers
			? props.panel.requiredLayers?.every((s) => activeLayers.includes(s))
			: false
		let containsRequiredLayer = containsEveryRequiredLayer
			? true
			: props.panel.requiredLayers && props.panel.requiredLayers.length
			? props.panel.requiredLayers.some((s) => activeLayers.includes(s))
			: false

		if (
			(!props.panel.requireAllSourcelayers || containsEveryRequiredLayer) &&
			(!props.panel.requiredLayers?.length || containsRequiredLayer)
		) {
			livePieceInstance =
				props.panel.scriptSourceLayerIds && props.panel.scriptSourceLayerIds.length
					? _.flatten(Object.values(unfinishedPieces)).find((piece: PieceInstance) => {
							return (
								(props.panel.scriptSourceLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
								piece.partInstanceId === props.playlist.currentPartInstanceId
							)
					  })
					: undefined
		}
		return { livePieceInstance }
	},
	(_data, props: IEndsWordsPanelProps, nextProps: IEndsWordsPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(EndWordsPanelInner)
