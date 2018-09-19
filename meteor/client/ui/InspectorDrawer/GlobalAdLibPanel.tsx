import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import * as $ from 'jquery'

import { ClientAPI } from '../../../lib/api/client'
import { PlayoutAPI } from '../../../lib/api/playout'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Segment } from '../../../lib/collections/Segments'
import { SegmentLine } from '../../../lib/collections/SegmentLines'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import { StudioInstallation, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'
import { RunningOrderBaselineAdLibItems } from '../../../lib/collections/RunningOrderBaselineAdLibItems'
import { AdLibListItem, IAdLibListItem } from './AdLibListItem'
import * as ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/moustrapHelper'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as faTimes from '@fortawesome/fontawesome-free-solid/faTimes'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { RunningOrderViewKbdShortcuts } from '../RunningOrderView'

import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'

interface IListViewPropsHeader {
	onSelectAdLib: (aSLine: SegmentLineAdLibItemUi) => void
	onToggleSticky: (item: IAdLibListItem) => void
	onToggleAdLib: (aSLine: SegmentLineAdLibItemUi, queue?: boolean) => void
	selectedItem: SegmentLineAdLibItemUi | undefined
	filter: string | undefined
	studioInstallation: StudioInstallation
	roAdLibs: Array<SegmentLineAdLibItemUi>
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

		if (props.studioInstallation && props.studioInstallation.outputLayers && props.studioInstallation.sourceLayers) {
			props.studioInstallation.outputLayers.forEach((item) => {
				tOLayers[item._id] = item
			})
			props.studioInstallation.sourceLayers.forEach((item) => {
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
				itemList.concat(this.props.roAdLibs).concat(this.props.studioInstallation.sourceLayers.filter(i => i.isSticky)
					.map(layer => literal<IAdLibListItem & { layer: ISourceLayer, isSticky: boolean }>({
						_id: layer._id,
						hotkey: layer.activateStickyKeyboardHotkey ? layer.activateStickyKeyboardHotkey.split(',')[0] : '',
						name: t('Last ') + (layer.abbreviation || layer.name),
						status: RundownAPI.LineItemStatusCode.UNKNOWN,
						layer: layer,
						isSticky: true
					})))
					.sort((a, b) => {
						if (a.hotkey && b.hotkey) {
							return a.hotkey > b.hotkey ? 1 : -1
						} else if (a.hotkey) {
							return -1
						} else {
							return 1
						}
					})
					.map((item) => {
						if (!item.isHidden) {
							if (item.isSticky && (!this.props.filter || item.name.toUpperCase().indexOf(this.props.filter.toUpperCase()) >= 0)) {
								return (
									<AdLibListItem
										key={item._id}
										item={item}
										selected={this.props.selectedItem && this.props.selectedItem._id === item._id || false}
										layer={item.layer!}
										onToggleAdLib={this.props.onToggleSticky}
										onSelectAdLib={this.props.onSelectAdLib}
									/>
								)
							} else if (!this.props.filter || item.name.toUpperCase().indexOf(this.props.filter.toUpperCase()) >= 0) {
								return (
									<AdLibListItem
										key={item._id}
										item={item}
										selected={this.props.selectedItem && this.props.selectedItem._id === item._id || false}
										layer={this.state.sourceLayers[item.sourceLayerId!]}
										outputLayer={this.state.outputLayers[item.outputLayerId!]}
										onToggleAdLib={this.props.onToggleAdLib}
										onSelectAdLib={this.props.onSelectAdLib}
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
		const { t } = this.props

		return (
			<div className='adlib-panel__list-view__list adlib-panel__list-view__list--global'>
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

	constructor (props: Translated<IToolbarPropsHeader> ) {
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
			<div className='adlib-panel__list-view__toolbar adlib-panel__list-view__toolbar--global'>
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

export interface SegmentLineAdLibItemUi extends SegmentLineAdLibItem {
	hotkey?: string
	isGlobal?: boolean
	isHidden?: boolean
}

export interface SegmentUi extends Segment {
	/** Segment line items belonging to this segment line */
	segLines: Array<SegmentLine>
	items?: Array<SegmentLineAdLibItemUi>
	isLive: boolean
	isNext: boolean
}

interface ISourceLayerLookup {
	[key: string]: ISourceLayer
}

interface IProps {
	runningOrder: RunningOrder
	studioInstallation: StudioInstallation
	visible: boolean
	studioMode: boolean
}

interface IState {
	selectedItem: SegmentLineAdLibItem | undefined
	selectedSegment: SegmentUi | undefined
	followLive: boolean
	filter: string | undefined
}
interface ITrackedProps {
	sourceLayerLookup: ISourceLayerLookup
	roAdLibs: Array<SegmentLineAdLibItemUi>
}

export const GlobalAdLibPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state: IState) => {
	Meteor.subscribe('runningOrderBaselineAdLibItems', {
		runningOrderId: props.runningOrder._id
	})
	Meteor.subscribe('studioInstallations', {
		_id: props.runningOrder.studioInstallationId
	})
	Meteor.subscribe('showStyles', {
		_id: props.runningOrder.showStyleId
	})

	const sourceLayerLookup: ISourceLayerLookup = (
		props.studioInstallation && props.studioInstallation.sourceLayers ?
		_.object(_.map(props.studioInstallation.sourceLayers, (item) => [item._id, item])) :
		{}
	)
	// a hash to store various indices of the used hotkey lists
	let sourceHotKeyUse = {}

	let roAdLibs: Array<SegmentLineAdLibItemUi> = []

	const sharedHotkeyList = _.groupBy(props.studioInstallation.sourceLayers, (item) => item.activateKeyboardHotkeys)

	if (props.runningOrder) {
		let roAdLibItems = RunningOrderBaselineAdLibItems.find({runningOrderId: props.runningOrder._id}).fetch()
		roAdLibItems.forEach((item) => {
			// automatically assign hotkeys based on adLibItem index
			const uiAdLib: SegmentLineAdLibItemUi = _.clone(item)
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
			roAdLibs.push(uiAdLib)
		})
	}

	return {
		sourceLayerLookup,
		roAdLibs
	}
})(class AdLibPanel extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			selectedItem: undefined,
			selectedSegment: undefined,
			filter: undefined,
			followLive: true
		}
	}

	componentDidMount () {
		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate (prevProps: IProps & ITrackedProps) {
		mousetrapHelper.unbind(this.usedHotkeys, 'keyup')
		this.usedHotkeys.length = 0

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount () {
		this._cleanUp()
		mousetrapHelper.unbind(this.usedHotkeys, 'keyup')
		mousetrapHelper.unbind(this.usedHotkeys, 'keydown')

		this.usedHotkeys.length = 0
	}

	refreshKeyboardHotkeys () {
		if (!this.props.studioMode) return

		let preventDefault = (e) => {
			e.preventDefault()
		}

		if (this.props.roAdLibs) {
			this.props.roAdLibs.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown')
					mousetrapHelper.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(item)
					}, 'keyup')
					this.usedHotkeys.push(item.hotkey)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RunningOrderViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown')
						mousetrapHelper.bind(queueHotkey, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(item, true)
						}, 'keyup')
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}

		if (this.props.sourceLayerLookup) {
			_.forEach(this.props.sourceLayerLookup, (item) => {
				if (item.clearKeyboardHotkey) {
					item.clearKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown')
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onClearAllSourceLayer(item)
						}, 'keyup')
						this.usedHotkeys.push(element)
					})

				}

				if (item.isSticky && item.activateStickyKeyboardHotkey) {
					item.activateStickyKeyboardHotkey.split(',').forEach(element => {
						mousetrapHelper.bind(element, preventDefault, 'keydown')
						mousetrapHelper.bind(element, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleSticky(item._id)
						}, 'keyup')
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

	onToggleStickyItem = (item: IAdLibListItem) => {
		this.onToggleSticky(item._id)
	}

	onToggleSticky = (sourceLayerId: string) => {
		if (this.props.runningOrder && this.props.runningOrder.currentSegmentLineId && this.props.runningOrder.active) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.sourceLayerStickyItemStart, this.props.runningOrder._id, sourceLayerId)
		}
	}

	onSelectAdLib = (aSLine: SegmentLineAdLibItemUi) => {
		// console.log(aSLine)
		this.setState({
			selectedItem: aSLine
		})
	}

	onToggleAdLib = (aSLine: SegmentLineAdLibItemUi, queue?: boolean) => {
		if (queue && this.props.sourceLayerLookup && this.props.sourceLayerLookup[aSLine.sourceLayerId] &&
			!this.props.sourceLayerLookup[aSLine.sourceLayerId].isQueueable) {
			console.log(`Item "${aSLine._id}" is on sourceLayer "${aSLine.sourceLayerId}" that is not queueable.`)
			return
		}

		if (this.props.runningOrder && this.props.runningOrder.currentSegmentLineId && aSLine.isGlobal) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.runningOrderBaselineAdLibItemStart, this.props.runningOrder._id, this.props.runningOrder.currentSegmentLineId, aSLine._id, queue || false)
		}
	}

	onClearAllSourceLayer = (sourceLayer: ISourceLayer) => {
		// console.log(sourceLayer)

		if (this.props.runningOrder && this.props.runningOrder.currentSegmentLineId) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.sourceLayerOnLineStop, this.props.runningOrder._id, this.props.runningOrder.currentSegmentLineId, sourceLayer._id)
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
					selectedItem={this.state.selectedItem}
					studioInstallation={this.props.studioInstallation}
					roAdLibs={this.props.roAdLibs}
					filter={this.state.filter} />
			</React.Fragment>
		)
	}

	render () {
		if (this.props.visible) {
			if (!this.props.runningOrder) {
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
