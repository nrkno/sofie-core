import * as React from 'react'
import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Segment } from '../../../lib/collections/Segments'
import { Part } from '../../../lib/collections/Parts'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { AdLibListItem, IAdLibListItem } from './AdLibListItem'
import * as ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/mousetrapHelper'

import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownViewKbdShortcuts } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction } from '../../lib/userAction'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownLayoutFilter, DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal, getCurrentTime, unprotectString } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, AdLibPieceUi, matchFilter, AdLibPanelToolbar } from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import { IDashboardPanelProps, getUnfinishedPieceInstancesReactive, DashboardPanelInner, IDashboardPanelTrackedProps, dashboardElementPosition } from './DashboardPanel'
import { BucketAdLib, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { Bucket } from '../../../lib/collections/Buckets'
import { Events as MOSEvents } from '../../lib/data/mos/plugin-support'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'
import { PieceInstanceId } from '../../../lib/collections/PieceInstances'

const HOTKEY_GROUP = 'BucketPanel'

interface IState {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	dropActive: boolean
}

export interface IBucketPanelProps {
	bucket: Bucket
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
	shouldQueue: boolean
}

export interface IBucketPanelTrackedProps {
	adLibPieces: BucketAdLib[]
	unfinishedPieceInstanceIds: _.Dictionary<PieceInstanceId[]>
	studio: Studio
}

export const BucketPanel = translateWithTracker<Translated<IBucketPanelProps>, IState, IBucketPanelTrackedProps>((props: Translated<IBucketPanelProps>) => {
	return literal<IBucketPanelTrackedProps>({
		adLibPieces: BucketAdLibs.find({
			bucketId: props.bucket._id
		}).fetch(),
		studio: props.playlist.getStudio(),
		unfinishedPieceInstanceIds: getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId)
	})
}, (data, props: IBucketPanelProps, nextProps: IBucketPanelProps) => {
	return !_.isEqual(props, nextProps)
})(class BucketPanel extends MeteorReactComponent<Translated<IBucketPanelProps & IBucketPanelTrackedProps>, IState> {
	constructor(props: Translated<IBucketPanelProps & IBucketPanelTrackedProps>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {},
			dropActive: false
		}
	}

	static getDerivedStateFromProps(props: IAdLibPanelProps, state) {
		let tOLayers: {
			[key: string]: IOutputLayer
		} = {}
		let tSLayers: {
			[key: string]: ISourceLayer
		} = {}

		if (props.showStyleBase && props.showStyleBase.outputLayers && props.showStyleBase.sourceLayers) {
			props.showStyleBase.outputLayers.forEach((item) => {
				tOLayers[item._id] = item
			})
			props.showStyleBase.sourceLayers.forEach((item) => {
				tSLayers[item._id] = item
			})

			return _.extend(state, {
				outputLayers: tOLayers,
				sourceLayers: tSLayers
			})
		} else {
			return state
		}
	}

	componentDidMount() {
		this.subscribe(PubSub.buckets, {
			_id: this.props.bucket._id
		})
		this.subscribe(PubSub.studios, {
			_id: this.props.playlist.studioId
		})
		this.autorun(() => {
			const showStyles = this.props.playlist.getRundowns().map(rundown => [rundown.showStyleBaseId, rundown.showStyleVariantId])
			const showStyleBases = showStyles.map(showStyle => showStyle[0])
			const showStyleVariants = showStyles.map(showStyle => showStyle[1])
			this.subscribe(PubSub.bucketAdLibPieces, {
				studioId: this.props.playlist.studioId,
				showStyleVariantId: {
					$in: showStyleVariants
				}
			})
			this.subscribe(PubSub.showStyleBases, {
				_id: {
					$in: showStyleBases
				}
			})
		})

		window.addEventListener(MOSEvents.dragenter, this.onDragEnter)
		window.addEventListener(MOSEvents.dragleave, this.onDragLeave)
	}

	componentWillUnmount() {
		window.removeEventListener(MOSEvents.dragenter, this.onDragEnter)
		window.removeEventListener(MOSEvents.dragleave, this.onDragLeave)
	}

	isAdLibOnAir(adLib: BucketAdLib) {
		if (this.props.unfinishedPieceInstanceIds[unprotectString(adLib._id)] && this.props.unfinishedPieceInstanceIds[unprotectString(adLib._id)].length > 0) {
			return true
		}
		return false
	}

	onDragEnter = () => {
		this.setState({
			dropActive: true
		})
	}

	onDragLeave = () => {
		this.setState({
			dropActive: false
		})
	}

	onClearAllSourceLayer = (sourceLayer: ISourceLayer, e: any) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const { t } = this.props
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			doUserAction(t, e, 'Stop Global Adlib', (e) =>
				MeteorCall.userAction.sourceLayerOnPartStop(e, this.props.playlist._id, currentPartInstanceId, [sourceLayer._id])
			)
		}
	}

	onToggleAdLib = (piece: BucketAdLib, queue: boolean, e: any) => {
		const { t } = this.props

		queue = queue || this.props.shouldQueue

		if (piece.invalid) {
			NotificationCenter.push(new Notification(
				t('Invalid AdLib'),
				NoticeLevel.WARNING,
				t('Cannot play this AdLib because it is marked as Invalid'),
				'toggleAdLib'))
			return
		}
		if (piece.floated) {
			NotificationCenter.push(new Notification(
				t('Floated AdLib'),
				NoticeLevel.WARNING,
				t('Cannot play this AdLib because it is marked as Floated'),
				'toggleAdLib'))
			return
		}

		let sourceLayer = this.state.sourceLayers && this.state.sourceLayers[piece.sourceLayerId]

		if (queue && sourceLayer && sourceLayer.isQueueable) {
			console.log(`Item "${piece._id}" is on sourceLayer "${piece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			if (!this.isAdLibOnAir(piece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
				const currentPartInstanceId = this.props.playlist.currentPartInstanceId
				doUserAction(t, e, 'Start Bucket AdLib', (e) =>
					MeteorCall.userAction.bucketAdlibStart(e, this.props.playlist._id, currentPartInstanceId, piece._id, queue || false)
				)
			} else {
				if (sourceLayer && sourceLayer.clearKeyboardHotkey) {
					this.onClearAllSourceLayer(sourceLayer, e)
				}
			}
		}
	}

	render() {
		if (this.props.showStyleBase) {
			return (
				<div className={ClassNames('dashboard-panel', 'dashboard-panel__panel--bucket', {
					'dashboard-panel__panel--bucket-active': this.state.dropActive
				})}
					style={dashboardElementPosition({
						x: -1,
						y: 0,
						width: 9,
						height: -1
					})}
				>
					<h4 className='dashboard-panel__header'>
						<FontAwesomeIcon icon={faBars} />&nbsp;{this.props.bucket.name}
					</h4>
					{/* { filter.enableSearch &&
						<AdLibPanelToolbar
							onFilterChange={this.onFilterChange} />
					} */}
					<div className='dashboard-panel__panel'>
						{this.props.adLibPieces
							.map((item) => {
								return <DashboardPieceButton
									key={unprotectString(item._id)}
									adLibListItem={item}
									layer={this.state.sourceLayers[item.sourceLayerId]}
									outputLayer={this.state.outputLayers[item.outputLayerId]}
									onToggleAdLib={this.onToggleAdLib}
									playlist={this.props.playlist}
									isOnAir={this.isAdLibOnAir(item)}
									mediaPreviewUrl={this.props.studio ? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || '' : ''}
									widthScale={1}
									heightScale={1}
								>
									{item.name}
								</DashboardPieceButton>
							})}
					</div>
				</div>
			)
		}
		return null
	}

})

