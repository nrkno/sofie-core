import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { withTranslation } from 'react-i18next'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Segment, DBSegment, SegmentId } from '../../../lib/collections/Segments'
import { Part, Parts, PartId } from '../../../lib/collections/Parts'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { AdLibListItem, IAdLibListItem } from './AdLibListItem'
import ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/mousetrapHelper'

import { faTh, faList, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownViewKbdShortcuts, RundownViewEvents } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import {
	IOutputLayer,
	ISourceLayer,
	IBlueprintAdLibPiece,
	IBlueprintAdLibPieceDB,
	IBlueprintPieceDB,
	IBlueprintActionManifestDisplayContent,
	SomeContent,
	PieceLifespan,
} from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction, UserAction } from '../../lib/userAction'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import {
	RundownLayoutFilter,
	RundownLayoutFilterBase,
	DashboardLayoutFilter,
} from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal, extendMandadory, normalizeArray, unprotectString, protectString, Omit } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { Piece, PieceGeneric } from '../../../lib/collections/Pieces'
import { memoizedIsolatedAutorun } from '../../lib/reactiveData/reactiveDataHelper'
import {
	PartInstance,
	PartInstances,
	PartInstanceId,
	findPartInstanceOrWrapToTemporary,
} from '../../../lib/collections/PartInstances'
import { MeteorCall } from '../../../lib/api/methods'
import { SegmentUi, PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { AdLibActions, AdLibAction } from '../../../lib/collections/AdLibActions'
import { RundownUtils } from '../../lib/rundown'
import { RegisteredHotkeys, registerHotkey, HotkeyAssignmentType } from '../../lib/hotkeyRegistry'
import { ShelfTabs } from './Shelf'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { GlobalAdLibHotkeyUseMap } from './GlobalAdLibPanel'

interface IListViewPropsHeader {
	uiSegments: Array<AdlibSegmentUi>
	onSelectAdLib: (piece: IAdLibListItem) => void
	onToggleAdLib: (piece: IAdLibListItem, queue: boolean, e: ExtendedKeyboardEvent) => void
	selectedPiece: AdLibPieceUi | PieceUi | undefined
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

export function matchFilter(
	item: AdLibPieceUi,
	showStyleBase: ShowStyleBase,
	uiSegments: Array<AdlibSegmentUi>,
	filter?: RundownLayoutFilterBase,
	searchFilter?: string
) {
	if (!searchFilter && !filter) return true
	const liveSegment = uiSegments.find((i) => i.isLive === true)
	const uppercaseLabel = item.name.toUpperCase()
	if (filter) {
		// Filter currentSegment only
		if (
			filter.currentSegment === true &&
			item.partId &&
			((liveSegment && liveSegment.parts.find((i) => item.partId === i.part._id) === undefined) || !liveSegment)
		) {
			return false
		}
		// Filter out items that are not within outputLayerIds filter
		if (
			filter.outputLayerIds !== undefined &&
			filter.outputLayerIds.length &&
			filter.outputLayerIds.indexOf(item.outputLayerId) < 0
		) {
			return false
		}
		// Source layers
		if (
			filter.sourceLayerIds !== undefined &&
			filter.sourceLayerIds.length &&
			filter.sourceLayerIds.indexOf(item.sourceLayerId) < 0
		) {
			return false
		}
		// Source layer types
		const sourceLayerType = showStyleBase.sourceLayers.find((i) => i._id === item.sourceLayerId)
		if (
			sourceLayerType &&
			filter.sourceLayerTypes !== undefined &&
			filter.sourceLayerTypes.length &&
			filter.sourceLayerTypes.indexOf(sourceLayerType.type) < 0
		) {
			return false
		}
		// Item label needs at least one of the strings in the label array
		if (
			filter.label !== undefined &&
			filter.label.length &&
			filter.label.reduce((p, v) => {
				return p || uppercaseLabel.indexOf(v.toUpperCase()) >= 0
			}, false) === false
		) {
			return false
		}
		// Item tags needs to contain all of the strings in the tags array
		if (
			filter.tags !== undefined &&
			filter.tags.length &&
			filter.tags.reduce((p, v) => {
				return p && item.tags !== undefined && item.tags.indexOf(v) >= 0
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

export function matchTags(item: AdLibPieceUi, tags?: string[]) {
	if (
		tags !== undefined &&
		tags.reduce((p, v) => {
			return p && item.tags !== undefined && item.tags.indexOf(v) >= 0
		}, true) === false
	) {
		return false
	}
	return true
}

const AdLibListView = withTranslation()(
	class AdLibListView extends React.Component<Translated<IListViewPropsHeader>, IListViewStateHeader> {
		table: HTMLTableElement

		constructor(props: Translated<IListViewPropsHeader>) {
			super(props)

			this.state = {
				outputLayers: {},
				sourceLayers: {},
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

				return {
					outputLayers: tOLayers,
					sourceLayers: tSLayers,
				}
			}
			return null
		}

		scrollToCurrentSegment() {
			if (this.table.id && this.props.selectedSegment) {
				// scroll to selected segment
				const segmentSelector = `#${this.table.id} .adlib-panel__list-view__item__${this.props.selectedSegment._id}`
				const segment: HTMLElement | null = document.querySelector(segmentSelector)
				if (segment) {
					this.table.scrollTo({
						top: segment.offsetTop,
						behavior: 'smooth',
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

			return (
				<tbody className="adlib-panel__list-view__list__segment adlib-panel__list-view__item__rundown-baseline">
					{this.props.rundownAdLibs &&
						this.props.rundownAdLibs
							.filter((item) =>
								matchFilter(
									item,
									this.props.showStyleBase,
									this.props.uiSegments,
									this.props.filter,
									this.props.searchFilter
								)
							)
							.map((adLibPiece: AdLibPieceUi) => (
								<AdLibListItem
									key={unprotectString(adLibPiece._id)}
									adLibListItem={adLibPiece}
									selected={
										(this.props.selectedPiece &&
											RundownUtils.isAdLibPiece(this.props.selectedPiece) &&
											this.props.selectedPiece._id === adLibPiece._id) ||
										false
									}
									layer={this.state.sourceLayers[adLibPiece.sourceLayerId]}
									outputLayer={this.state.outputLayers[adLibPiece.outputLayerId]}
									onToggleAdLib={this.props.onToggleAdLib}
									onSelectAdLib={this.props.onSelectAdLib}
									playlist={this.props.playlist}
								/>
							))}
				</tbody>
			)
		}

		renderSegments() {
			return this.props.uiSegments
				.filter((a) => (this.props.filter ? (this.props.filter.currentSegment ? a.isLive : true) : true))
				.map((segment) => {
					return (
						<tbody
							key={unprotectString(segment._id)}
							className={ClassNames(
								'adlib-panel__list-view__list__segment',
								'adlib-panel__list-view__item__' + segment._id,
								{
									live: segment.isLive,
									next: segment.isNext && !segment.isLive,
									past:
										segment.parts.reduce((memo, item) => {
											return item.timings?.startedPlayback && item.timings?.duration ? memo : false
										}, true) === true,
								}
							)}>
							<tr className="adlib-panel__list-view__list__seg-header">
								<td colSpan={4}>{segment.name}</td>
							</tr>
							{segment.pieces &&
								segment.pieces
									.filter((item) =>
										matchFilter(
											item,
											this.props.showStyleBase,
											this.props.uiSegments,
											this.props.filter,
											this.props.searchFilter
										)
									)
									.map((adLibPiece: AdLibPieceUi) => (
										<AdLibListItem
											key={unprotectString(adLibPiece._id)}
											adLibListItem={adLibPiece}
											selected={
												(this.props.selectedPiece &&
													RundownUtils.isAdLibPiece(this.props.selectedPiece) &&
													this.props.selectedPiece._id === adLibPiece._id) ||
												false
											}
											layer={this.state.sourceLayers[adLibPiece.sourceLayerId]}
											outputLayer={this.state.outputLayers[adLibPiece.outputLayerId]}
											onToggleAdLib={this.props.onToggleAdLib}
											onSelectAdLib={this.props.onSelectAdLib}
											playlist={this.props.playlist}
										/>
									))}
						</tbody>
					)
				})
		}

		setTableRef = (el) => {
			this.table = el
		}

		render() {
			const selected = this.props.selectedPiece

			return (
				<div
					className={ClassNames('adlib-panel__list-view__list', {
						'adlib-panel__list-view__list--no-segments': this.props.noSegments,
					})}>
					<table
						id={'adlib-panel__list-view__table__' + Random.id()}
						className="adlib-panel__list-view__list__table"
						ref={this.setTableRef}>
						{this.renderRundownAdLibs()}
						{this.renderSegments()}
					</table>
				</div>
			)
		}
	}
)

interface IToolbarPropsHeader {
	onFilterChange?: (newFilter: string | undefined) => void
	noSegments?: boolean
}

interface IToolbarStateHader {
	searchInputValue: string
}

export const AdLibPanelToolbar = withTranslation()(
	class AdLibPanelToolbar extends React.Component<Translated<IToolbarPropsHeader>, IToolbarStateHader> {
		searchInput: HTMLInputElement

		constructor(props: Translated<IToolbarPropsHeader>) {
			super(props)

			this.state = {
				searchInputValue: '',
			}
		}

		setSearchInputRef = (el: HTMLInputElement) => {
			this.searchInput = el
		}

		searchInputChanged = (e?: React.ChangeEvent<HTMLInputElement>) => {
			this.setState({
				searchInputValue: this.searchInput.value,
			})

			this.props.onFilterChange &&
				typeof this.props.onFilterChange === 'function' &&
				this.props.onFilterChange(this.searchInput.value)
		}

		clearSearchInput = () => {
			this.searchInput.value = ''

			this.searchInputChanged()
		}

		render() {
			const { t } = this.props
			return (
				<div
					className={ClassNames('adlib-panel__list-view__toolbar', {
						'adlib-panel__list-view__toolbar--no-segments': this.props.noSegments,
					})}>
					<div className="adlib-panel__list-view__toolbar__filter">
						<input
							className="adlib-panel__list-view__toolbar__filter__input"
							type="text"
							ref={this.setSearchInputRef}
							placeholder={t('Search...')}
							onChange={this.searchInputChanged}
						/>
						{this.state.searchInputValue !== '' && (
							<div className="adlib-panel__list-view__toolbar__filter__clear" onClick={this.clearSearchInput}>
								<FontAwesomeIcon icon={faTimes} />
							</div>
						)}
					</div>
					<div className="adlib-panel__list-view__toolbar__buttons" style={{ display: 'none' }}>
						<button className="action-btn">
							<FontAwesomeIcon icon={faList} />
						</button>
						<button className="action-btn">
							<FontAwesomeIcon icon={faTh} />
						</button>
					</div>
				</div>
			)
		}
	}
)

export interface AdLibPieceUi extends AdLibPiece {
	hotkey?: string
	isGlobal?: boolean
	isHidden?: boolean
	isSticky?: boolean
	isAction?: boolean
	isClearSourceLayer?: boolean
	adlibAction?: AdLibAction | RundownBaselineAdLibAction
}

export interface AdlibSegmentUi extends DBSegment {
	/** Pieces belonging to this part */
	parts: Array<PartInstance>
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
	hotkeyGroup: string
	selectedPiece: AdLibPieceUi | PieceUi | undefined

	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

interface IState {
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

function actionToAdLibPieceUi(action: AdLibAction | RundownBaselineAdLibAction): AdLibPieceUi {
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
		isAction: true,
		expectedDuration: 0,
		externalId: unprotectString(action._id),
		rundownId: action.rundownId,
		sourceLayerId,
		outputLayerId,
		_rank: action.display._rank || 0,
		content: content,
		adlibAction: action,
		tags: action.display.tags,
		currentPieceTags: action.display.currentPieceTags,
		nextPieceTags: action.display.nextPieceTags,
		lifespan: PieceLifespan.WithinPart, // value doesn't matter
	})
}

export function fetchAndFilter(props: Translated<IAdLibPanelProps>): IAdLibPanelTrackedProps {
	const { t } = props

	const sourceLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.sourceLayers, '_id')

	// a hash to store various indices of the used hotkey lists
	let sourceHotKeyUse: { [key: string]: number } = GlobalAdLibHotkeyUseMap.getAll()

	if (!props.playlist || !props.showStyleBase) {
		return {
			uiSegments: [],
			liveSegment: undefined,
			sourceLayerLookup,
			rundownBaselineAdLibs: [],
		}
	}

	const sharedHotkeyList = _.groupBy(props.showStyleBase.sourceLayers, (item) => item.activateKeyboardHotkeys)

	const segments = props.playlist.getSegments()

	const { uiSegments, liveSegment, uiPartSegmentMap } = memoizedIsolatedAutorun(
		(currentPartInstanceId: PartInstanceId | null, nextPartInstanceId: PartInstanceId | null, segments: Segment[]) => {
			// This is a map of partIds mapped onto segments they are part of
			const uiPartSegmentMap = new Map<PartId, AdlibSegmentUi>()

			if (!segments) {
				return {
					uiSegments: [],
					liveSegment: undefined,
					uiPartSegmentMap,
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
					isNext: false,
				})

				uiSegmentMap.set(segmentUi._id, segmentUi)

				return segmentUi
			})

			const partInstances = props.playlist.getActivePartInstancesMap()

			props.playlist
				.getUnorderedParts({
					segmentId: {
						$in: Array.from(uiSegmentMap.keys()),
					},
				})
				.forEach((part) => {
					const segment = uiSegmentMap.get(part.segmentId)
					if (segment) {
						const partInstance = findPartInstanceOrWrapToTemporary(partInstances, part)
						segment.parts.push(partInstance)

						uiPartSegmentMap.set(part._id, segment)

						if (partInstance._id === currentPartInstanceId) {
							segment.isLive = true
							liveSegment = segment
						}
						if (partInstance._id === nextPartInstanceId) {
							segment.isNext = true
						}
					}
				})

			uiSegmentMap.forEach((segment) => {
				// Sort parts by rank
				segment.parts = _.sortBy(segment.parts, (p) => p.part._rank)
			})

			return {
				uiSegments,
				liveSegment,
				uiPartSegmentMap,
			}
		},
		'uiSegments',
		props.playlist.currentPartInstanceId,
		props.playlist.nextPartInstanceId,
		segments
	)

	uiSegments.forEach((segment) => (segment.pieces.length = 0))

	const rundownIds = props.playlist.getRundownIDs()
	const partIds = Array.from(uiPartSegmentMap.keys())

	AdLibPieces.find(
		{
			rundownId: {
				$in: rundownIds,
			},
			partId: {
				$in: partIds,
			},
		},
		{
			sort: { _rank: 1 },
		}
	)
		.fetch()
		.forEach((piece) => {
			const segment = uiPartSegmentMap.get(piece.partId!)

			if (segment) {
				segment.pieces.push(piece)
			}
		})

	const adlibActions = memoizedIsolatedAutorun(
		(rundownIds: RundownId[], partIds: PartId[]) =>
			AdLibActions.find(
				{
					rundownId: {
						$in: rundownIds,
					},
					partId: {
						$in: partIds,
					},
				},
				{
					// @ts-ignore deep-property
					sort: { 'display._rank': 1 },
				}
			)
				.fetch()
				.map((action) => {
					return [action.partId, actionToAdLibPieceUi(action)]
				}),
		'adLibActions',
		rundownIds,
		partIds
	)

	adlibActions.forEach((action) => {
		const segment = uiPartSegmentMap.get(action[0] as PartId)

		if (segment) {
			segment.pieces.push(action[1] as AdLibPieceUi)
		}
	})

	uiPartSegmentMap.forEach((segment) => {
		segment.pieces = segment.pieces.sort((a, b) => a._rank - b._rank)
	})

	if (liveSegment) {
		liveSegment.pieces.forEach((item) => {
			let sourceLayer = item.sourceLayerId && sourceLayerLookup[item.sourceLayerId]

			if (sourceLayer && sourceLayer.activateKeyboardHotkeys) {
				let keyboardHotkeysList = sourceLayer.activateKeyboardHotkeys.split(',')
				const sourceHotKeyUseLayerId =
					sharedHotkeyList[sourceLayer.activateKeyboardHotkeys][0]._id || item.sourceLayerId
				if ((sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) < keyboardHotkeysList.length) {
					item.hotkey = keyboardHotkeysList[sourceHotKeyUse[sourceHotKeyUseLayerId] || 0]
					// add one to the usage hash table
					sourceHotKeyUse[sourceHotKeyUseLayerId] = (sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) + 1
				}
			}
		})
	}

	let currentRundown: Rundown | undefined = undefined
	let rundownBaselineAdLibs: Array<AdLibPieceUi> = []
	if (
		props.playlist &&
		props.filter &&
		props.includeGlobalAdLibs &&
		(props.filter.rundownBaseline === true || props.filter.rundownBaseline === 'only')
	) {
		const { t } = props

		const rundowns = props.playlist.getRundowns(undefined, {
			fields: {
				_id: 1,
				_rank: 1,
				name: 1,
			},
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

			rundownBaselineAdLibs = memoizedIsolatedAutorun(
				(
					currentRundownId: RundownId,
					sourceLayerLookup: SourceLayerLookup,
					sourceLayers: ISourceLayer[],
					sourceHotKeyUse: { [key: string]: number }
				) => {
					let rundownAdLibItems = RundownBaselineAdLibPieces.find(
						{
							rundownId: currentRundownId,
						},
						{
							sort: { sourceLayerId: 1, _rank: 1, name: 1 },
						}
					).fetch()
					rundownBaselineAdLibs = rundownAdLibItems.concat(
						props.showStyleBase.sourceLayers
							.filter((i) => i.isSticky && i.activateStickyKeyboardHotkey)
							.sort((a, b) => a._rank - b._rank)
							.map((layer) =>
								literal<AdLibPieceUi>({
									_id: protectString(`sticky_${layer._id}`),
									hotkey: layer.activateStickyKeyboardHotkey ? layer.activateStickyKeyboardHotkey.split(',')[0] : '',
									name: t('Last {{layerName}}', { layerName: layer.abbreviation || layer.name }),
									status: RundownAPI.PieceStatusCode.UNKNOWN,
									isSticky: true,
									isGlobal: true,
									expectedDuration: 0,
									lifespan: PieceLifespan.WithinPart,
									externalId: layer._id,
									rundownId: protectString(''),
									sourceLayerId: layer._id,
									outputLayerId: '',
									_rank: 0,
								})
							)
					)

					const globalAdLibActions = memoizedIsolatedAutorun(
						(rundownIds: RundownId[]) =>
							RundownBaselineAdLibActions.find(
								{
									rundownId: {
										$in: rundownIds,
									},
									partId: {
										$exists: false,
									},
								},
								{
									// @ts-ignore deep-property
									sort: { 'display._rank': 1 },
								}
							)
								.fetch()
								.map((action) => actionToAdLibPieceUi(action)),
						'globalAdLibActions',
						rundownIds
					)

					rundownBaselineAdLibs = rundownBaselineAdLibs
						.concat(globalAdLibActions)
						.map((item) => {
							// automatically assign hotkeys based on adLibItem index
							const uiAdLib: AdLibPieceUi = _.clone(item)
							uiAdLib.isGlobal = true

							let sourceLayer = item.sourceLayerId && sourceLayerLookup[item.sourceLayerId]
							if (sourceLayer && sourceLayer.activateKeyboardHotkeys && sourceLayer.assignHotkeysToGlobalAdlibs) {
								let keyboardHotkeysList = sourceLayer.activateKeyboardHotkeys.split(',')
								const sourceHotKeyUseLayerId =
									sharedHotkeyList[sourceLayer.activateKeyboardHotkeys][0]._id || item.sourceLayerId
								if ((sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) < keyboardHotkeysList.length) {
									uiAdLib.hotkey = keyboardHotkeysList[sourceHotKeyUse[sourceHotKeyUseLayerId] || 0]
									// add one to the usage hash table
									sourceHotKeyUse[sourceHotKeyUseLayerId] = (sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) + 1
								}
							}

							if (sourceLayer && sourceLayer.isHidden) {
								uiAdLib.isHidden = true
							}

							// always add them to the list
							return uiAdLib
						})
						.sort((a, b) => a._rank - b._rank)

					return rundownBaselineAdLibs.sort((a, b) => a._rank - b._rank)
				},
				'rundownBaselineAdLibs',
				currentRundown._id,
				sourceLayerLookup,
				props.showStyleBase.sourceLayers,
				sourceHotKeyUse
			)
		}

		if ((props.filter as DashboardLayoutFilter).includeClearInRundownBaseline) {
			const rundownBaselineClearAdLibs = memoizedIsolatedAutorun(
				(sourceLayers: ISourceLayer[]) => {
					return sourceLayers
						.filter((i) => !!i.clearKeyboardHotkey)
						.sort((a, b) => a._rank - b._rank)
						.map((layer) =>
							literal<AdLibPieceUi>({
								_id: protectString(`clear_${layer._id}`),
								hotkey: layer.clearKeyboardHotkey ? layer.clearKeyboardHotkey.split(',')[0] : '',
								name: t('Clear {{layerName}}', { layerName: layer.abbreviation || layer.name }),
								status: RundownAPI.PieceStatusCode.UNKNOWN,
								isSticky: false,
								isClearSourceLayer: true,
								isGlobal: true,
								expectedDuration: 0,
								lifespan: PieceLifespan.WithinPart,
								externalId: layer._id,
								rundownId: protectString(''),
								sourceLayerId: layer._id,
								outputLayerId: '',
								_rank: 0,
							})
						)
				},
				'rundownBaselineClearAdLibs',
				props.showStyleBase.sourceLayers
			)
			rundownBaselineAdLibs = rundownBaselineAdLibs.concat(rundownBaselineClearAdLibs)
		}
	}

	return {
		uiSegments: props.filter && props.filter.rundownBaseline === 'only' ? [] : uiSegments,
		liveSegment,
		sourceLayerLookup,
		rundownBaselineAdLibs,
	}
}

export const AdLibPanel = translateWithTracker<IAdLibPanelProps, IState, IAdLibPanelTrackedProps>(
	(props: Translated<IAdLibPanelProps>) => {
		const d = fetchAndFilter(props)
		return d
	},
	(data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(
	class AdLibPanel extends MeteorReactComponent<Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>, IState> {
		usedHotkeys: Array<string> = []

		constructor(props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
			super(props)

			this.state = {
				selectedSegment: undefined,
				searchFilter: undefined,
				followLive: true,
			}
		}

		componentDidMount() {
			if (this.props.liveSegment) {
				this.setState({
					selectedSegment: this.props.liveSegment,
				})
			}

			this.refreshKeyboardHotkeys()

			window.addEventListener(RundownViewEvents.revealInShelf, this.onRevealInShelf)
		}

		componentDidUpdate(prevProps: IAdLibPanelProps & IAdLibPanelTrackedProps) {
			mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', this.props.hotkeyGroup)
			mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', this.props.hotkeyGroup)
			this.usedHotkeys.length = 0

			if (this.props.liveSegment && this.props.liveSegment !== prevProps.liveSegment && this.state.followLive) {
				this.setState({
					selectedSegment: this.props.liveSegment,
				})
			}

			this.refreshKeyboardHotkeys()
		}

		componentWillUnmount() {
			this._cleanUp()
			mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', this.props.hotkeyGroup)
			mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', this.props.hotkeyGroup)

			this.usedHotkeys.length = 0

			window.removeEventListener(RundownViewEvents.revealInShelf, this.onRevealInShelf)
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
						mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
						mousetrapHelper.bind(
							item.hotkey,
							(e: ExtendedKeyboardEvent) => {
								preventDefault(e)
								this.onToggleAdLib(item, false, e)
							},
							'keyup',
							this.props.hotkeyGroup
						)
						this.usedHotkeys.push(item.hotkey)

						if (this.props.sourceLayerLookup[item.sourceLayerId]) {
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
						}

						const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
						if (sourceLayer && sourceLayer.isQueueable) {
							const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
							mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
							mousetrapHelper.bind(
								queueHotkey,
								(e: ExtendedKeyboardEvent) => {
									preventDefault(e)
									this.onToggleAdLib(item, true, e)
								},
								'keyup',
								this.props.hotkeyGroup
							)
							this.usedHotkeys.push(queueHotkey)
						}
					}
				})
			}
		}

		onRevealInShelf = (e: CustomEvent) => {
			const pieceId = e.detail && e.detail.pieceId
			let found = false
			if (pieceId) {
				const index = this.props.rundownBaselineAdLibs.findIndex((piece) => piece._id === pieceId)

				if (index >= 0) {
					found = true
				} else {
					this.props.uiSegments.forEach((segment) => {
						const index = segment.pieces.findIndex((piece) => piece._id === pieceId)
						if (index >= 0) {
							found = true
						}
					})
				}

				if (found) {
					window.dispatchEvent(
						new CustomEvent(RundownViewEvents.switchShelfTab, {
							detail: {
								tab: this.props.filter ? `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${this.props.filter._id}` : ShelfTabs.ADLIB,
							},
						})
					)

					Meteor.setTimeout(() => {
						const el = document.querySelector(`.adlib-panel__list-view__list__segment__item[data-obj-id="${pieceId}"]`)
						if (el) {
							el.scrollIntoView({
								behavior: 'smooth',
							})
						}
					}, 100)
				}
			}
		}

		onFilterChange = (filter: string) => {
			this.setState({
				searchFilter: filter,
			})
		}

		onSelectAdLib = (piece: IAdLibListItem) => {
			this.props.onSelectPiece && this.props.onSelectPiece(piece as AdLibPieceUi)
		}

		onToggleAdLib = (adlibPiece: AdLibPieceUi, queue: boolean, e: any) => {
			const { t } = this.props

			if (adlibPiece.invalid) {
				NotificationCenter.push(
					new Notification(
						t('Invalid AdLib'),
						NoticeLevel.WARNING,
						t('Cannot play this AdLib because it is marked as Invalid'),
						'toggleAdLib'
					)
				)
				return
			}
			if (adlibPiece.floated) {
				NotificationCenter.push(
					new Notification(
						t('Floated AdLib'),
						NoticeLevel.WARNING,
						t('Cannot play this AdLib because it is marked as Floated'),
						'toggleAdLib'
					)
				)
				return
			}

			if (
				queue &&
				this.props.sourceLayerLookup &&
				this.props.sourceLayerLookup[adlibPiece.sourceLayerId] &&
				!this.props.sourceLayerLookup[adlibPiece.sourceLayerId].isQueueable
			) {
				console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
				return
			}
			if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
				const currentPartInstanceId = this.props.playlist.currentPartInstanceId
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(t, e, adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.executeAction(e, this.props.playlist._id, action.actionId, action.userData)
					)
				} else if (!adlibPiece.isGlobal && !adlibPiece.isAction) {
					doUserAction(t, e, UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.segmentAdLibPieceStart(
							e,
							this.props.playlist._id,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e) =>
						MeteorCall.userAction.baselineAdLibPieceStart(
							e,
							this.props.playlist._id,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_STICKY_PIECE, (e) =>
						MeteorCall.userAction.sourceLayerStickyPieceStart(e, this.props.playlist._id, adlibPiece.sourceLayerId)
					)
				}
			}
		}

		onClearAllSourceLayers = (sourceLayers: ISourceLayer[], e: any) => {
			const { t } = this.props
			if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
				const currentPartInstanceId = this.props.playlist.currentPartInstanceId
				doUserAction(t, e, UserAction.CLEAR_SOURCELAYER, (e) =>
					MeteorCall.userAction.sourceLayerOnPartStop(
						e,
						this.props.playlist._id,
						currentPartInstanceId,
						sourceLayers.map((i) => i._id)
					)
				)
			}
		}

		onSelectSegment = (segment: AdlibSegmentUi) => {
			this.setState({
				selectedSegment: segment,
				followLive: this.props.liveSegment ? segment._id === this.props.liveSegment._id : true,
			})
		}

		renderSegmentList() {
			return this.props.uiSegments.map((item) => {
				return (
					<li
						className={ClassNames('adlib-panel__segments__segment', {
							live: item.isLive,
							next: item.isNext && !item.isLive,
							past:
								item.parts.reduce((memo, part) => {
									return part.timings?.startedPlayback && part.timings?.duration ? memo : false
								}, true) === true,
						})}
						onClick={(e) => this.onSelectSegment(item)}
						key={unprotectString(item._id)}
						tabIndex={0}>
						{item.name}
					</li>
				)
			})
		}

		renderListView(withSegments?: boolean) {
			return (
				<React.Fragment>
					<AdLibPanelToolbar onFilterChange={this.onFilterChange} noSegments={!withSegments} />
					<AdLibListView
						uiSegments={this.props.uiSegments}
						rundownAdLibs={this.props.rundownBaselineAdLibs}
						onSelectAdLib={this.onSelectAdLib}
						onToggleAdLib={this.onToggleAdLib}
						selectedPiece={this.props.selectedPiece}
						selectedSegment={this.state.selectedSegment}
						showStyleBase={this.props.showStyleBase}
						searchFilter={this.state.searchFilter}
						filter={this.props.filter as RundownLayoutFilter}
						playlist={this.props.playlist}
						noSegments={!withSegments}
					/>
				</React.Fragment>
			)
		}

		render() {
			if (this.props.visible) {
				if (!this.props.uiSegments || !this.props.playlist) {
					return <Spinner />
				} else {
					return (
						<div
							className="adlib-panel super-dark"
							data-tab-id={
								this.props.filter ? `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${this.props.filter._id}` : ShelfTabs.ADLIB
							}>
							{this.props.uiSegments.length > 30 && (
								<ul className="adlib-panel__segments">{this.renderSegmentList()}</ul>
							)}
							{this.renderListView(this.props.uiSegments.length > 30)}
						</div>
					)
				}
			}
			return null
		}
	}
)
