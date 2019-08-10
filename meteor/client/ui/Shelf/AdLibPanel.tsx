import * as React from 'react'
import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Rundown } from '../../../lib/collections/Rundowns'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Segment } from '../../../lib/collections/Segments'
import { Part, Parts } from '../../../lib/collections/Parts'
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
import { RundownLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random';
import { literal, normalizeArray } from '../../../lib/lib';
import { RundownAPI } from '../../../lib/api/rundown'

interface IListViewPropsHeader {
	uiSegments: Array<SegmentUi>
	onSelectAdLib: (piece: AdLibPieceUi) => void
	onToggleAdLib: (piece: AdLibPieceUi, queue: boolean, e: ExtendedKeyboardEvent) => void
	selectedPart: AdLibPieceUi | undefined
	selectedSegment: SegmentUi | undefined
	searchFilter: string | undefined
	showStyleBase: ShowStyleBase
	noSegments: boolean
	filter: RundownLayoutFilter | undefined
	rundownAdLibs?: Array<AdLibPieceUi>
	playlist: RundownPlaylist
}

interface IListViewStateHeader {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
}

const AdLibListView = translate()(class extends React.Component<
	Translated<IListViewPropsHeader>, IListViewStateHeader
> {
	table: HTMLTableElement

	constructor(props: Translated<IListViewPropsHeader>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {}
		}
	}

	static getDerivedStateFromProps(props: IListViewPropsHeader, state) {
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

	componentDidUpdate(prevProps: IListViewPropsHeader) {
		if (this.props.selectedSegment && prevProps.selectedSegment !== this.props.selectedSegment && this.table) {
			// scroll to selected segment
			const segmentSelector = `#${this.table.id} .adlib-panel__list-view__item__${this.props.selectedSegment._id}`
			const segment: HTMLElement | null = document.querySelector(segmentSelector)
			if (segment) {
				const targetPosition = segment.offsetTop + this.table.scrollTop
				Velocity(this.table, {
					'scrollTop': targetPosition
				}, 250, 'swing')
			}
		}
	}

	matchFilter (item: AdLibPieceUi) {
		if (!this.props.searchFilter && !this.props.filter) return true
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
		if (this.props.searchFilter) {
			return uppercaseLabel.indexOf(this.props.searchFilter.toUpperCase()) >= 0
		} else {
			return true
		}
	}

	renderRundownAdLibs () {
		const { t } = this.props

		return <tbody className='adlib-panel__list-view__list__segment adlib-panel__list-view__item__rundown-baseline'>
			{
				this.props.rundownAdLibs && this.props.rundownAdLibs.
					filter((item) => {
						return this.matchFilter(item)
					}).
					map((item: AdLibPieceUi) => {
						return (
							<AdLibListItem
								key={item._id}
								item={item}
								selected={this.props.selectedPart && this.props.selectedPart._id === item._id || false}
								layer={this.state.sourceLayers[item.sourceLayerId]}
								outputLayer={this.state.outputLayers[item.outputLayerId]}
								onToggleAdLib={this.props.onToggleAdLib}
								onSelectAdLib={this.props.onSelectAdLib}
								playlist={this.props.playlist}
							/>
						)
					})
			}
		</tbody>
	}

	renderSegments () {
		return this.props.uiSegments
			.filter(a => this.props.filter ?
				this.props.filter.currentSegment ? a.isLive : true
				: true)
			.map((seg) => {
				return (
					<tbody key={seg._id}
						className={ClassNames(
							'adlib-panel__list-view__list__segment',
							'adlib-panel__list-view__item__' + seg._id,
							{
								'live': seg.isLive,
								'next': seg.isNext && !seg.isLive,
								'past': seg.parts.reduce((memo, item) => {
									return item.startedPlayback && item.duration ? memo : false
								}, true) === true
							})
						}
					>
						<tr className='adlib-panel__list-view__list__seg-header'>
							<td colSpan={4}>
								{seg.name}
							</td>
						</tr>
						{
							seg.pieces && seg.pieces.
								sort((a, b) => a._rank - b._rank).
								filter((item) => this.matchFilter(item)).
								map((item: AdLibPieceUi) => {
									return (
										<AdLibListItem
											key={item._id}
											item={item}
											selected={this.props.selectedPart && this.props.selectedPart._id === item._id || false}
											layer={this.state.sourceLayers[item.sourceLayerId]}
											outputLayer={this.state.outputLayers[item.outputLayerId]}
											onToggleAdLib={this.props.onToggleAdLib}
											onSelectAdLib={this.props.onSelectAdLib}
											playlist={this.props.playlist}
											/>
									)
								})
						}
					</tbody>
				)
			})
	}

	setTableRef = (el) => {
		this.table = el
	}

	render () {
		return (
			<div className={ClassNames('adlib-panel__list-view__list', {
				'adlib-panel__list-view__list--no-segments': this.props.noSegments
			})}>
				<table id={'adlib-panel__list-view__table__' + Random.id()}
					className='adlib-panel__list-view__list__table'
					ref={this.setTableRef}>
					{this.renderRundownAdLibs()}
					{this.renderSegments()}
				</table>
			</div>
		)
	}
})

interface IToolbarPropsHeader {
	onFilterChange?: (newFilter: string | undefined) => void
	noSegments?: boolean
}

interface IToolbarStateHader {
	searchInputValue: string
}

const AdLibPanelToolbar = translate()(class AdLibPanelToolbar extends React.Component<Translated<IToolbarPropsHeader>, IToolbarStateHader> {
	searchInput: HTMLInputElement

	constructor(props: Translated<IToolbarPropsHeader>) {
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

	render() {
		const { t } = this.props
		return (
			<div className={ClassNames('adlib-panel__list-view__toolbar', {
				'adlib-panel__list-view__toolbar--no-segments': this.props.noSegments
			})}>
				<div className='adlib-panel__list-view__toolbar__filter'>
					<input className='adlib-panel__list-view__toolbar__filter__input' type='text'
						ref={this.setSearchInputRef}
						placeholder={t('Search...')}
						onChange={this.searchInputChanged} />
					{this.state.searchInputValue !== '' &&
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
	isSticky?: boolean
}

export interface SegmentUi extends Segment {
	/** Pieces belonging to this part */
	parts: Array<Part>
	pieces?: Array<AdLibPieceUi>
	isLive: boolean
	isNext: boolean
}

interface ISourceLayerLookup {
	[key: string]: ISourceLayer
}

interface IProps {
	// liveSegment: Segment | undefined
	visible: boolean
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
	studioMode: boolean
	filter?: RundownLayoutFilter
	includeGlobalAdLibs?: boolean
	registerHotkeys?: boolean
}

interface IState {
	selectedPart: AdLibPiece | undefined
	selectedSegment: SegmentUi | undefined
	followLive: boolean
	searchFilter: string | undefined
}
interface ITrackedProps {
	uiSegments: Array<SegmentUi>
	liveSegment: SegmentUi | undefined
	sourceLayerLookup: ISourceLayerLookup
	rundownBaselineAdLibs: Array<AdLibPieceUi>
}

export const AdLibPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: Translated<IProps>) => {
	let liveSegment: SegmentUi | undefined = undefined

	const sourceLayerLookup: ISourceLayerLookup = (
		props.showStyleBase && props.showStyleBase.sourceLayers ?
			_.object(_.map(props.showStyleBase.sourceLayers, (item) => [item._id, item])) :
			{}
	)
	// a hash to store various indices of the used hotkey lists
	let sourceHotKeyUse = {}

	const sharedHotkeyList = _.groupBy(props.showStyleBase.sourceLayers, (item) => item.activateKeyboardHotkeys)
	let segments: Array<Segment> = props.playlist.getSegments()

	const uiSegments = props.playlist ? (segments as Array<SegmentUi>).map((segSource) => {
		const seg = _.clone(segSource)
		seg.parts = segSource.getParts()
		let segmentAdLibPieces: Array<AdLibPiece> = []
		seg.parts.forEach((part) => {
			if (part._id === props.playlist.currentPartId) {
				seg.isLive = true
				liveSegment = seg
			}
			if (part._id === props.playlist.nextPartId) {
				seg.isNext = true
			}
			segmentAdLibPieces = segmentAdLibPieces.concat(part.getAdLibPieces())
		})
		seg.pieces = segmentAdLibPieces

		// automatically assign hotkeys based on adLibItem index
		if (seg.isLive) {
			seg.pieces.forEach((item) => {
				let sourceLayer = item.sourceLayerId && sourceLayerLookup[item.sourceLayerId]

				if (sourceLayer && sourceLayer.activateKeyboardHotkeys) {
					let keyboardHotkeysList = sourceLayer.activateKeyboardHotkeys.split(',')
					const sourceHotKeyUseLayerId = (sharedHotkeyList[sourceLayer.activateKeyboardHotkeys][0]._id) || item.sourceLayerId
					if ((sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) < keyboardHotkeysList.length) {
						item.hotkey = keyboardHotkeysList[(sourceHotKeyUse[sourceHotKeyUseLayerId] || 0)]
						// add one to the usage hash table
						sourceHotKeyUse[sourceHotKeyUseLayerId] = (sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) + 1
					}
				}
			})
		}
		return seg
	}) : []

	let currentRundown: Rundown | undefined = undefined
	let rundownBaselineAdLibs: Array<AdLibPieceUi> = []
	if (props.playlist && props.filter && props.includeGlobalAdLibs && (
		props.filter.rundownBaseline === true || props.filter.rundownBaseline === 'only'
	)) {
		const rundowns = props.playlist.getRundowns()
		const rMap = normalizeArray(rundowns, '_id')
		currentRundown = rundowns[0]
		const partId = props.playlist.currentPartId || props.playlist.nextPartId
		if (partId) {
			const part = Parts.findOne(partId)
			if (part) {
				currentRundown = rMap[part.rundownId]
			}
		}

		if (currentRundown) {
			let rundownAdLibItems = RundownBaselineAdLibPieces.find({
				rundownId: currentRundown._id
			}, {
				sort: { sourceLayerId: 1, _rank: 1 }
			}).fetch()
			rundownBaselineAdLibs = rundownAdLibItems.map((item) => {
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
				return uiAdLib
			}).
			concat(props.showStyleBase.sourceLayers.filter(i => i.isSticky).
				map(layer => literal<AdLibPieceUi>({
					_id: layer._id,
					hotkey: layer.activateStickyKeyboardHotkey ? layer.activateStickyKeyboardHotkey.split(',')[0] : '',
					name: props.t('Last ') + (layer.abbreviation || layer.name),
					status: RundownAPI.PieceStatusCode.UNKNOWN,
					isSticky: true,
					isGlobal: true,
					expectedDuration: 0,
					disabled: false,
					externalId: layer._id,
					rundownId: '',
					sourceLayerId: layer._id,
					outputLayerId: '',
					_rank: 0
				}))
			)
		}

		if (props.filter.rundownBaseline === 'only') {
			uiSegments.length = 0
		}
	}

	return {
		uiSegments,
		liveSegment,
		sourceLayerLookup,
		rundownBaselineAdLibs
	}
})(class AdLibPanel extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor(props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			selectedPart: undefined,
			selectedSegment: undefined,
			searchFilter: undefined,
			followLive: true
		}
	}

	componentDidMount() {
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

		if (this.props.liveSegment) {
			this.setState({
				selectedSegment: this.props.liveSegment
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate(prevProps: IProps & ITrackedProps) {
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup')
		this.usedHotkeys.length = 0

		if (this.props.liveSegment && this.props.liveSegment !== prevProps.liveSegment && this.state.followLive) {
			this.setState({
				selectedSegment: this.props.liveSegment
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount() {
		this._cleanUp()
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup')
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown')

		this.usedHotkeys.length = 0
	} 

	refreshKeyboardHotkeys() {
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

	onFilterChange = (filter: string) => {
		this.setState({
			searchFilter: filter
		})
	}

	onSelectAdLib = (piece: AdLibPieceUi) => {
		// console.log(aSLine)
		this.setState({
			selectedPart: piece
		})
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

	onSelectSegment = (segment: SegmentUi) => {
		// console.log(segment)
		this.setState({
			selectedSegment: segment,
			followLive: (this.props.liveSegment ? segment._id === this.props.liveSegment._id : true)
		})
	}

	renderSegmentList() {
		return this.props.uiSegments.map((item) => {
			return (
				<li className={ClassNames('adlib-panel__segments__segment', {
					'live': item.isLive,
					'next': item.isNext && !item.isLive,
					'past': item.parts.reduce((memo, part) => {
						return part.startedPlayback && part.duration ? memo : false
					}, true) === true
				})} onClick={(e) => this.onSelectSegment(item)} key={item._id} tabIndex={0}>
					{item.name}
				</li>
			)
		})
	}

	renderListView (withSegments?: boolean) {
		// let a = new AdLibPanelToolbar({
		// t: () => {},
		// onFilterChange: () => { console.log('a') }
		// })
		return (
			<React.Fragment>
				<AdLibPanelToolbar
					onFilterChange={this.onFilterChange}
					noSegments={!withSegments} />
				<AdLibListView
					uiSegments={this.props.uiSegments}
					rundownAdLibs={this.props.rundownBaselineAdLibs}
					onSelectAdLib={this.onSelectAdLib}
					onToggleAdLib={this.onToggleAdLib}
					selectedPart={this.state.selectedPart}
					selectedSegment={this.state.selectedSegment}
					showStyleBase={this.props.showStyleBase}
					searchFilter={this.state.searchFilter}
					filter={this.props.filter}
					playlist={this.props.playlist}
					noSegments={!withSegments} />
			</React.Fragment>
		)
	}

	render() {
		if (this.props.visible) {
			if (!this.props.uiSegments || !this.props.playlist) {
				return <Spinner />
			} else {
				return (
					<div className='adlib-panel super-dark'>
						{(this.props.uiSegments.length > 30) && <ul className='adlib-panel__segments'>
							{this.renderSegmentList()}
						</ul>}
						{this.renderListView(this.props.uiSegments.length > 30)}
					</div>
				)
			}
		}
		return null
	}
})
