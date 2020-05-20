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
import { IOutputLayer, ISourceLayer, PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction } from '../../lib/userAction'
import { UserActionAPI } from '../../../lib/api/userActions'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownLayoutFilter, DashboardLayoutFilter, PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
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
import { registerHotkey, HotkeyAssignmentType, RegisteredHotkeys } from '../../lib/hotkeyRegistry'
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

export interface IDashboardPanelProps {
	searchFilter?: string | undefined
	mediaPreviewUrl?: string
	shouldQueue: boolean
	hotkeyGroup: string
}

interface IDashboardPanelTrackedProps {
	studio?: Studio
	unfinishedPieces: {
		[key: string]: Piece[]
	}
	nextPieces: {
		[key: string]: Piece[]
	}
}

interface DashboardPositionableElement {
	x: number
	y: number
	width: number
	height: number
	scale?: number
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
				undefined,
		'--dashboard-panel-scale': el.scale || undefined
	}
}

export class DashboardPanelInner extends MeteorReactComponent<Translated<IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor (props: Translated<IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>) {
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
			rundownId: this.props.rundown._id
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

	componentDidUpdate (prevProps: IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps) {
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', this.props.hotkeyGroup)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', this.props.hotkeyGroup)
		this.usedHotkeys.length = 0

		// Unregister hotkeys if group name has changed
		if (prevProps.hotkeyGroup !== this.props.hotkeyGroup) {
			RegisteredHotkeys.remove({
				tag: prevProps.hotkeyGroup
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount () {
		this._cleanUp()
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', this.props.hotkeyGroup)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', this.props.hotkeyGroup)

		RegisteredHotkeys.remove({
			tag: this.props.hotkeyGroup
		})

		this.usedHotkeys.length = 0
	}

	isAdLibOnAir (adLib: AdLibPieceUi) {
		if (this.props.unfinishedPieces[adLib._id] && this.props.unfinishedPieces[adLib._id].length > 0) {
			return true
		}
		return false
	}

	isAdLibNext (adLib: AdLibPieceUi) {
		if (this.props.nextPieces[adLib._id] && this.props.nextPieces[adLib._id].length > 0) {
			return true
		}
		return false
	}

	refreshKeyboardHotkeys () {
		if (!this.props.studioMode) return

		// Unregister even when "registerHotkeys" is false, in the case that it has just been toggled off.
		RegisteredHotkeys.remove({
			tag: this.props.hotkeyGroup
		})

		if (!this.props.registerHotkeys) return

		const { t } = this.props

		let preventDefault = (e) => {
			e.preventDefault()
		}

		if (this.props.liveSegment && this.props.liveSegment.pieces) {
			this.props.liveSegment.pieces.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
					mousetrapHelper.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(e, item, false)
					}, 'keyup', this.props.hotkeyGroup)
					this.usedHotkeys.push(item.hotkey)

					registerHotkey(
						item.hotkey,
						item.name,
						HotkeyAssignmentType.ADLIB,
						this.props.sourceLayerLookup[item.sourceLayerId],
						item.toBeQueued || false,
						this.onToggleAdLib,
						[item, false],
						this.props.hotkeyGroup
					)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
						mousetrapHelper.bind(queueHotkey, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(e, item, true)
						}, 'keyup', this.props.hotkeyGroup)
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}

		if (this.props.rundownBaselineAdLibs) {
			this.props.rundownBaselineAdLibs.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
					mousetrapHelper.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(e, item, false)
					}, 'keyup', this.props.hotkeyGroup)
					this.usedHotkeys.push(item.hotkey)

					registerHotkey(
						item.hotkey,
						item.name,
						HotkeyAssignmentType.ADLIB,
						this.props.sourceLayerLookup[item.sourceLayerId],
						item.toBeQueued || false,
						this.onToggleAdLib,
						[item, false],
						this.props.hotkeyGroup
					)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
						mousetrapHelper.bind(queueHotkey, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(e, item, true)
						}, 'keyup', this.props.hotkeyGroup)
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}

		if (this.props.sourceLayerLookup) {
			const clearKeyboardHotkeySourceLayers: { [hotkey: string]: ISourceLayer[] } = {}

			_.each(this.props.sourceLayerLookup, (sourceLayer) => {
				if (sourceLayer.clearKeyboardHotkey) {
					sourceLayer.clearKeyboardHotkey.split(',').forEach(hotkey => {
						if (!clearKeyboardHotkeySourceLayers[hotkey]) clearKeyboardHotkeySourceLayers[hotkey] = []
						clearKeyboardHotkeySourceLayers[hotkey].push(sourceLayer)
					})
				}

				if (sourceLayer.isSticky && sourceLayer.activateStickyKeyboardHotkey) {
					sourceLayer.activateStickyKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown', this.props.hotkeyGroup)
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleSticky(e, sourceLayer._id)
						}, 'keyup', this.props.hotkeyGroup)
						this.usedHotkeys.push(element)

						registerHotkey(
							element,
							t('Recall last {{layerNames}}', { layerNames: sourceLayer.name }),
							HotkeyAssignmentType.ADLIB,
							sourceLayer,
							false,
							this.onToggleSticky,
							[sourceLayer._id],
							this.props.hotkeyGroup
						)
					})
				}
			})

			_.each(clearKeyboardHotkeySourceLayers, (sourceLayers, hotkey) => {
				mousetrapHelper.bind(hotkey, preventDefault, 'keydown', this.constructor.name)
				mousetrapHelper.bind(hotkey, (e: ExtendedKeyboardEvent) => {
					preventDefault(e)
					this.onClearAllSourceLayers(e, sourceLayers)
				}, 'keyup', this.props.hotkeyGroup)
				this.usedHotkeys.push(hotkey)

				registerHotkey(
					hotkey,
					t('Clear {{layerNames}}', { layerNames: _.unique(sourceLayers.map(sourceLayer => sourceLayer.name)).join(', ') }),
					HotkeyAssignmentType.GLOBAL_ADLIB,
					undefined,
					false,
					this.onClearAllSourceLayers,
					[sourceLayers],
					this.props.hotkeyGroup
				)
			})
		}
	}

	onToggleAdLib = (e: any, piece: AdLibPieceUi, queue: boolean, alwaysQueue: boolean = false) => {
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

		let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]

		if (queue && sourceLayer && sourceLayer.isQueueable) {
			console.log(`Item "${piece._id}" is on sourceLayer "${piece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.rundown && this.props.rundown.currentPartId) {
			if (!this.isAdLibOnAir(piece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey) || alwaysQueue) {
				if (!piece.isGlobal) {
					doUserAction(t, e, UserActionAPI.methods.segmentAdLibPieceStart, [
						this.props.rundown._id, this.props.rundown.currentPartId, piece._id, queue || alwaysQueue || false
					])
				} else if (piece.isGlobal && !piece.isSticky) {
					doUserAction(t, e, UserActionAPI.methods.baselineAdLibPieceStart, [
						this.props.rundown._id, this.props.rundown.currentPartId, piece._id, queue || alwaysQueue || false
					])
				} else if (piece.isSticky) {
					this.onToggleSticky(e, piece.sourceLayerId)
				}
			} else {
				if (sourceLayer && sourceLayer.clearKeyboardHotkey) {
					this.onClearAllSourceLayers(e, [sourceLayer])
				}
			}
		}
	}

	onToggleSticky = (e: any, sourceLayerId: string) => {
		if (this.props.rundown && this.props.rundown.currentPartId && this.props.rundown.active) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.sourceLayerStickyPieceStart, [this.props.rundown._id, sourceLayerId])
		}
	}

	onClearAllSourceLayers = (e: any, sourceLayers: ISourceLayer[]) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.rundown && this.props.rundown.currentPartId) {
			doUserAction(t, e, UserActionAPI.methods.sourceLayerOnPartStop, [
				this.props.rundown._id, this.props.rundown.currentPartId, _.map(sourceLayers, sl => sl._id)
			])
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
			if (this.props.rundown && this.props.rundown.currentPartId) {
				if (!this.isAdLibOnAir(piece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
					if (!piece.isGlobal) {
						doUserAction(t, e, UserActionAPI.methods.segmentAdLibPieceStart, [
							this.props.rundown._id, this.props.rundown.currentPartId, piece._id, false
						])
					} else if (piece.isGlobal && !piece.isSticky) {
						doUserAction(t, e, UserActionAPI.methods.baselineAdLibPieceStart, [
							this.props.rundown._id, this.props.rundown.currentPartId, piece._id, false
						])
					} else if (piece.isSticky) {
						this.onToggleSticky(e, piece.sourceLayerId)
					}
				}
			}
		}
	}

	onOut = (e: any, outButton?: boolean) => {
		if (this.state.selectedAdLib) {
			const piece = this.state.selectedAdLib
			let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]
			if (sourceLayer && (sourceLayer.clearKeyboardHotkey || outButton)) {
				this.onClearAllSourceLayers(e, [sourceLayer])
			}
		}
	}

	onSelectAdLib = (_e: any, piece: AdLibPieceUi) => {
		this.setState({
			selectedAdLib: piece
		})
	}

	render () {
		const { t } = this.props
		if (this.props.visible && this.props.showStyleBase && this.props.filter) {
			const filter = this.props.filter as DashboardLayoutFilter
			const isOfftubeList = filter.displayStyle === PieceDisplayStyle.OFFTUBE_LIST
			const usesTakeButtons = isOfftubeList && filter.displayTakeButtons
			if (!this.props.uiSegments || !this.props.rundown) {
				return <Spinner />
			} else {
				return (
					<div className={ClassNames('dashboard-panel', {
						'dashboard-panel--take': usesTakeButtons
					})}
						style={dashboardElementPosition(filter)}
					>
						<h4 className='dashboard-panel__header'>
							{this.props.filter.name}
						</h4>
						{filter.enableSearch &&
							<AdLibPanelToolbar
								onFilterChange={this.onFilterChange} />
						}
						<div className={ClassNames('dashboard-panel__panel', {
							'dashboard-panel__panel--horizontal': filter.overflowHorizontally
						})}>
							{this.props.rundownBaselineAdLibs
								.concat(_.flatten(this.props.uiSegments.map(seg => seg.pieces)))
								.filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter, this.state.searchFilter))
								.map((item: AdLibPieceUi) => {
									return <DashboardPieceButton
										key={item._id}
										item={item}
										layer={this.state.sourceLayers[item.sourceLayerId]}
										outputLayer={this.state.outputLayers[item.outputLayerId]}
										onToggleAdLib={usesTakeButtons ? this.onSelectAdLib : this.onToggleAdLib}
										rundown={this.props.rundown}
										isOnAir={this.isAdLibOnAir(item)}
										isNext={this.isAdLibNext(item)}
										mediaPreviewUrl={this.props.studio ? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || '' : ''}
										widthScale={filter.buttonWidthScale}
										heightScale={filter.buttonHeightScale}
										displayStyle={filter.displayStyle}
										isSelected={this.state.selectedAdLib && item._id === this.state.selectedAdLib._id}
									>
										{item.name}
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

export function getUnfinishedPiecesReactive (rundownId: string, currentPartId: string | null) {
	let prospectivePieces: Piece[] = []
	const now = getCurrentTime()
	if (currentPartId) {
		prospectivePieces = Pieces.find({
			rundownId: rundownId,
			dynamicallyInserted: true,
			startedPlayback: {
				$exists: true
			},
			$and: [
				{
					$or: [{
						stoppedPlayback: {
							$eq: 0
						}
					}, {
						stoppedPlayback: {
							$exists: false
						}
					}],
				},
				{
					definitelyEnded: {
						$exists: false
					}
				}
			],
			playoutDuration: {
				$exists: false
			},
			adLibSourceId: {
				$exists: true
			},
			$or: [
				{
					userDuration: {
						$exists: false
					}
				},
				{
					'userDuration.duration': {
						$exists: false
					}
				}
			]
		}).fetch()

		let nearestEnd = Number.POSITIVE_INFINITY
		prospectivePieces = prospectivePieces.filter((piece) => {
			if (piece.definitelyEnded) return false
			if (piece.startedPlayback === undefined && piece.continuesRefId === undefined) return false
			if (piece.stoppedPlayback) return false

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
				const end = ((piece.startedPlayback || 0) + duration)
				if (end > now) {
					nearestEnd = nearestEnd > end ? end : nearestEnd
					return true
				} else {
					return false
				}
			}

			if (piece.infiniteMode && piece.infiniteMode >= PieceLifespan.Infinite) {
				return true
			}
			return true
		})

		if (Number.isFinite(nearestEnd)) invalidateAt(nearestEnd)
	}

	return _.groupBy(prospectivePieces, (piece) => piece.adLibSourceId)
}

export const DashboardPanel = translateWithTracker<Translated<IAdLibPanelProps & IDashboardPanelProps>, IState, IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	return Object.assign({}, fetchAndFilter(props), {
		studio: props.rundown.getStudio(),
		unfinishedPieces: getUnfinishedPiecesReactive(props.rundown._id, props.rundown.currentPartId),
		nextPieces: getNextPiecesReactive(props.rundown._id, props.rundown.nextPartId)
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(DashboardPanelInner)

