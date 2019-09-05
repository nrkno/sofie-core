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
import { IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, AdLibPieceUi, matchFilter, AdLibPanelToolbar } from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import { Piece, Pieces } from '../../../lib/collections/Pieces'

interface IState {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	},
	searchFilter: string | undefined
}

const BUTTON_GRID_WIDTH = 30
const BUTTON_GRID_HEIGHT = 26
const PANEL_MARGIN_WIDTH = 15
const PANEL_MARGIN_HEIGHT = 44

interface IDashboardPanelProps {
	searchFilter?: string | undefined
	mediaPreviewUrl?: string
}

interface IDashboardPanelTrackedProps {
	studio?: Studio
	unfinishedPieces: {
		[key: string]: Piece[]
	}
}

export const DashboardPanel = translateWithTracker<IAdLibPanelProps & IDashboardPanelProps, IState, IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	const unfinishedPieces = _.groupBy(props.rundown.currentPartId ? Pieces.find({
		rundownId: props.rundown._id,
		partId: props.rundown.currentPartId,
		startedPlayback: {
			$exists: true
		},
		$or: [{
			stoppedPlayback: {
				$eq: 0
			}
		}, {
			stoppedPlayback: {
				$exists: false
			}
		}],
		adLibSourceId: {
			$exists: true
		}
	}).fetch() : [], (piece) => piece.adLibSourceId)

	return Object.assign({}, fetchAndFilter(props), {
		studio: props.rundown.getStudio(),
		unfinishedPieces
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(class AdLibPanel extends MeteorReactComponent<Translated<IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor (props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {},
			searchFilter: undefined
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
		this.subscribe(PubSub.segments, {
			rundownId: this.props.rundown._id
		})
		this.subscribe(PubSub.parts, {
			rundownId: this.props.rundown._id
		})
		this.subscribe(PubSub.pieces, {
			rundownId: this.props.rundown._id,
			startedPlayback: {
				$exists: true
			},
			adLibSourceId: {
				$exists: true
			},
			$or: [{
				stoppedPlayback: {
					$eq: 0
				}
			}, {
				stoppedPlayback: {
					$exists: false
				}
			}]
		})
		this.subscribe(PubSub.adLibPieces, {
			rundownId: this.props.rundown._id
		})
		this.subscribe(PubSub.rundownBaselineAdLibPieces, {
			rundownId: this.props.rundown._id
		})
		this.subscribe(PubSub.studios, {
			_id: this.props.rundown.studioId
		})
		this.subscribe(PubSub.showStyleBases, {
			_id: this.props.rundown.showStyleBaseId
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

	isAdLibOnAir (adLib: AdLibPieceUi) {
		if (this.props.unfinishedPieces[adLib._id] && this.props.unfinishedPieces[adLib._id].length > 0) {
			return true
		}
		return false
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

		if (this.props.rundownBaselineAdLibs) {
			this.props.rundownBaselineAdLibs.forEach((item) => {
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

		if (this.props.sourceLayerLookup) {
			_.each(this.props.sourceLayerLookup, (item) => {
				if (item.clearKeyboardHotkey) {
					item.clearKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown')
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onClearAllSourceLayer(item, e)
						}, 'keyup')
						this.usedHotkeys.push(element)
					})

				}

				if (item.isSticky && item.activateStickyKeyboardHotkey) {
					item.activateStickyKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown')
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleSticky(item._id, e)
						}, 'keyup')
						this.usedHotkeys.push(element)
					})
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

		let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]

		if (queue && sourceLayer && sourceLayer.isQueueable) {
			console.log(`Item "${piece._id}" is on sourceLayer "${piece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.rundown && this.props.rundown.currentPartId) {
			if (!this.isAdLibOnAir(piece)) {
				if (!piece.isGlobal) {
					doUserAction(t, e, UserActionAPI.methods.segmentAdLibPieceStart, [
						this.props.rundown._id, this.props.rundown.currentPartId, piece._id, queue || false
					])
				} else if (piece.isGlobal && !piece.isSticky) {
					doUserAction(t, e, UserActionAPI.methods.baselineAdLibPieceStart, [
						this.props.rundown._id, this.props.rundown.currentPartId, piece._id, queue || false
					])
				} else if (piece.isSticky) {
					this.onToggleSticky(piece.sourceLayerId, e)
				}
			} else {
				if (sourceLayer && sourceLayer.clearKeyboardHotkey) {
					this.onClearAllSourceLayer(sourceLayer, e)
				}
			}
		}
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.rundown && this.props.rundown.currentPartId && this.props.rundown.active) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.sourceLayerStickyPieceStart, [this.props.rundown._id, sourceLayerId])
		}
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

	onFilterChange = (filter: string) => {
		this.setState({
			searchFilter: filter
		})
	}

	render () {
		if (this.props.visible && this.props.showStyleBase && this.props.filter) {
			const filter = this.props.filter as DashboardLayoutFilter
			if (!this.props.uiSegments || !this.props.rundown) {
				return <Spinner />
			} else {
				return (
					<div className='dashboard-panel'
						style={{
							width: filter.width >= 0 ?
								(filter.width * BUTTON_GRID_WIDTH) + PANEL_MARGIN_WIDTH :
								undefined,
							height: filter.height >= 0 ?
								(filter.height * BUTTON_GRID_HEIGHT) + PANEL_MARGIN_HEIGHT :
								undefined,
							left: filter.x >= 0 ?
								(filter.x * BUTTON_GRID_WIDTH) :
								filter.width < 0 ?
									((-1 * filter.width - 1) * BUTTON_GRID_WIDTH) :
									undefined,
							top: filter.y >= 0 ?
								(filter.y * BUTTON_GRID_HEIGHT) :
								filter.height < 0 ?
									((-1 * filter.height - 1) * BUTTON_GRID_HEIGHT) :
									undefined,
							right: filter.x < 0 ?
								((-1 * filter.x - 1) * BUTTON_GRID_WIDTH) :
								filter.width < 0 ?
									((-1 * filter.width - 1) * BUTTON_GRID_WIDTH) :
									undefined,
							bottom: filter.y < 0 ?
								((-1 * filter.y - 1) * BUTTON_GRID_HEIGHT) :
								filter.height < 0 ?
									((-1 * filter.height - 1) * BUTTON_GRID_HEIGHT) :
									undefined
						}}
					>
						<h4 className='dashboard-panel__header'>
							{this.props.filter.name}
						</h4>
						<div className='dashboard-panel__panel'>
							<AdLibPanelToolbar
								onFilterChange={this.onFilterChange}
								noSegments={false} />
							{_.flatten(this.props.uiSegments.map(seg => seg.pieces))
								.concat(this.props.rundownBaselineAdLibs)
								.sort((a, b) => a._rank - b._rank)
								.filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter, this.props.searchFilter))
								.map((item: AdLibPieceUi) => {
									return <DashboardPieceButton
												key={item._id}
												item={item}
												layer={this.state.sourceLayers[item.sourceLayerId]}
												outputLayer={this.state.outputLayers[item.outputLayerId]}
												onToggleAdLib={this.onToggleAdLib}
												rundown={this.props.rundown}
												isOnAir={this.isAdLibOnAir(item)}
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
