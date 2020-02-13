import * as React from 'react'
import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Segment } from '../../../lib/collections/Segments'
import { Part } from '../../../lib/collections/Parts'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { AdLibListItem } from './AdLibListItem'
import * as ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/mousetrapHelper'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as faTimes from '@fortawesome/fontawesome-free-solid/faTimes'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownViewKbdShortcuts } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction } from '../../lib/userAction'
import { UserActionAPI } from '../../../lib/api/userActions'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownLayoutFilter, DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal, getCurrentTime } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, AdLibPieceUi, matchFilter, AdLibPanelToolbar } from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { invalidateAt } from '../../lib/invalidatingTime'
import { IDashboardPanelProps, getUnfinishedPiecesReactive, DashboardPanelInner, IDashboardPanelTrackedProps, dashboardElementPosition } from './DashboardPanel'
import { BucketAdLib, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { Bucket } from '../../../lib/collections/Buckets';

const HOTKEY_GROUP = 'BucketPanel'

interface IState {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
}

export interface IBucketPanelProps {
	bucket: Bucket
	rundown: Rundown
	showStyleBase: ShowStyleBase
	shouldQueue: boolean
}

export interface IBucketPanelTrackedProps {
	adLibPieces: BucketAdLib[]
	unfinishedPieces: _.Dictionary<Piece[]>
	studio: Studio
}

export const BucketPanel = translateWithTracker<Translated<IBucketPanelProps>, IState, IBucketPanelTrackedProps>((props: Translated<IBucketPanelProps>) => {
	return literal<IBucketPanelTrackedProps>({
		adLibPieces: BucketAdLibs.find({
			bucketId: props.bucket._id
		}).fetch(),
		studio: props.rundown.getStudio(),
		unfinishedPieces: getUnfinishedPiecesReactive(props.rundown._id, props.rundown.currentPartId)
	})
}, (data, props: IBucketPanelProps, nextProps: IBucketPanelProps) => {
	return !_.isEqual(props, nextProps)
})(class BucketPanel extends MeteorReactComponent<Translated<IBucketPanelProps & IBucketPanelTrackedProps>, IState> {
	constructor (props: Translated<IBucketPanelProps & IBucketPanelTrackedProps>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {}
		}
	}

	static getDerivedStateFromProps (props: IAdLibPanelProps, state) {
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

	componentDidMount () {
		this.subscribe(PubSub.buckets, {
			_id: this.props.bucket._id
		})
		this.subscribe(PubSub.bucketAdLibPieces, {
			studioId: this.props.rundown.studioId,
			showStyleVariantId: this.props.rundown.showStyleVariantId
		})
		this.subscribe(PubSub.studios, {
			_id: this.props.rundown.studioId
		})
		this.subscribe(PubSub.showStyleBases, {
			_id: this.props.rundown.showStyleBaseId
		})
	}

	isAdLibOnAir (adLib: BucketAdLib) {
		if (this.props.unfinishedPieces[adLib._id] && this.props.unfinishedPieces[adLib._id].length > 0) {
			return true
		}
		return false
	}

	onClearAllSourceLayer = (sourceLayer: ISourceLayer, e: any) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.rundown && this.props.rundown.currentPartId) {
			doUserAction(t, e, UserActionAPI.methods.sourceLayerOnPartStop, [
				this.props.rundown._id, this.props.rundown.currentPartId, sourceLayer._id
			])
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
		if (this.props.rundown && this.props.rundown.currentPartId) {
			if (!this.isAdLibOnAir(piece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
				doUserAction(t, e, UserActionAPI.methods.bucketAdlibStart, [
					this.props.rundown._id, this.props.rundown.currentPartId, piece._id, queue || false
				])
			} else {
				if (sourceLayer && sourceLayer.clearKeyboardHotkey) {
					this.onClearAllSourceLayer(sourceLayer, e)
				}
			}
		}
	}

	render () {
		if (this.props.showStyleBase) {
			return (
				<div className='dashboard-panel'
					style={dashboardElementPosition({
						x: 0,
						y: 0,
						width: 9,
						height: -1
					})}
				>
					<h4 className='dashboard-panel__header'>
						{this.props.bucket.name}
					</h4>
					{/* { filter.enableSearch &&
						<AdLibPanelToolbar
							onFilterChange={this.onFilterChange} />
					} */}
					<div className={ClassNames('dashboard-panel__panel', 'dashboard-panel__panel--bucket')}>
						{this.props.adLibPieces
							.map((item: BucketAdLib) => {
								return <DashboardPieceButton
											key={item._id}
											item={item}
											layer={this.state.sourceLayers[item.sourceLayerId]}
											outputLayer={this.state.outputLayers[item.outputLayerId]}
											onToggleAdLib={this.onToggleAdLib}
											rundown={this.props.rundown}
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
	
