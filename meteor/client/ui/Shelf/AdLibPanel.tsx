import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Segment, DBSegment, SegmentId } from '../../../lib/collections/Segments'
import { Part, Parts, PartId } from '../../../lib/collections/Parts'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
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
import { IOutputLayer, ISourceLayer, IBlueprintActionManifestDisplayContent, SomeContent } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction } from '../../lib/userAction'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownLayoutFilter, RundownLayoutFilterBase, DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal, extendMandadory, normalizeArray, unprotectString, protectString, Omit } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { memoizedIsolatedAutorun } from '../../lib/reactiveData/reactiveDataHelper'
import { PartInstance, PartInstances } from '../../../lib/collections/PartInstances'
import { MeteorCall } from '../../../lib/api/methods'
import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { RundownUtils } from '../../lib/rundown'

interface IListViewPropsHeader {
	uiSegments: Array<AdlibSegmentUi>
	onSelectAdLib: (piece: AdLibPieceUi) => void
	onToggleAdLib: (piece: AdLibPieceUi, queue: boolean, e: ExtendedKeyboardEvent) => void
	selectedPart: AdLibPieceUi | undefined
	selectedSegment: AdlibSegmentUi | undefined
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

export function matchFilter(item: AdLibPieceUi, showStyleBase: ShowStyleBase, uiSegments: Array<AdlibSegmentUi>, filter?: RundownLayoutFilterBase, searchFilter?: string) {
	if (!searchFilter && !filter) return true
	const liveSegment = uiSegments.find(i => i.isLive === true)
	const uppercaseLabel = item.name.toUpperCase()
	if (filter) {
		// Filter currentSegment only
		if (
			filter.currentSegment === true && item.partId &&
			(
				(liveSegment && liveSegment.parts.find(i => item.partId === i._id) === undefined) ||
				(!liveSegment)
			)
		) {
			return false
		}
		// Filter out items that are not within outputLayerIds filter
		if (
			filter.outputLayerIds !== undefined &&
			filter.outputLayerIds.indexOf(item.outputLayerId) < 0
		) {
			return false
		}
		// Source layers
		if (
			filter.sourceLayerIds !== undefined &&
			filter.sourceLayerIds.indexOf(item.sourceLayerId) < 0
		) {
			return false
		}
		// Source layer types
		const sourceLayerType = showStyleBase.sourceLayers.find(i => i._id === item.sourceLayerId)
		if (
			sourceLayerType &&
			filter.sourceLayerTypes !== undefined &&
			filter.sourceLayerTypes.indexOf(sourceLayerType.type) < 0
		) {
			return false
		}
		// Item label needs at least one of the strings in the label array
		if (
			filter.label !== undefined &&
			filter.label.reduce((p, v) => {
				return p || uppercaseLabel.indexOf(v.toUpperCase()) >= 0
			}, false) === false
		) {
			return false
		}
		// Item tags needs to contain all of the strings in the tags array
		if (
			filter.tags !== undefined &&
			filter.tags.reduce((p, v) => {
				return p && (item.tags && item.tags.indexOf(v) >= 0)
			}, true) === false
		) {
			return false
		}
	}
	if (searchFilter) {
		return uppercaseLabel.indexOf(searchFilter.toUpperCase()) >= 0
	} else {
		return true
	}
}

const AdLibListView = translate()(class AdLibListView extends React.Component<
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

	scrollToCurrentSegment() {
		if (this.table.id && this.props.selectedSegment) {
			// scroll to selected segment
			const segmentSelector = `#${this.table.id} .adlib-panel__list-view__item__${this.props.selectedSegment._id}`
			const segment: HTMLElement | null = document.querySelector(segmentSelector)
			if (segment) {
				this.table.scrollTo({
					top: segment.offsetTop,
					behavior: 'smooth'
				})
			}
		}
	}

	componentDidMount() {
		this.scrollToCurrentSegment()
	}

	componentDidUpdate(prevProps: IListViewPropsHeader) {
		if (prevProps.selectedSegment !== this.props.selectedSegment) {
			this.scrollToCurrentSegment()
		}
	}

	renderRundownAdLibs() {
		const { t } = this.props

		return <tbody className='adlib-panel__list-view__list__segment adlib-panel__list-view__item__rundown-baseline'>
			{
				this.props.rundownAdLibs && this.props.rundownAdLibs.
					filter((item) =>
						matchFilter(
							item,
							this.props.showStyleBase,
							this.props.uiSegments,
							this.props.filter,
							this.props.searchFilter
						)
					).
					map((adLibPiece: AdLibPieceUi) =>
						<AdLibListItem
							key={unprotectString(adLibPiece._id)}
							adLibListItem={adLibPiece}
							selected={this.props.selectedPart && this.props.selectedPart._id === adLibPiece._id || false}
							layer={this.state.sourceLayers[adLibPiece.sourceLayerId]}
							outputLayer={this.state.outputLayers[adLibPiece.outputLayerId]}
							onToggleAdLib={this.props.onToggleAdLib}
							onSelectAdLib={this.props.onSelectAdLib}
							playlist={this.props.playlist}
						/>
					)
			}
		</tbody>
	}

	renderSegments() {
		return this.props.uiSegments
			.filter(a => this.props.filter ?
				this.props.filter.currentSegment ? a.isLive : true
				: true)
			.map((segment) => {
				return (
					<tbody key={unprotectString(segment._id)}
						className={ClassNames(
							'adlib-panel__list-view__list__segment',
							'adlib-panel__list-view__item__' + segment._id,
							{
								'live': segment.isLive,
								'next': segment.isNext && !segment.isLive,
								'past': segment.parts.reduce((memo, item) => {
									return item.startedPlayback && item.duration ? memo : false
								}, true) === true
							})
						}
					>
						<tr className='adlib-panel__list-view__list__seg-header'>
							<td colSpan={4}>
								{segment.name}
							</td>
						</tr>
						{
							segment.pieces && segment.pieces.
								filter((item) =>
									matchFilter(
										item,
										this.props.showStyleBase,
										this.props.uiSegments,
										this.props.filter,
										this.props.searchFilter
									)
								).
								map((item: AdLibPieceUi) =>
									<AdLibListItem
										key={unprotectString(item._id)}
										adLibListItem={item}
										selected={this.props.selectedPart && this.props.selectedPart._id === item._id || false}
										layer={this.state.sourceLayers[item.sourceLayerId]}
										outputLayer={this.state.outputLayers[item.outputLayerId]}
										onToggleAdLib={this.props.onToggleAdLib}
										onSelectAdLib={this.props.onSelectAdLib}
										playlist={this.props.playlist}
									/>
								)
						}
					</tbody>
				)
			})
	}

	setTableRef = (el) => {
		this.table = el
	}

	render() {
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

export const AdLibPanelToolbar = translate()(class AdLibPanelToolbar extends React.Component<Translated<IToolbarPropsHeader>, IToolbarStateHader> {
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
	isFunction?: boolean
	isClearSourceLayer?: boolean
	userData?: any
}

export interface AdlibSegmentUi extends DBSegment {
	/** Pieces belonging to this part */
	parts: Array<Part>
	pieces: Array<AdLibPieceUi>
	isLive: boolean
	isNext: boolean
}

export interface IAdLibPanelProps {
	// liveSegment: Segment | undefined
	visible: boolean
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
	studioMode: boolean
	filter?: RundownLayoutFilterBase
	includeGlobalAdLibs?: boolean
	registerHotkeys?: boolean
}

interface IState {
	selectedPart: AdLibPiece | undefined
	selectedSegment: AdlibSegmentUi | undefined
	followLive: boolean
	searchFilter: string | undefined
}

type SourceLayerLookup = { [id: string]: ISourceLayer }

export interface IAdLibPanelTrackedProps {
	uiSegments: Array<AdlibSegmentUi>
	liveSegment: AdlibSegmentUi | undefined
	sourceLayerLookup: SourceLayerLookup
	rundownBaselineAdLibs: Array<AdLibPieceUi>
}

export function fetchAndFilter(props: Translated<IAdLibPanelProps>): IAdLibPanelTrackedProps {
	const { t } = props

	const sourceLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.sourceLayers, '_id')

	// a hash to store various indices of the used hotkey lists
	let sourceHotKeyUse: { [key: string]: number } = {}

	if (!props.playlist || !props.showStyleBase) {
		return {
			uiSegments: [],
			liveSegment: undefined,
			sourceLayerLookup,
			rundownBaselineAdLibs: []
		}
	}

	const sharedHotkeyList = _.groupBy(props.showStyleBase.sourceLayers, (item) => item.activateKeyboardHotkeys)

	const segments = props.playlist.getSegments()
	const { currentPartInstance, nextPartInstance } = props.playlist.getSelectedPartInstances()


	const { uiSegments, liveSegment, uiPartSegmentMap } = memoizedIsolatedAutorun((
		currentPartId: PartId,
		nextPartId: PartId,
		segments: Segment[],
		sourceLayerLookup: SourceLayerLookup,
		sourceHotKeyUse: { [key: string]: number }
	) => {
		// This is a map of partIds mapped onto segments they are part of
		const uiPartSegmentMap = new Map<PartId, AdlibSegmentUi>()

		if (!segments) {
			return {
				uiSegments: [],
				liveSegment: undefined,
				uiPartSegmentMap
			}
		}

		let liveSegment: AdlibSegmentUi | undefined
		const uiSegmentMap = new Map<SegmentId, AdlibSegmentUi>()
		const uiSegments: Array<AdlibSegmentUi> = segments.map((segment) => {
			const segmentUi = literal<AdlibSegmentUi>({
				...segment,
				parts: [],
				pieces: [],
				status: undefined,
				expanded: undefined,
				isLive: false,
				isNext: false
			})

			uiSegmentMap.set(segmentUi._id, segmentUi)

			return segmentUi
		})

		props.playlist.getUnorderedParts({
			segmentId: {
				$in: Array.from(uiSegmentMap.keys())
			}
		}).forEach((part) => {
			const segment = uiSegmentMap.get(part.segmentId)
			if (segment) {
				segment.parts.push(part)

				uiPartSegmentMap.set(part._id, segment)

				if (part._id === currentPartId) {
					segment.isLive = true
					liveSegment = segment
				}
				if (part._id === nextPartId) {
					segment.isNext = true
				}
			}
		})

		uiSegmentMap.forEach(segment => {
			// Sort parts by rank
			segment.parts = _.sortBy(segment.parts, p => p._rank)
		})

		return {
			uiSegments,
			liveSegment,
			uiPartSegmentMap
		}
	},
		'uiSegments',
		currentPartInstance ? currentPartInstance.part._id : undefined,
		nextPartInstance ? nextPartInstance.part._id : undefined,
		segments,
		sourceLayerLookup,
		sourceHotKeyUse)

	uiSegments.forEach(segment => segment.pieces.length = 0)

	const rundownIds = props.playlist.getRundownIDs()
	const partIds = Array.from(uiPartSegmentMap.keys())

	AdLibPieces.find({
		rundownId: {
			$in: rundownIds,
		},
		partId: {
			$in: partIds
		}
	}, {
		sort: { _rank: 1 }
	}).fetch().forEach((piece) => {
		const segment = uiPartSegmentMap.get(piece.partId!)

		if (segment) {
			segment.pieces.push(piece)
		}
	})

	const adlibActions = memoizedIsolatedAutorun((rundownIds, partIds) =>
		AdLibActions.find({
			rundownId: {
				$in: rundownIds,
			},
			partId: {
				$in: partIds
			}
		}, {
			sort: { _rank: 1 }
		}).fetch().map((action) => {
			let sourceLayerId = ''
			let outputLayerId = ''
			let content: Omit<SomeContent, 'timelineObject'> | undefined = undefined
			const isContent = RundownUtils.isAdlibActionContent(action.display)
			if (isContent) {
				sourceLayerId = (action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
				outputLayerId = (action.display as IBlueprintActionManifestDisplayContent).outputLayerId
				content = (action.display as IBlueprintActionManifestDisplayContent).content
			}

			return [action.partId, literal<AdLibPieceUi>({
				_id: protectString(`function_${action._id}`),
				name: action.display.label,
				status: RundownAPI.PieceStatusCode.UNKNOWN,
				isFunction: true,
				expectedDuration: 0,
				disabled: false,
				externalId: unprotectString(action._id),
				rundownId: action.rundownId,
				sourceLayerId,
				outputLayerId,
				_rank: action.display._rank || 0,
				content: content,
				userData: action.userData
			})]
		})
		, 'adLibActions', rundownIds, partIds)

	adlibActions.forEach((action) => {
		const segment = uiPartSegmentMap.get(action[0] as PartId)

		if (segment) {
			segment.pieces.push(action[1] as AdLibPieceUi)
		}
	})

	if (liveSegment) {
		liveSegment.pieces.forEach((item) => {
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


	let currentRundown: Rundown | undefined = undefined
	let rundownBaselineAdLibs: Array<AdLibPieceUi> = []
	if (props.playlist && props.filter && props.includeGlobalAdLibs && (
		props.filter.rundownBaseline === true || props.filter.rundownBaseline === 'only'
	)) {
		const rundowns = props.playlist.getRundowns(undefined, {
			fields: {
				'_id': 1,
				'_rank': 1,
				'name': 1
			}
		})
		const rMap = normalizeArray(rundowns, '_id')
		currentRundown = rundowns[0]
		const partInstanceId = props.playlist.currentPartInstanceId || props.playlist.nextPartInstanceId
		if (partInstanceId) {
			const partInstance = PartInstances.findOne(partInstanceId)
			if (partInstance) {
				currentRundown = rMap[unprotectString(partInstance.rundownId)]
			}
		}

		if (currentRundown) {
			// memoizedIsolatedAutorun

			rundownBaselineAdLibs = memoizedIsolatedAutorun((currentRundownId: RundownId, sourceLayerLookup: SourceLayerLookup, sourceLayers: ISourceLayer[], sourceHotKeyUse: { [key: string]: number }) => {
				let rundownAdLibItems = RundownBaselineAdLibPieces.find({
					rundownId: currentRundownId
				}, {
					sort: { sourceLayerId: 1, _rank: 1, name: 1 }
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
						sort((a, b) => a._rank - b._rank).
						map(layer => literal<AdLibPieceUi>({
							_id: protectString(`sticky_${layer._id}`),
							hotkey: layer.activateStickyKeyboardHotkey ? layer.activateStickyKeyboardHotkey.split(',')[0] : '',
							name: t('Last {{layerName}}', { layerName: (layer.abbreviation || layer.name) }),
							status: RundownAPI.PieceStatusCode.UNKNOWN,
							isSticky: true,
							isGlobal: true,
							expectedDuration: 0,
							disabled: false,
							externalId: layer._id,
							rundownId: protectString(''),
							sourceLayerId: layer._id,
							outputLayerId: '',
							_rank: 0
						}))
					)

				const golobalAdLibActions = memoizedIsolatedAutorun((rundownIds, partIds) =>
					AdLibActions.find({
						rundownId: {
							$in: rundownIds,
						},
						partId: {
							$exists: false
						}
					}, {
						sort: { _rank: 1 }
					}).fetch().map((action) => {
						let sourceLayerId = ''
						let outputLayerId = ''
						let content: Omit<SomeContent, 'timelineObject'> | undefined = undefined
						const isContent = RundownUtils.isAdlibActionContent(action.display)
						if (isContent) {
							sourceLayerId = (action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
							outputLayerId = (action.display as IBlueprintActionManifestDisplayContent).outputLayerId
							content = (action.display as IBlueprintActionManifestDisplayContent).content
						}

						return literal<AdLibPieceUi>({
							_id: protectString(`function_${action._id}`),
							name: action.display.label,
							status: RundownAPI.PieceStatusCode.UNKNOWN,
							isFunction: true,
							isGlobal: true,
							expectedDuration: 0,
							disabled: false,
							externalId: unprotectString(action._id),
							rundownId: action.rundownId,
							sourceLayerId,
							outputLayerId,
							_rank: action.display._rank || 0,
							content: content,
							userData: action.userData
						})
					})
					, 'adLibActions', rundownIds, partIds)

				rundownBaselineAdLibs.concat(golobalAdLibActions)

				return rundownBaselineAdLibs
			}, 'rundownBaselineAdLibs', currentRundown._id, sourceLayerLookup, props.showStyleBase.sourceLayers, sourceHotKeyUse)
		}

		if (props.filter.rundownBaseline === 'only') {
			uiSegments.length = 0
		}

		if ((props.filter as DashboardLayoutFilter).includeClearInRundownBaseline) {
			const rundownBaselineClearAdLibs = memoizedIsolatedAutorun((sourceLayers: ISourceLayer[]) => {
				return sourceLayers.filter(i => !!i.clearKeyboardHotkey).
					sort((a, b) => a._rank - b._rank).
					map(layer => literal<AdLibPieceUi>({
						_id: protectString(`clear_${layer._id}`),
						hotkey: layer.clearKeyboardHotkey ? layer.clearKeyboardHotkey.split(',')[0] : '',
						name: t('Clear {{layerName}}', { layerName: (layer.abbreviation || layer.name) }),
						status: RundownAPI.PieceStatusCode.UNKNOWN,
						isSticky: false,
						isClearSourceLayer: true,
						isGlobal: true,
						expectedDuration: 0,
						disabled: false,
						externalId: layer._id,
						rundownId: protectString(''),
						sourceLayerId: layer._id,
						outputLayerId: '',
						_rank: 0
					}))
			}, 'rundownBaselineClearAdLibs', props.showStyleBase.sourceLayers)
			rundownBaselineAdLibs = rundownBaselineAdLibs.concat(rundownBaselineClearAdLibs)
		}
	}

	return {
		uiSegments,
		liveSegment,
		sourceLayerLookup,
		rundownBaselineAdLibs
	}
}

const HOTKEY_GROUP = 'AdLibPanel'

export const AdLibPanel = translateWithTracker<IAdLibPanelProps, IState, IAdLibPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	const d = fetchAndFilter(props)
	return d
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(class AdLibPanel extends MeteorReactComponent<Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor(props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
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
			}
		})

		if (this.props.liveSegment) {
			this.setState({
				selectedSegment: this.props.liveSegment
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate(prevProps: IAdLibPanelProps & IAdLibPanelTrackedProps) {
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', HOTKEY_GROUP)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', HOTKEY_GROUP)
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
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', HOTKEY_GROUP)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', HOTKEY_GROUP)

		this.usedHotkeys.length = 0
	}

	refreshKeyboardHotkeys() {
		if (!this.props.studioMode) return
		if (!this.props.registerHotkeys) return

		const preventDefault = (e) => {
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

	onToggleAdLib = (adlibPiece: AdLibPieceUi, queue: boolean, e: any) => {
		const { t } = this.props

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

		if (queue && this.props.sourceLayerLookup && this.props.sourceLayerLookup[adlibPiece.sourceLayerId] &&
			!this.props.sourceLayerLookup[adlibPiece.sourceLayerId].isQueueable) {
			console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (adlibPiece.isFunction) {
				doUserAction(t, e, adlibPiece.isGlobal ? 'Start Global Adlib' : 'Start Adlib', (e) => MeteorCall.userAction.executeAction(e,
					this.props.playlist._id, unprotectString(adlibPiece._id), adlibPiece.userData
				))
			} else if (!adlibPiece.isGlobal && !adlibPiece.isFunction) {
				doUserAction(t, e, 'Start Adlib', (e) => MeteorCall.userAction.segmentAdLibPieceStart(e,
					this.props.playlist._id, currentPartInstanceId, adlibPiece._id, queue || false
				))
			} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
				doUserAction(t, e, 'Start Global Adlib', (e) => MeteorCall.userAction.baselineAdLibPieceStart(e,
					this.props.playlist._id, currentPartInstanceId, adlibPiece._id, queue || false
				))
			} else if (adlibPiece.isSticky) {
				doUserAction(t, e, 'Start Sticky Piece', (e) => MeteorCall.userAction.sourceLayerStickyPieceStart(e,
					this.props.playlist._id, adlibPiece.sourceLayerId
				))
			}
		}
	}

	onClearAllSourceLayers = (sourceLayers: ISourceLayer[], e: any) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			doUserAction(t, e, 'Clearing SourceLayer', () => MeteorCall.userAction.sourceLayerOnPartStop(e,
				this.props.playlist._id, currentPartInstanceId, _.map(sourceLayers, sl => sl._id)
			))
		}
	}

	onSelectSegment = (segment: AdlibSegmentUi) => {
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
				})} onClick={(e) => this.onSelectSegment(item)} key={unprotectString(item._id)} tabIndex={0}>
					{item.name}
				</li>
			)
		})
	}

	renderListView(withSegments?: boolean) {
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
					filter={this.props.filter as RundownLayoutFilter}
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
