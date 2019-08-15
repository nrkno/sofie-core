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
import { literal } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, AdLibPieceUi } from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton';
import { ensureHasTrailingSlash } from '../../lib/lib';
import { Studio } from '../../../lib/collections/Studios';

interface IState {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
}

const BUTTON_GRID_WIDTH = 30
const BUTTON_GRID_HEIGHT = 26
const PANEL_MARGIN_WIDTH = 15
const PANEL_MARGIN_HEIGHT = 44

interface IDashboardPanelProps {
	mediaPreviewUrl?: string
}

interface IDashboardPanelTrackedProps {
	studio?: Studio
}

export const DashboardPanel = translateWithTracker<IAdLibPanelProps & IDashboardPanelProps, IState, IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	return Object.assign({}, fetchAndFilter(props), {
		studio: props.playlist.getStudio()
	})
})(class AdLibPanel extends MeteorReactComponent<Translated<IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor(props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
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
		this.subscribe(PubSub.rundowns, {
			playlistId: this.props.playlist._id
		})
		this.subscribe(PubSub.studios, {
			_id: this.props.playlist.studioId
		})
		this.autorun(() => {
			const rundowns = this.props.playlist.getRundowns()
			const rundownIds = rundowns.map(i => i._id)
			if (rundowns.length > 0) {
				this.subscribe(PubSub.segments, {
					rundownId: {
						$in: rundownIds
					}
				})
				this.subscribe(PubSub.parts, {
					rundownId: {
						$in: rundownIds
					}
				})
				this.subscribe(PubSub.adLibPieces, {
					rundownId: {
						$in: rundownIds
					}
				})
				this.subscribe(PubSub.rundownBaselineAdLibPieces, {
					rundownId: {
						$in: rundownIds
					}
				})
				this.subscribe(PubSub.showStyleBases, {
					_id: rundowns[0].showStyleBaseId
				})
			}
		})

		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate (prevProps: IAdLibPanelProps & IAdLibPanelTrackedProps) {
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup')
		this.usedHotkeys.length = 0

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount () {
		this._cleanUp()
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup')
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown')

		this.usedHotkeys.length = 0
	}

	refreshKeyboardHotkeys () {
		if (!this.props.studioMode) return
		if (!this.props.registerHotkeys) return

		let preventDefault = (e) => {
			e.preventDefault()
		}

		if (this.props.liveSegment && this.props.liveSegment.pieces) {
			this.props.liveSegment.pieces.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown')
					mousetrapHelper.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(item, false, e)
					}, 'keyup')
					this.usedHotkeys.push(item.hotkey)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown')
						mousetrapHelper.bind(queueHotkey, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(item, true, e)
						}, 'keyup')
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}
	}

	onToggleAdLib = (piece: AdLibPieceUi, queue: boolean, e: any) => {
		const { t } = this.props

		if (piece.invalid) {
			NotificationCenter.push(new Notification(
				t('Invalid AdLib'),
				NoticeLevel.WARNING,
				t('Cannot play this AdLib because it is marked as Invalid'),
				'toggleAdLib'))
			return
		}

		if (queue && this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId] &&
			!this.props.sourceLayerLookup[piece.sourceLayerId].isQueueable) {
			console.log(`Item "${piece._id}" is on sourceLayer "${piece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.playlist && this.props.playlist.currentPartId) {
			if (!piece.isGlobal) {
				doUserAction(t, e, UserActionAPI.methods.segmentAdLibPieceStart, [
					this.props.playlist._id, this.props.playlist.currentPartId, piece._id, queue || false
				])
			} else if (piece.isGlobal && !piece.isSticky) {
				doUserAction(t, e, UserActionAPI.methods.baselineAdLibPieceStart, [
					this.props.playlist._id, this.props.playlist.currentPartId, piece._id, queue || false
				])
			} else if (piece.isSticky) {
				doUserAction(t, e, UserActionAPI.methods.sourceLayerStickyPieceStart, [
					this.props.playlist._id, piece.sourceLayerId
				])
			}
		}
	}

	onClearAllSourceLayer = (sourceLayer: ISourceLayer, e: any) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.playlist && this.props.playlist.currentPartId) {
			doUserAction(t, e, UserActionAPI.methods.sourceLayerOnPartStop, [
				this.props.playlist._id, this.props.playlist.currentPartId, sourceLayer._id
			])
		}
	}

	matchFilter(item: AdLibPieceUi) {
		if (!this.props.filter) return true
		const liveSegment = this.props.uiSegments.find(i => i.isLive === true)
		const uppercaseLabel = item.name.toUpperCase()
		if (this.props.filter) {
			// Filter currentSegment only
			if (
				this.props.filter.currentSegment === true &&
				(
					(liveSegment && liveSegment.parts.find(i => item.partId === i._id) === undefined) ||
					(!liveSegment)
				)
			) {
				return false
			}
			// Filter out items that are not within outputLayerIds filter
			if (
				this.props.filter.outputLayerIds !== undefined &&
				this.props.filter.outputLayerIds.indexOf(item.outputLayerId) < 0
			) {
				return false
			}
			// Source layers
			if (
				this.props.filter.sourceLayerIds !== undefined &&
				this.props.filter.sourceLayerIds.indexOf(item.sourceLayerId) < 0
			) {
				return false
			}
			// Source layer types
			const sourceLayerType = this.props.showStyleBase.sourceLayers.find(i => i._id === item.sourceLayerId)
			if (
				sourceLayerType &&
				this.props.filter.sourceLayerTypes !== undefined &&
				this.props.filter.sourceLayerTypes.indexOf(sourceLayerType.type) < 0
			) {
				return false
			}
			// Item label needs at least one of the strings in the label array
			if (
				this.props.filter.label !== undefined &&
				this.props.filter.label.reduce((p, v) => {
					return p || uppercaseLabel.indexOf(v) >= 0
				}, false) === false
			) {
				return false
			}
		}

		return true
	}

	render () {
		if (this.props.visible && this.props.showStyleBase && this.props.filter) {
			const filter = this.props.filter as DashboardLayoutFilter
			if (!this.props.uiSegments || !this.props.playlist) {
				return <Spinner />
			} else {
				return (
					<div className='dashboard-panel'
						style={{
							width: (filter.width * BUTTON_GRID_WIDTH) + PANEL_MARGIN_WIDTH,
							height: (filter.height * BUTTON_GRID_HEIGHT) + PANEL_MARGIN_HEIGHT,
							left: filter.x >= 0 ? (filter.x * BUTTON_GRID_WIDTH) : undefined,
							top: filter.y >= 0 ? (filter.y * BUTTON_GRID_HEIGHT) : undefined,
							right: filter.x < 0 ? ((-1 * filter.x - 1) * BUTTON_GRID_WIDTH) : undefined,
							bottom: filter.y < 0 ? ((-1 * filter.y - 1) * BUTTON_GRID_HEIGHT) : undefined
						}}
					>
						<h4 className='dashboard-panel__header'>
							{this.props.filter.name}
						</h4>
						<div className='dashboard-panel__panel'>
							{_.flatten(this.props.uiSegments.map(seg => seg.pieces))
								.concat(this.props.rundownBaselineAdLibs)
								.sort((a, b) => a._rank - b._rank)
								.filter((item) => this.matchFilter(item))
								.map((item: AdLibPieceUi) => {
									return <DashboardPieceButton
												key={item._id}
												item={item}
												layer={this.state.sourceLayers[item.sourceLayerId]}
												outputLayer={this.state.outputLayers[item.outputLayerId]}
												onToggleAdLib={this.onToggleAdLib}
												playlist={this.props.playlist}
												mediaPreviewUrl={this.props.studio ? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || '' : ''}
											>
												{item.name}
									</DashboardPieceButton>
								})}
						</div>
					</div>
				)
			}
		}
		return null
	}
})