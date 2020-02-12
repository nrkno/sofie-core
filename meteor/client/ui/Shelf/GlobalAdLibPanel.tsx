import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Segment } from '../../../lib/collections/Segments'
import { Part } from '../../../lib/collections/Parts'
import { Rundown } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { AdLibListItem, IAdLibListItem } from './AdLibListItem'
import * as ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/mousetrapHelper'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as faTimes from '@fortawesome/fontawesome-free-solid/faTimes'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { RundownViewKbdShortcuts } from '../RundownView'

import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction } from '../../lib/userAction'
import { UserActionAPI } from '../../../lib/api/userActions'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'

interface IListViewPropsHeader {
	onSelectAdLib: (piece: AdLibPieceUi) => void
	onToggleSticky: (item: IAdLibListItem, e: any) => void
	onToggleAdLib: (piece: AdLibPieceUi, queue: boolean, e: any) => void
	selectedPiece: AdLibPieceUi | undefined
	searchFilter: string | undefined
	showStyleBase: ShowStyleBase
	rundownAdLibs: Array<AdLibPieceUi>
	rundown: Rundown
}

interface IListViewStateHeader {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
}

const AdLibListView = translate()(class extends React.Component<Translated<IListViewPropsHeader>, IListViewStateHeader> {
	table: HTMLTableElement

	constructor (props: Translated<IListViewPropsHeader>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {}
		}
	}

	static getDerivedStateFromProps (props: IListViewPropsHeader, state) {
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

	renderGlobalAdLibs () {
		const { t } = this.props
		const itemList: (IAdLibListItem &
			{ isSticky?: boolean,
			  layer?: ISourceLayer,
			  sourceLayerId?: string,
			  outputLayerId?: string })[] = []

		return (
			<tbody id={'adlib-panel__list-view__globals'} key='globals' className={ClassNames('adlib-panel__list-view__list__segment')}>
			{
				itemList.concat(this.props.rundownAdLibs).concat(this.props.showStyleBase.sourceLayers.filter(i => i.isSticky)
					.map(layer => literal<IAdLibListItem & { layer: ISourceLayer, isSticky: boolean }>({
						_id: layer._id,
						hotkey: layer.activateStickyKeyboardHotkey ? layer.activateStickyKeyboardHotkey.split(',')[0] : '',
						name: t('Last {{layerName}}', { layerName: (layer.abbreviation || layer.name) }),
						status: RundownAPI.PieceStatusCode.UNKNOWN,
						layer: layer,
						isSticky: true
					})))
					.map((item) => {
						if (!item.isHidden) {
							if (item.isSticky && item.layer &&
								(!this.props.searchFilter || item.name.toUpperCase().indexOf(this.props.searchFilter.toUpperCase()) >= 0)
							) {
								return (
									<AdLibListItem
										key={item._id}
										item={item}
										selected={this.props.selectedPiece && this.props.selectedPiece._id === item._id || false}
										layer={item.layer}
										onToggleAdLib={this.props.onToggleSticky}
										onSelectAdLib={this.props.onSelectAdLib}
										rundown={this.props.rundown}
									/>
								)
							} else if (item.sourceLayerId && item.outputLayerId &&
								(!this.props.searchFilter || item.name.toUpperCase().indexOf(this.props.searchFilter.toUpperCase()) >= 0)
							) {
								return (
									<AdLibListItem
										key={item._id}
										item={item}
										selected={this.props.selectedPiece && this.props.selectedPiece._id === item._id || false}
										layer={this.state.sourceLayers[item.sourceLayerId]}
										outputLayer={this.state.outputLayers[item.outputLayerId]}
										onToggleAdLib={this.props.onToggleAdLib}
										onSelectAdLib={this.props.onSelectAdLib}
										rundown={this.props.rundown}
									/>
								)
							} else {
								return null
							}
						} else {
							return null
						}
					})
			}
			</tbody>
		)
	}

	setTableRef = (el) => {
		this.table = el
	}

	render () {
		return (
			<div className='adlib-panel__list-view__list adlib-panel__list-view__list--no-segments'>
				<table className='adlib-panel__list-view__list__table' ref={this.setTableRef}>
					{this.renderGlobalAdLibs()}
				</table>
			</div>
		)
	}
})

interface IToolbarPropsHeader {
	onFilterChange?: (newFilter: string | undefined) => void
}

interface IToolbarStateHader {
	searchInputValue: string
}

const AdLibPanelToolbar = translate()(class AdLibPanelToolbar extends React.Component<Translated<IToolbarPropsHeader>, IToolbarStateHader> {
	searchInput: HTMLInputElement

	constructor (props: Translated<IToolbarPropsHeader>) {
		super(props)

		this.state = {
			searchInputValue: ''
		}
	}

	setSearchInputRef = (el: HTMLInputElement) => {
		this.searchInput = el
	}

	searchInputChanged = (e?: React.ChangeEvent<HTMLInputElement>) => {
		this.setState({
			searchInputValue: this.searchInput.value
		})

		this.props.onFilterChange && typeof this.props.onFilterChange === 'function' &&
			this.props.onFilterChange(this.searchInput.value)
	}

	clearSearchInput = () => {
		this.searchInput.value = ''

		this.searchInputChanged()
	}

	render () {
		const { t } = this.props
		return (
			<div className='adlib-panel__list-view__toolbar adlib-panel__list-view__toolbar--no-segments'>
				<div className='adlib-panel__list-view__toolbar__filter'>
					<input className='adlib-panel__list-view__toolbar__filter__input' type='text'
						   ref={this.setSearchInputRef}
						   placeholder={t('Search...')}
						   onChange={this.searchInputChanged} />
					{ this.state.searchInputValue !== '' &&
						<div className='adlib-panel__list-view__toolbar__filter__clear' onClick={this.clearSearchInput}>
							<FontAwesomeIcon icon={faTimes} />
						</div>
					}
				</div>
				<div className='adlib-panel__list-view__toolbar__buttons' style={{ 'display': 'none' }}>
					<button className='action-btn'>
						<FontAwesomeIcon icon={faList} />
					</button>
					<button className='action-btn'>
						<FontAwesomeIcon icon={faTh} />
					</button>
				</div>
			</div>
		)
	}
})

export interface AdLibPieceUi extends AdLibPiece {
	hotkey?: string
	isGlobal?: boolean
	isHidden?: boolean
}

export interface SegmentUi extends Segment {
	/** Pieces belonging to this part */
	parts: Array<Part>
	items?: Array<AdLibPieceUi>
	isLive: boolean
	isNext: boolean
}

interface ISourceLayerLookup {
	[key: string]: ISourceLayer
}

interface IProps {
	rundown: Rundown
	showStyleBase: ShowStyleBase
	visible: boolean
	studioMode: boolean
}

interface IState {
	selectedPiece: AdLibPiece | undefined
	selectedSegment: SegmentUi | undefined
	followLive: boolean
	filter: string | undefined
}
interface ITrackedProps {
	sourceLayerLookup: ISourceLayerLookup
	rundownAdLibs: Array<AdLibPieceUi>
}

const HOTKEY_GROUP = 'GlobalAdLibPanel'

export const GlobalAdLibPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state: IState) => {
	meteorSubscribe(PubSub.rundownBaselineAdLibPieces, {
		rundownId: props.rundown._id
	})
	meteorSubscribe(PubSub.showStyleBases, {
		_id: props.rundown.showStyleBaseId
	})

	const sourceLayerLookup: ISourceLayerLookup = (
		props.showStyleBase && props.showStyleBase.sourceLayers ?
		_.object(_.map(props.showStyleBase.sourceLayers, (item) => [item._id, item])) :
		{}
	)
	// a hash to store various indices of the used hotkey lists
	let sourceHotKeyUse = {}

	let rundownAdLibs: Array<AdLibPieceUi> = []

	const sharedHotkeyList = _.groupBy(props.showStyleBase.sourceLayers, (item) => item.activateKeyboardHotkeys)

	if (props.rundown) {
		let rundownAdLibItems = RundownBaselineAdLibPieces.find({ rundownId: props.rundown._id }, { sort: { sourceLayerId: 1, _rank: 1 } }).fetch()
		rundownAdLibItems.forEach((item) => {
			// automatically assign hotkeys based on adLibItem index
			const uiAdLib: AdLibPieceUi = _.clone(item)
			uiAdLib.isGlobal = true

			let sourceLayer = item.sourceLayerId && sourceLayerLookup[item.sourceLayerId]
			if (sourceLayer &&
				sourceLayer.activateKeyboardHotkeys &&
				sourceLayer.assignHotkeysToGlobalAdlibs
			) {
				let keyboardHotkeysList = sourceLayer.activateKeyboardHotkeys.split(',')
				const sourceHotKeyUseLayerId = (sharedHotkeyList[sourceLayer.activateKeyboardHotkeys][0]._id) || item.sourceLayerId
				if ((sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) < keyboardHotkeysList.length) {
					uiAdLib.hotkey = keyboardHotkeysList[(sourceHotKeyUse[sourceHotKeyUseLayerId] || 0)]
					// add one to the usage hash table
					sourceHotKeyUse[sourceHotKeyUseLayerId] = (sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) + 1
				}
			}

			if (sourceLayer && sourceLayer.isHidden) {
				uiAdLib.isHidden = true
			}

			// always add them to the list
			rundownAdLibs.push(uiAdLib)
		})
	}

	return {
		sourceLayerLookup,
		rundownAdLibs
	}
})(class AdLibPanel extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			selectedPiece: undefined,
			selectedSegment: undefined,
			filter: undefined,
			followLive: true
		}
	}

	componentDidMount () {
		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate (prevProps: IProps & ITrackedProps) {
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

	refreshKeyboardHotkeys () {
		if (!this.props.studioMode) return

		let preventDefault = (e) => {
			e.preventDefault()
		}

		if (this.props.rundownAdLibs) {
			this.props.rundownAdLibs.forEach((item) => {
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
			_.each(this.props.sourceLayerLookup, (item) => {
				if (item.clearKeyboardHotkey) {
					item.clearKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown', HOTKEY_GROUP)
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onClearAllSourceLayer(item, e)
						}, 'keyup', HOTKEY_GROUP)
						this.usedHotkeys.push(element)
					})

				}

				if (item.isSticky && item.activateStickyKeyboardHotkey) {
					item.activateStickyKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown', HOTKEY_GROUP)
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleSticky(item._id, e)
						}, 'keyup', HOTKEY_GROUP)
						this.usedHotkeys.push(element)
					})
				}
			})
		}
	}

	onFilterChange = (filter: string) => {
		this.setState({
			filter
		})
	}

	onToggleStickyItem = (item: IAdLibListItem, e: any) => {
		this.onToggleSticky(item._id, e)
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.rundown && this.props.rundown.currentPartId && this.props.rundown.active) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.sourceLayerStickyPieceStart, [this.props.rundown._id, sourceLayerId])
		}
	}

	onSelectAdLib = (piece: AdLibPieceUi) => {
		// console.log(aSLine)
		this.setState({
			selectedPiece: piece
		})
	}

	onToggleAdLib = (piece: AdLibPieceUi, queue: boolean, e: any) => {
		const { t } = this.props

		if (piece.invalid) {
			NotificationCenter.push(new Notification(t('Invalid AdLib'), NoticeLevel.WARNING, t('Cannot play this AdLib becasue it is marked as Invalid'), 'toggleAdLib'))
			return
		}
		if (piece.floated) {
			NotificationCenter.push(new Notification(t('Floated AdLib'), NoticeLevel.WARNING, t('Cannot play this AdLib becasue it is marked as Floated'), 'toggleAdLib'))
			return
		}
		if (queue && this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId] &&
			!this.props.sourceLayerLookup[piece.sourceLayerId].isQueueable) {
			console.log(`Item "${piece._id}" is on sourceLayer "${piece.sourceLayerId}" that is not queueable.`)
			return
		}

		if (this.props.rundown && this.props.rundown.currentPartId && piece.isGlobal) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.baselineAdLibPieceStart, [this.props.rundown._id, this.props.rundown.currentPartId, piece._id, queue || false])
		}
	}

	onClearAllSourceLayer = (sourceLayer: ISourceLayer, e: any) => {
		// console.log(sourceLayer)

		if (this.props.rundown && this.props.rundown.currentPartId) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.sourceLayerOnPartStop, [this.props.rundown._id, this.props.rundown.currentPartId, sourceLayer._id])
		}
	}

	renderListView () {
		// let a = new AdLibPanelToolbar({
			// t: () => {},
			// onFilterChange: () => { console.log('a') }
		// })
		return (
			<React.Fragment>
				<AdLibPanelToolbar
					onFilterChange={this.onFilterChange} />
				<AdLibListView
					onSelectAdLib={this.onSelectAdLib}
					onToggleAdLib={this.onToggleAdLib}
					onToggleSticky={this.onToggleStickyItem}
					selectedPiece={this.state.selectedPiece}
					showStyleBase={this.props.showStyleBase}
					rundownAdLibs={this.props.rundownAdLibs}
					searchFilter={this.state.filter}
					rundown={this.props.rundown} />
			</React.Fragment>
		)
	}

	render () {
		if (this.props.visible) {
			if (!this.props.rundown) {
				return <Spinner />
			} else {
				return (
					<div className='adlib-panel super-dark'>
						{this.renderListView()}
					</div>
				)
			}
		}
		return null
	}
})
