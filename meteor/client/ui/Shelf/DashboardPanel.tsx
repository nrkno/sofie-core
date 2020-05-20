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
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownLayoutFilter, DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal, unprotectString, getCurrentTime } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, AdLibPieceUi, matchFilter, AdLibPanelToolbar } from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import { Piece, Pieces, PieceId } from '../../../lib/collections/Pieces'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { MeteorCall } from '../../../lib/api/methods'
import { invalidateAt } from '../../lib/invalidatingTime'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { getNextPiecesReactive } from './AdLibRegionPanel'

interface IState {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	},
	searchFilter: string | undefined,
	selectedAdLib?: AdLibPieceUi
}

interface IDashboardPanelProps {
	shouldQueue: boolean
}

interface IDashboardPanelTrackedProps {
	studio?: Studio
	unfinishedPieceInstanceIds: {
		[adlibId: string]: PieceInstance[]
	}
	nextPieces: {
		[key: string]: PieceInstance[]
	}
}

const HOTKEY_GROUP = 'DashboardPanel'

interface DashboardPositionableElement {
	x: number
	y: number
	width: number
	height: number
}

export function dashboardElementPosition (el: DashboardPositionableElement): React.CSSProperties {
	return {
		width: el.width >= 0 ?
			`calc((${el.width} * var(--dashboard-button-grid-width)) + var(--dashboard-panel-margin-width))` :
			undefined,
		height: el.height >= 0 ?
			`calc((${el.height} * var(--dashboard-button-grid-height)) + var(--dashboard-panel-margin-height))` :
			undefined,
		left: el.x >= 0 ?
			`calc(${el.x} * var(--dashboard-button-grid-width))` :
			el.width < 0 ?
				`calc(${-1 * el.width - 1} * var(--dashboard-button-grid-width))` :
				undefined,
		top: el.y >= 0 ?
			`calc(${el.y} * var(--dashboard-button-grid-height))` :
			el.height < 0 ?
				`calc(${-1 * el.height - 1} * var(--dashboard-button-grid-height))` :
				undefined,
		right: el.x < 0 ?
			`calc(${-1 * el.x - 1} * var(--dashboard-button-grid-width))` :
			el.width < 0 ?
				`calc(${-1 * el.width - 1} * var(--dashboard-button-grid-width))` :
				undefined,
		bottom: el.y < 0 ?
			`calc(${-1 * el.y - 1} * var(--dashboard-button-grid-height))` :
			el.height < 0 ?
				`calc(${-1 * el.height - 1} * var(--dashboard-button-grid-height))` :
				undefined
	}
}

export class DashboardPanelInner extends MeteorReactComponent<Translated<IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>, IState> {
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
			props.showStyleBase.outputLayers.forEach((outputLayer) => {
				tOLayers[outputLayer._id] = outputLayer
			})
			props.showStyleBase.sourceLayers.forEach((sourceLayer) => {
				tSLayers[sourceLayer._id] = sourceLayer
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
				this.subscribe(PubSub.partInstances, {
					rundownId: {
						$in: rundownIds
					},
					reset: {
						$ne: true
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
				this.subscribe(PubSub.pieces, {
					rundownId: {
						$in: rundownIds
					},
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
			}
		})

		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate (prevProps: IAdLibPanelProps & IAdLibPanelTrackedProps) {
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', HOTKEY_GROUP)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', HOTKEY_GROUP)
		this.usedHotkeys.length = 0

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount () {
		this._cleanUp()
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', HOTKEY_GROUP)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', HOTKEY_GROUP)

		this.usedHotkeys.length = 0
	}

	isAdLibOnAir (adLib: AdLibPieceUi) {
		if (this.props.unfinishedPieceInstanceIds[unprotectString(adLib._id)] && this.props.unfinishedPieceInstanceIds[unprotectString(adLib._id)].length > 0) {
			return true
		}
		return false
	}

	isAdLibNext (adLib: AdLibPieceUi) {
		if (this.props.nextPieces[unprotectString(adLib._id)] && this.props.nextPieces[unprotectString(adLib._id)].length > 0) {
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
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown', HOTKEY_GROUP)
					mousetrapHelper.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(item, false, e)
					}, 'keyup', HOTKEY_GROUP)
					this.usedHotkeys.push(item.hotkey)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown', HOTKEY_GROUP)
						mousetrapHelper.bind(queueHotkey, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(item, true, e)
						}, 'keyup', HOTKEY_GROUP)
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}

		if (this.props.rundownBaselineAdLibs) {
			this.props.rundownBaselineAdLibs.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown', HOTKEY_GROUP)
					mousetrapHelper.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(item, false, e)
					}, 'keyup', HOTKEY_GROUP)
					this.usedHotkeys.push(item.hotkey)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown', HOTKEY_GROUP)
						mousetrapHelper.bind(queueHotkey, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(item, true, e)
						}, 'keyup', HOTKEY_GROUP)
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}

		if (this.props.sourceLayerLookup) {

			const clearKeyboardHotkeySourceLayers: {[hotkey: string]: ISourceLayer[]} = {}

			_.each(this.props.sourceLayerLookup, (sourceLayer) => {
				if (sourceLayer.clearKeyboardHotkey) {
					sourceLayer.clearKeyboardHotkey.split(',').forEach(hotkey => {
						if (!clearKeyboardHotkeySourceLayers[hotkey]) clearKeyboardHotkeySourceLayers[hotkey] = []
						clearKeyboardHotkeySourceLayers[hotkey].push(sourceLayer)
					})
				}

				if (sourceLayer.isSticky && sourceLayer.activateStickyKeyboardHotkey) {
					sourceLayer.activateStickyKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown', HOTKEY_GROUP)
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleSticky(sourceLayer._id, e)
						}, 'keyup', HOTKEY_GROUP)
						this.usedHotkeys.push(element)
					})
				}
			})

			_.each(clearKeyboardHotkeySourceLayers, (sourceLayers, hotkey) => {
				mousetrapHelper.bind(hotkey, preventDefault, 'keydown', HOTKEY_GROUP)
				mousetrapHelper.bind(hotkey, (e: ExtendedKeyboardEvent) => {
					preventDefault(e)
					this.onClearAllSourceLayers(sourceLayers, e)
				}, 'keyup', HOTKEY_GROUP)
				this.usedHotkeys.push(hotkey)
			})
		}
	}

	onToggleAdLib = (adlibPiece: AdLibPieceUi, queue: boolean, e: any) => {
		const { t } = this.props

		queue = queue || this.props.shouldQueue

		if (adlibPiece.invalid) {
			NotificationCenter.push(new Notification(
				t('Invalid AdLib'),
				NoticeLevel.WARNING,
				t('Cannot play this AdLib because it is marked as Invalid'),
				'toggleAdLib'))
			return
		}
		if (adlibPiece.floated) {
			NotificationCenter.push(new Notification(
				t('Floated AdLib'),
				NoticeLevel.WARNING,
				t('Cannot play this AdLib because it is marked as Floated'),
				'toggleAdLib'))
			return
		}

		let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[adlibPiece.sourceLayerId]

		if (queue && sourceLayer && sourceLayer.isQueueable) {
			console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (!this.isAdLibOnAir(adlibPiece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
				if (!adlibPiece.isGlobal) {
					doUserAction(t, e, 'Start playing Adlib', (e) => MeteorCall.userAction.segmentAdLibPieceStart(e,
						this.props.playlist._id,
						currentPartInstanceId,
						adlibPiece._id, queue || false
					))
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(t, e, 'Start playing Adlib', (e) => MeteorCall.userAction.baselineAdLibPieceStart(e,
						this.props.playlist._id,
						currentPartInstanceId,
						adlibPiece._id, queue || false
					))
				} else if (adlibPiece.isSticky) {
					this.onToggleSticky(adlibPiece.sourceLayerId, e)
				}
			} else {
				if (sourceLayer && sourceLayer.clearKeyboardHotkey) {
					this.onClearAllSourceLayers([sourceLayer], e)
				}
			}
		}
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.playlist && this.props.playlist.currentPartInstanceId && this.props.playlist.active) {
			const { t } = this.props
			doUserAction(t, e, '', (e) => MeteorCall.userAction.sourceLayerStickyPieceStart(e, this.props.playlist._id, sourceLayerId))
		}
	}

	onClearAllSourceLayers = (sourceLayers: ISourceLayer[], e: any) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const playlistId = this.props.playlist._id
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			doUserAction(t, e, 'Stopping SourceLayer', (e) => MeteorCall.userAction.sourceLayerOnPartStop(e,
				playlistId,
				currentPartInstanceId,
				_.map(sourceLayers, sl => sl._id)
			))
		}
	}

	onFilterChange = (filter: string) => {
		this.setState({
			searchFilter: filter
		})
	}

	onIn = (e: any) => {
		const { t } = this.props
		if (this.state.selectedAdLib) {
			const piece = this.state.selectedAdLib
			let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]
			if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
				if (!this.isAdLibOnAir(piece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
					if (!piece.isGlobal) {
						doUserAction(t, e, 'Start playing Adlib', (e) => MeteorCall.userAction.segmentAdLibPieceStart(e,
							this.props.playlist._id,
							this.props.playlist.currentPartInstanceId as PartInstanceId,
							piece._id,
							false
						))
					} else if (piece.isGlobal && !piece.isSticky) {
						doUserAction(t, e, 'Start playing Adlib', (e) => MeteorCall.userAction.baselineAdLibPieceStart(e,
							this.props.playlist._id,
							this.props.playlist.currentPartInstanceId as PartInstanceId,
							piece._id,
							false
						))
					} else if (piece.isSticky) {
						this.onToggleSticky(piece.sourceLayerId, e)
					}
				}
			}
		}
	}

	onOut = (e: any, outButton?: boolean) => {
		const { t } = this.props
		if (this.state.selectedAdLib) {
			const piece = this.state.selectedAdLib
			let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]
			if (sourceLayer && (sourceLayer.clearKeyboardHotkey || outButton)) {
				this.onClearAllSourceLayers([sourceLayer], e)
			}
		}
	}

	onSelectAdLib = (piece: AdLibPieceUi, queue: boolean, e: any) => {
		this.setState({
			selectedAdLib: piece
		})
	}

	render () {
		const { t } = this.props
		if (this.props.visible && this.props.showStyleBase && this.props.filter) {
			const filter = this.props.filter as DashboardLayoutFilter
			if (!this.props.uiSegments || !this.props.playlist) {
				return <Spinner />
			} else {
				return (
					<div className={ClassNames('dashboard-panel', {
						'dashboard-panel--take': filter.displayTakeButtons
					})}
						style={dashboardElementPosition(filter)}
					>
						<h4 className='dashboard-panel__header'>
							{this.props.filter.name}
						</h4>
						{ filter.enableSearch &&
							<AdLibPanelToolbar
								onFilterChange={this.onFilterChange} />
						}
						<div className={ClassNames('dashboard-panel__panel', {
							'dashboard-panel__panel--horizontal': filter.overflowHorizontally
						})}>
							{this.props.rundownBaselineAdLibs
								.concat(_.flatten(this.props.uiSegments.map(seg => seg.pieces)))
								.filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter, this.state.searchFilter))
								.map((adLibPiece: AdLibPieceUi) => {
									return <DashboardPieceButton
												key={unprotectString(adLibPiece._id)}
												adLibListItem={adLibPiece}
												layer={this.state.sourceLayers[adLibPiece.sourceLayerId]}
												outputLayer={this.state.outputLayers[adLibPiece.outputLayerId]}
												onToggleAdLib={filter.displayTakeButtons ? this.onSelectAdLib : this.onToggleAdLib}
												playlist={this.props.playlist}
												isOnAir={this.isAdLibOnAir(adLibPiece)}
												isNext={this.isAdLibNext(adLibPiece)}
												mediaPreviewUrl={this.props.studio ? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || '' : ''}
												widthScale={filter.buttonWidthScale}
												heightScale={filter.buttonHeightScale}
												displayStyle={filter.displayStyle}
												showThumbnailsInList={filter.showThumbnailsInList}
												isSelected={this.state.selectedAdLib && adLibPiece._id === this.state.selectedAdLib._id}
											>
												{adLibPiece.name}
									</DashboardPieceButton>
								})}
						</div>
						{filter.displayTakeButtons &&
							<div className='dashboard-panel__buttons'>
								<div className={ClassNames('dashboard-panel__panel__button')}
									onClick={(e) => { this.onIn(e) }}
								>
									<span className='dashboard-panel__panel__button__label'>{t('In')}</span>
								</div>
								<div className={ClassNames('dashboard-panel__panel__button')}
									onClick={(e) => { this.onOut(e, true) }}
								>
									<span className='dashboard-panel__panel__button__label'>{t('Out')}</span>
								</div>
							</div>
						}
					</div>
				)
			}
		}
		return null
	}
}

export function getUnfinishedPieceInstancesReactive (currentPartInstanceId: PartInstanceId | null) {
	let prospectivePieces: PieceInstance[] = []
	const now = getCurrentTime()
	if (currentPartInstanceId) {
		prospectivePieces = PieceInstances.find({
			'piece.startedPlayback': {
				$exists: true
			},
			$and: [
				{
					$or: [{
						'piece.stoppedPlayback': {
							$eq: 0
						}
					}, {
						'piece.stoppedPlayback': {
							$exists: false
						}
					}],
				},
				{
					'piece.definitelyEnded': {
						$exists: false
					}
				}
			],
			'piece.playoutDuration': {
				$exists: false
			},
			'piece.adLibSourceId': {
				$exists: true
			},
			$or: [
				{
					'piece.userDuration': {
						$exists: false
					}
				},
				{
					'piece.userDuration.duration': {
						$exists: false
					}
				}
			]
		}).fetch()

		let nearestEnd = Number.POSITIVE_INFINITY
		prospectivePieces = prospectivePieces.filter((pieceInstance) => {
			const piece = pieceInstance.piece
			let duration: number | undefined =
				(piece.playoutDuration) ?
					piece.playoutDuration :
				(piece.userDuration && typeof piece.userDuration.duration === 'number') ?
					piece.userDuration.duration :
				(piece.userDuration && typeof piece.userDuration.end === 'string') ?
					0 : // TODO: obviously, it would be best to evaluate this, but for now we assume that userDuration of any sort is probably in the past
				(typeof piece.enable.duration === 'number') ?
					piece.enable.duration :
					undefined

			if (duration !== undefined) {
				const end = (piece.startedPlayback! + duration)
				if (end > now) {
					nearestEnd = nearestEnd > end ? end : nearestEnd
					return true
				} else {
					return false
				}
			}
			return true
		})

		if (Number.isFinite(nearestEnd)) invalidateAt(nearestEnd)
	}

	// Convert to array of ids as that is all that is needed
	const unfinishedPieceInstanceIds: { [adlibId: string]: PieceInstance[] } = {}
	_.each(_.groupBy(prospectivePieces, (piece) => piece.piece.adLibSourceId), (grp, id) => unfinishedPieceInstanceIds[id] = _.map(grp, instance => instance))

	return unfinishedPieceInstanceIds
}

export const DashboardPanel = translateWithTracker<Translated<IAdLibPanelProps & IDashboardPanelProps>, IState, IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	return Object.assign({}, fetchAndFilter(props), {
		studio: props.playlist.getStudio(),
		unfinishedPieceInstanceIds: getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId),
		nextPieces: getNextPiecesReactive(props.playlist.nextPartInstanceId)
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(DashboardPanelInner)
