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
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { findPieceInstanceToShowFromInstances, IFoundPieceInstance } from '../PieceIcons/utils'
import { pieceIconSupportedLayers } from '../PieceIcons/PieceIcon'
import { RundownUtils } from '../../lib/rundown'
import { UIShowStyleBase } from '../../../lib/api/showStyles'
import { PieceInstances } from '../../collections'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/rundownPlaylistUtil'

interface IPartNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPartName
	playlist: RundownPlaylist
	showStyleBase: UIShowStyleBase
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

	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t } = this.props

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
			props.panel.part === 'current'
				? props.playlist.currentPartInfo?.partInstanceId
				: props.playlist.nextPartInfo?.partInstanceId
		let name: string | undefined
		let instanceToShow: IFoundPieceInstance | undefined

		if (selectedPartInstanceId) {
			const selectedPartInstance = RundownPlaylistCollectionUtil.getActivePartInstances(props.playlist, {
				_id: selectedPartInstanceId,
			})[0]
			if (selectedPartInstance && props.panel.showPieceIconColor) {
				name = selectedPartInstance.part?.title
				const pieceInstances = PieceInstances.find({ partInstanceId: selectedPartInstance._id }).fetch()
				instanceToShow = findPieceInstanceToShowFromInstances(
					pieceInstances,
					props.showStyleBase.sourceLayers,
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
	(_data, props, nextProps) => {
		return (
			!_.isEqual(props.panel, nextProps.panel) ||
			props.playlist.currentPartInfo?.partInstanceId !== nextProps.playlist.currentPartInfo?.partInstanceId ||
			props.playlist.nextPartInfo?.partInstanceId !== nextProps.playlist.nextPartInfo?.partInstanceId
		)
	}
)(PartNamePanelInner)
