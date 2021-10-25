import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutPartName,
	RundownLayoutBase,
	RundownLayoutPartName,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { findPieceInstanceToShowFromInstances, IFoundPieceInstance } from '../PieceIcons/utils'
import { pieceIconSupportedLayers } from '../PieceIcons/PieceIcon'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'

interface IPartNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPartName
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
}

interface IState {}

interface IPartNamePanelTrackedProps {
	name?: string
	instanceToShow?: IFoundPieceInstance
}

class PartNamePanelInner extends MeteorReactComponent<
	Translated<IPartNamePanelProps & IPartNamePanelTrackedProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t, panel } = this.props

		const sourceLayerType = this.props.instanceToShow?.sourceLayer?.type
		let backgroundSourceLayer = sourceLayerType ? sourceLayerTypeToString(sourceLayerType) : undefined

		if (!backgroundSourceLayer) {
			backgroundSourceLayer = ''
		}

		return (
			<div
				className={ClassNames('part-name-panel', {
					[backgroundSourceLayer || 'unknown']: true,
				})}
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutPartName) }),
								fontSize: ((panel as DashboardLayoutPartName).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<div className="wrapper">
					<span className="part-name-title">
						{this.props.panel.part === 'current' ? t('Current Part') : t('Next Part')}
					</span>
					<span className="part-name">{this.props.name}</span>
				</div>
			</div>
		)
	}
}

function sourceLayerTypeToString(sourceLayerType: SourceLayerType) {
	if (!sourceLayerType) return

	switch (sourceLayerType) {
		case SourceLayerType.GRAPHICS:
			return 'graphics'
		case SourceLayerType.LIVE_SPEAK:
			return 'live-speak'
		case SourceLayerType.REMOTE:
			return 'remote'
		case SourceLayerType.SPLITS:
			return 'splits'
		case SourceLayerType.VT:
			return 'vt'
		case SourceLayerType.CAMERA:
			return 'camera'
	}
}

export const PartNamePanel = translateWithTracker<IPartNamePanelProps, IState, IPartNamePanelTrackedProps>(
	(props) => {
		const selectedPartInstanceId =
			props.panel.part === 'current' ? props.playlist.currentPartInstanceId : props.playlist.nextPartInstanceId
		let name: string | undefined
		let instanceToShow: IFoundPieceInstance | undefined

		if (selectedPartInstanceId) {
			const selectedPartInstance = props.playlist.getActivePartInstances({ _id: selectedPartInstanceId })[0]
			if (selectedPartInstance && props.panel.showPieceIconColor) {
				name = selectedPartInstance.part?.title
				const pieceInstances = PieceInstances.find({ partInstanceId: selectedPartInstance._id }).fetch()
				instanceToShow = findPieceInstanceToShowFromInstances(
					pieceInstances,
					props.showStyleBase.sourceLayers.reduce((prev, curr) => {
						prev[curr._id] = curr
						return prev
					}, {}),
					pieceIconSupportedLayers
				)
			}
		}

		return {
			...props,
			name,
			instanceToShow,
		}
	},
	(data, props, nextProps) => {
		return (
			!_.isEqual(props.panel, nextProps.panel) ||
			props.playlist.currentPartInstanceId !== nextProps.playlist.currentPartInstanceId ||
			props.playlist.nextPartInstanceId !== nextProps.playlist.nextPartInstanceId
		)
	}
)(PartNamePanelInner)
