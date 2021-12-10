import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutPartName,
	RundownLayoutBase,
	RundownLayoutPartName,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist, RundownPlaylistCollectionUtil } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { findPieceInstanceToShowFromInstances, IFoundPieceInstance } from '../PieceIcons/utils'
import { pieceIconSupportedLayers } from '../PieceIcons/PieceIcon'
import { RundownUtils } from '../../lib/rundown'

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
		const { t } = this.props
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		const sourceLayerType = this.props.instanceToShow?.sourceLayer?.type
		let backgroundSourceLayer = sourceLayerType ? RundownUtils.getSourceLayerClassName(sourceLayerType) : undefined

		if (!backgroundSourceLayer) {
			backgroundSourceLayer = ''
		}

		return (
			<div
				className={ClassNames('part-name-panel', {
					[backgroundSourceLayer || 'unknown']: true,
				})}
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutPartName) : {}}
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

export const PartNamePanel = translateWithTracker<IPartNamePanelProps, IState, IPartNamePanelTrackedProps>(
	(props) => {
		const selectedPartInstanceId =
			props.panel.part === 'current' ? props.playlist.currentPartInstanceId : props.playlist.nextPartInstanceId
		let name: string | undefined
		let instanceToShow: IFoundPieceInstance | undefined

		if (selectedPartInstanceId) {
			const selectedPartInstance = RundownPlaylistCollectionUtil.getActivePartInstances(props.playlist, {
				_id: selectedPartInstanceId,
			})[0]
			name = selectedPartInstance.part?.title

			if (selectedPartInstance && props.panel.showPieceIconColor) {
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
