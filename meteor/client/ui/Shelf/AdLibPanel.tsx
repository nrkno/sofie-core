import React from 'react'
import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { useTranslation, withTranslation } from 'react-i18next'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Segment, SegmentId } from '../../../lib/collections/Segments'
import { PartId } from '../../../lib/collections/Parts'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { AdLibListItem, IAdLibListItem } from './AdLibListItem'
import ClassNames from 'classnames'

import { faTh, faList, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import {
	IOutputLayer,
	ISourceLayer,
	PieceLifespan,
	IBlueprintActionTriggerMode,
	SomeTimelineContent,
} from '@sofie-automation/blueprints-integration'
import { doUserAction, UserAction } from '../../lib/userAction'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import {
	RundownLayoutFilter,
	RundownLayoutFilterBase,
	DashboardLayoutFilter,
} from '../../../lib/collections/RundownLayouts'
import {
	RundownBaselineAdLibItem,
	RundownBaselineAdLibPieces,
} from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal, normalizeArray, unprotectString, protectString } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { memoizedIsolatedAutorun } from '../../lib/reactiveData/reactiveDataHelper'
import {
	PartInstances,
	PartInstanceId,
	findPartInstanceOrWrapToTemporary,
} from '../../../lib/collections/PartInstances'
import { MeteorCall } from '../../../lib/api/methods'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { AdLibActions, AdLibAction } from '../../../lib/collections/AdLibActions'
import { RundownUtils } from '../../lib/rundown'
import { ShelfTabs } from './Shelf'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { Studio } from '../../../lib/collections/Studios'
import { BucketAdLibActionUi, BucketAdLibUi } from './RundownViewBuckets'
import RundownViewEventBus, { RundownViewEvents, RevealInShelfEvent } from '../RundownView/RundownViewEventBus'
import { translateMessage } from '../../../lib/api/TranslatableMessage'
import { i18nTranslator } from '../i18n'
import { AdLibPieceUi, AdlibSegmentUi } from '../../lib/shelf'
import { getShelfFollowsOnAir, getShowHiddenSourceLayers } from '../../lib/localStorage'

interface IListViewPropsHeader {
	uiSegments: Array<AdlibSegmentUi>
	onSelectAdLib: (piece: IAdLibListItem) => void
	onToggleAdLib: (piece: IAdLibListItem, queue: boolean, e: KeyboardEvent, mode?: IBlueprintActionTriggerMode) => void
	selectedPiece: BucketAdLibActionUi | BucketAdLibUi | IAdLibListItem | PieceUi | undefined
	selectedSegment: AdlibSegmentUi | undefined
	searchFilter: string | undefined
	showStyleBase: ShowStyleBase
	noSegments: boolean
	filter: RundownLayoutFilter | undefined
	rundownAdLibs?: Array<AdLibPieceUi>
	playlist: RundownPlaylist
	studio: Studio
}

interface IListViewStateHeader {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	liveSegment?: AdlibSegmentUi
}

/**
 * Applies a filter to an adLib to determine whether it matches filter criteria.
 * @param item AdLib to test against filter.
 * @param showStyleBase
 * @param uiSegments All segments to search for live segment.
 * @param filter Filter to match against.
 * @param searchFilter Text to try to match against adLib label.
 * @param uniquenessIds Set of uniquenessIds, for a given set only one adLib per uniquness Id will be matched by this filter.
 */
export function matchFilter(
	item: AdLibPieceUi,
	showStyleBase: ShowStyleBase,
	liveSegment?: AdlibSegmentUi,
	filter?: RundownLayoutFilterBase,
	searchFilter?: string,
	uniquenessIds?: Set<string>
) {
	if (!searchFilter && !filter) return true
	const uppercaseLabel = item.name.toUpperCase()
	if (filter) {
		// Filter currentSegment only
		if (
			filter.currentSegment === true &&
			item.partId &&
			((liveSegment && liveSegment._id !== item.segmentId) || !liveSegment)
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
		// Hide duplicates
		// Only the first adLib found with a given uniquenessId will be displayed if this option is enabled.
		// Scope of the filter is determined by the scope of the uniquenessIds set (typically rundown-wide).
		if (filter.hideDuplicates && uniquenessIds) {
			const uniquenessId = item.uniquenessId || unprotectString(item._id)
			if (uniquenessIds.has(uniquenessId)) {
				return false
			} else {
				uniquenessIds.add(uniquenessId)
			}
		}
	}
	if (searchFilter) {
		return uppercaseLabel.indexOf(searchFilter.trim().toUpperCase()) >= 0
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

		static getDerivedStateFromProps(props: IListViewPropsHeader) {
			const tOLayers: {
				[key: string]: IOutputLayer
			} = {}
			const tSLayers: {
				[key: string]: ISourceLayer
			} = {}

			const liveSegment = props.uiSegments.find((i) => i.isLive === true)

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
					liveSegment,
				}
			}
			return { liveSegment }
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

		renderRundownAdLibs(uniquenessIds: Set<string>) {
			return (
				<tbody className="adlib-panel__list-view__list__segment adlib-panel__list-view__item__rundown-baseline">
					{this.props.rundownAdLibs &&
						this.props.rundownAdLibs
							.filter(
								(item) =>
									!item.isHidden &&
									matchFilter(
										item,
										this.props.showStyleBase,
										this.state.liveSegment,
										this.props.filter,
										this.props.searchFilter,
										uniquenessIds
									)
							)
							.map((adLibPiece: AdLibPieceUi) => (
								<AdLibListItem
									key={unprotectString(adLibPiece._id)}
									piece={adLibPiece}
									layer={adLibPiece.sourceLayer!}
									studio={this.props.studio}
									selected={
										(this.props.selectedPiece &&
											RundownUtils.isAdLibPiece(this.props.selectedPiece) &&
											this.props.selectedPiece._id === adLibPiece._id) ||
										false
									}
									onToggleAdLib={this.props.onToggleAdLib}
									onSelectAdLib={this.props.onSelectAdLib}
									playlist={this.props.playlist}
								/>
							))}
				</tbody>
			)
		}

		renderSegments(uniquenessIds: Set<string>) {
			return this.props.uiSegments
				.filter((a) => (this.props.filter ? (this.props.filter.currentSegment ? a.isLive : true) : true))
				.map((segment) => {
					const segmentAdLibs = segment.pieces.filter((item) =>
						matchFilter(
							item,
							this.props.showStyleBase,
							this.state.liveSegment,
							this.props.filter,
							this.props.searchFilter,
							uniquenessIds
						)
					)

					// only show the segment in the list if it's not hidden or it does contain some AdLibs
					return !segment.isHidden || segment.pieces.length > 0 ? (
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
							)}
						>
							<tr className="adlib-panel__list-view__list__seg-header">
								<td colSpan={4}>{segment.name}</td>
							</tr>
							{segmentAdLibs.map((adLibPiece: AdLibPieceUi) => (
								<AdLibListItem
									key={unprotectString(adLibPiece._id)}
									piece={adLibPiece}
									layer={adLibPiece.sourceLayer!}
									studio={this.props.studio}
									selected={
										(this.props.selectedPiece &&
											RundownUtils.isAdLibPiece(this.props.selectedPiece) &&
											this.props.selectedPiece._id === adLibPiece._id) ||
										false
									}
									onToggleAdLib={this.props.onToggleAdLib}
									onSelectAdLib={this.props.onSelectAdLib}
									playlist={this.props.playlist}
								/>
							))}
						</tbody>
					) : null
				})
		}

		setTableRef = (el) => {
			this.table = el
		}

		render() {
			const uniquenessIds = new Set<string>()

			return (
				<div
					className={ClassNames('adlib-panel__list-view__list', {
						'adlib-panel__list-view__list--no-segments': this.props.noSegments,
					})}
				>
					<table
						id={'adlib-panel__list-view__table__' + Random.id()}
						className="adlib-panel__list-view__list__table scroll-sink"
						ref={this.setTableRef}
					>
						{this.renderRundownAdLibs(uniquenessIds)}
						{this.renderSegments(uniquenessIds)}
					</table>
				</div>
			)
		}
	}
)

interface IToolbarPropsHeader {
	onFilterChange?: (newFilter: string | undefined) => void
	noSegments?: boolean
	searchFilter: string | undefined
}

export function AdLibPanelToolbar(props: IToolbarPropsHeader) {
	const { t } = useTranslation()

	function searchInputChanged(e?: React.ChangeEvent<HTMLInputElement>) {
		const newValue = e?.target.value || ''
		props.onFilterChange && typeof props.onFilterChange === 'function' && props.onFilterChange(newValue)
	}

	function searchInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Escape' || e.key === 'Enter') {
			document.querySelector('button')?.focus()
		} else if (e.key.match(/^F\d+$/)) {
			e.preventDefault()
		}
	}

	function clearSearchInput() {
		searchInputChanged()
	}

	return (
		<div
			className={ClassNames('adlib-panel__list-view__toolbar', {
				'adlib-panel__list-view__toolbar--no-segments': props.noSegments,
			})}
		>
			<div className="adlib-panel__list-view__toolbar__filter">
				<input
					className="adlib-panel__list-view__toolbar__filter__input"
					type="text"
					placeholder={t('Search...')}
					onChange={searchInputChanged}
					onKeyDown={searchInputKeyDown}
					value={props.searchFilter || ''}
				/>
				{props.searchFilter !== '' && (
					<div className="adlib-panel__list-view__toolbar__filter__clear" onClick={clearSearchInput}>
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

export interface IAdLibPanelProps {
	// liveSegment: Segment | undefined
	visible: boolean
	playlist: RundownPlaylist
	studio: Studio
	showStyleBase: ShowStyleBase
	studioMode: boolean
	filter?: RundownLayoutFilterBase
	includeGlobalAdLibs?: boolean
	registerHotkeys?: boolean
	hotkeyGroup: string
	selectedPiece: BucketAdLibUi | BucketAdLibActionUi | IAdLibListItem | PieceUi | undefined

	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

interface IState {
	selectedSegment: AdlibSegmentUi | undefined
	followLive: boolean
	searchFilter: string | undefined
}

export type SourceLayerLookup = { [id: string]: ISourceLayer }

export interface AdLibFetchAndFilterProps {
	uiSegments: Array<AdlibSegmentUi>
	uiSegmentMap: Map<SegmentId, AdlibSegmentUi>
	liveSegment: AdlibSegmentUi | undefined
	sourceLayerLookup: SourceLayerLookup
	rundownBaselineAdLibs: Array<AdLibPieceUi>
}

interface IAdLibPanelTrackedProps extends AdLibFetchAndFilterProps {
	studio: Studio
}

export function actionToAdLibPieceUi(
	action: AdLibAction | RundownBaselineAdLibAction,
	sourceLayers: _.Dictionary<ISourceLayer>,
	outputLayers: _.Dictionary<IOutputLayer>
): AdLibPieceUi {
	let sourceLayerId = ''
	let outputLayerId = ''
	let content: SomeTimelineContent = { timelineObjects: [] }
	if (RundownUtils.isAdlibActionContent(action.display)) {
		sourceLayerId = action.display.sourceLayerId
		outputLayerId = action.display.outputLayerId
		content = {
			timelineObjects: [],
			...action.display.content,
		}
	}

	return literal<AdLibPieceUi>({
		_id: protectString(`${action._id}`),
		name: translateMessage(action.display.label, i18nTranslator),
		status: RundownAPI.PieceStatusCode.UNKNOWN,
		isAction: true,
		expectedDuration: 0,
		externalId: unprotectString(action._id),
		rundownId: action.rundownId,
		partId: action.partId,
		sourceLayer: sourceLayers[sourceLayerId],
		outputLayer: outputLayers[outputLayerId],
		sourceLayerId,
		outputLayerId,
		_rank: action.display._rank || 0,
		content: content,
		adlibAction: action,
		tags: action.display.tags,
		currentPieceTags: action.display.currentPieceTags,
		nextPieceTags: action.display.nextPieceTags,
		uniquenessId: action.display.uniquenessId,
		lifespan: PieceLifespan.WithinPart, // value doesn't matter
		noHotKey: action.display.noHotKey,
		expectedPackages: action.expectedPackages,
	})
}

export function fetchAndFilter(props: Translated<IAdLibPanelProps>): AdLibFetchAndFilterProps {
	const sourceLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.sourceLayers, '_id')
	const outputLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.outputLayers, '_id')

	if (!props.playlist || !props.showStyleBase) {
		return {
			uiSegments: [],
			uiSegmentMap: new Map(),
			liveSegment: undefined,
			sourceLayerLookup,
			rundownBaselineAdLibs: [],
		}
	}

	const segments = props.playlist.getSegments()

	const { uiSegments, uiSegmentMap, liveSegment, uiPartSegmentMap } = memoizedIsolatedAutorun(
		(currentPartInstanceId: PartInstanceId | null, nextPartInstanceId: PartInstanceId | null, segments: Segment[]) => {
			// This is a map of partIds mapped onto segments they are part of
			const uiPartSegmentMap = new Map<PartId, AdlibSegmentUi>()

			if (!segments) {
				return {
					uiSegments: [],
					uiSegmentMap: new Map(),
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
					isLive: false,
					isNext: false,
				})

				uiSegmentMap.set(segmentUi._id, segmentUi)

				return segmentUi
			})

			const { currentPartInstance, nextPartInstance } = props.playlist.getSelectedPartInstances()
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
					}
				})

			if (currentPartInstance) {
				const segment = uiSegmentMap.get(currentPartInstance.segmentId)
				if (segment) {
					liveSegment = segment
					segment.isLive = true
				}
			}

			if (nextPartInstance) {
				const segment = uiSegmentMap.get(nextPartInstance.segmentId)
				if (segment) {
					segment.isNext = true
				}
			}

			uiSegmentMap.forEach((segment) => {
				// Sort parts by rank
				segment.parts = segment.parts.sort((a, b) => a.part._rank - b.part._rank)
			})

			return {
				uiSegments,
				uiSegmentMap,
				liveSegment,
				uiPartSegmentMap,
			}
		},
		'uiSegments',
		props.playlist.currentPartInstanceId,
		props.playlist.nextPartInstanceId,
		segments
	)

	uiSegments.forEach((segment) => (segment.pieces = []))

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
				segment.pieces.push({
					...piece,
					sourceLayer: sourceLayerLookup[piece.sourceLayerId],
					outputLayer: outputLayerLookup[piece.outputLayerId],
					segmentId: segment._id,
				})
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
			).map((action) => {
				return [action.partId, actionToAdLibPieceUi(action, sourceLayerLookup, outputLayerLookup)] as [
					PartId,
					AdLibPieceUi
				]
			}),
		'adLibActions',
		rundownIds,
		partIds
	)

	adlibActions.forEach((action) => {
		const segment = uiPartSegmentMap.get(action[0])

		if (segment) {
			segment.pieces.push({ ...action[1], segmentId: segment._id })
		}
	})

	uiPartSegmentMap.forEach((segment) => {
		segment.pieces = segment.pieces.sort((a, b) => a._rank - b._rank)
	})

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
				(currentRundownId: RundownId, sourceLayerLookup: SourceLayerLookup) => {
					const rundownAdLibItems: RundownBaselineAdLibItem[] = RundownBaselineAdLibPieces.find(
						{
							rundownId: currentRundownId,
						},
						{
							sort: { sourceLayerId: 1, _rank: 1, name: 1 },
						}
					).fetch()
					rundownBaselineAdLibs = rundownAdLibItems.concat(
						props.showStyleBase.sourceLayers
							.filter((i) => i.isSticky)
							.sort((a, b) => a._rank - b._rank)
							.map((layer) =>
								literal<AdLibPieceUi>({
									_id: protectString(`sticky_${layer._id}`),
									name: t('Last {{layerName}}', { layerName: layer.abbreviation || layer.name }),
									status: RundownAPI.PieceStatusCode.UNKNOWN,
									isSticky: true,
									isGlobal: true,
									expectedDuration: 0,
									lifespan: PieceLifespan.WithinPart,
									externalId: layer._id,
									rundownId: protectString(''),
									sourceLayer: layer,
									outputLayer: undefined,
									sourceLayerId: layer._id,
									outputLayerId: '',
									_rank: 0,
									content: { timelineObjects: [] },
									noHotKey: false,
								})
							)
					)

					const globalAdLibActions = memoizedIsolatedAutorun(
						(currentRundownId: RundownId) =>
							RundownBaselineAdLibActions.find(
								{
									rundownId: currentRundownId,
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
								.map((action) => actionToAdLibPieceUi(action, sourceLayerLookup, outputLayerLookup)),
						'globalAdLibActions',
						currentRundownId
					)

					const showHiddenSourceLayers = getShowHiddenSourceLayers()

					rundownBaselineAdLibs = rundownBaselineAdLibs
						.concat(globalAdLibActions)
						.sort((a, b) => a._rank - b._rank)
						.map((item) => {
							// automatically assign hotkeys based on adLibItem index
							const uiAdLib: AdLibPieceUi = _.clone(item)
							uiAdLib.isGlobal = true

							const sourceLayer = (uiAdLib.sourceLayer =
								(item.sourceLayerId && sourceLayerLookup[item.sourceLayerId]) || undefined)
							uiAdLib.outputLayer = (item.outputLayerId && outputLayerLookup[item.outputLayerId]) || undefined

							if (sourceLayer && sourceLayer.isHidden && !showHiddenSourceLayers) {
								uiAdLib.isHidden = true
							}

							// always add them to the list
							return uiAdLib
						})

					return rundownBaselineAdLibs.sort((a, b) => a._rank - b._rank)
				},
				'rundownBaselineAdLibs',
				currentRundown._id,
				sourceLayerLookup
			)
		}

		if ((props.filter as DashboardLayoutFilter).includeClearInRundownBaseline) {
			const rundownBaselineClearAdLibs = memoizedIsolatedAutorun(
				(sourceLayers: ISourceLayer[]) => {
					return sourceLayers
						.filter((i) => !!i.isClearable)
						.sort((a, b) => a._rank - b._rank)
						.map((layer) =>
							literal<AdLibPieceUi>({
								_id: protectString(`clear_${layer._id}`),
								name: t('Clear {{layerName}}', { layerName: layer.abbreviation || layer.name }),
								status: RundownAPI.PieceStatusCode.UNKNOWN,
								isSticky: false,
								isClearSourceLayer: true,
								isGlobal: true,
								expectedDuration: 0,
								lifespan: PieceLifespan.WithinPart,
								externalId: layer._id,
								rundownId: protectString(''),
								sourceLayer: layer,
								outputLayer: undefined,
								sourceLayerId: layer._id,
								outputLayerId: '',
								_rank: 0,
								content: { timelineObjects: [] },
								noHotKey: false,
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
		uiSegmentMap: props.filter && props.filter.rundownBaseline === 'only' ? new Map() : uiSegmentMap,
		liveSegment,
		sourceLayerLookup,
		rundownBaselineAdLibs,
	}
}

export const AdLibPanel = translateWithTracker<IAdLibPanelProps, IState, IAdLibPanelTrackedProps>(
	(props: Translated<IAdLibPanelProps>) => {
		const data = fetchAndFilter(props)
		return {
			...data,
			studio: props.playlist.getStudio(),
		}
	},
	(data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(
	class AdLibPanel extends MeteorReactComponent<Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>, IState> {
		usedHotkeys: Array<string> = []

		constructor(props: Translated<IAdLibPanelProps & AdLibFetchAndFilterProps>) {
			super(props)

			this.state = {
				selectedSegment: undefined,
				searchFilter: undefined,
				followLive: getShelfFollowsOnAir(),
			}
		}

		componentDidMount() {
			if (this.props.liveSegment) {
				this.setState({
					selectedSegment: this.props.liveSegment,
				})
			}

			RundownViewEventBus.on(RundownViewEvents.REVEAL_IN_SHELF, this.onRevealInShelf)
		}

		componentDidUpdate(prevProps: IAdLibPanelProps & AdLibFetchAndFilterProps) {
			this.usedHotkeys.length = 0

			if (this.props.liveSegment && this.props.liveSegment !== prevProps.liveSegment && this.state.followLive) {
				this.setState({
					selectedSegment: this.props.liveSegment,
				})
			}
		}

		componentWillUnmount() {
			this._cleanUp()

			this.usedHotkeys = []

			RundownViewEventBus.off(RundownViewEvents.REVEAL_IN_SHELF, this.onRevealInShelf)
		}

		onRevealInShelf = (e: RevealInShelfEvent) => {
			const { pieceId } = e
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
					RundownViewEventBus.emit(RundownViewEvents.SWITCH_SHELF_TAB, {
						tab: this.props.filter ? `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${this.props.filter._id}` : ShelfTabs.ADLIB,
					})

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

		onFilterChange = (filter: string | undefined) => {
			this.setState({
				searchFilter: filter,
			})
		}

		onSelectAdLib = (piece: IAdLibListItem) => {
			this.props.onSelectPiece && this.props.onSelectPiece(piece as AdLibPieceUi)
		}

		onToggleAdLib = (adlibPiece: AdLibPieceUi, queue: boolean, e: any, mode?: IBlueprintActionTriggerMode) => {
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
				queue = false
			}
			if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
				const currentPartInstanceId = this.props.playlist.currentPartInstanceId
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(t, e, adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.executeAction(
							e,
							this.props.playlist._id,
							action._id,
							action.actionId,
							action.userData,
							mode?.data
						)
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
			})
		}

		renderSegmentList() {
			return this.props.uiSegments.map((segment) => {
				return !segment.isHidden || segment.pieces.length > 0 ? (
					<li
						className={ClassNames('adlib-panel__segments__segment', {
							live: segment.isLive,
							next: segment.isNext && !segment.isLive,
							past:
								segment.parts.reduce((memo, part) => {
									return part.timings?.startedPlayback && part.timings?.duration ? memo : false
								}, true) === true,
						})}
						onClick={() => this.onSelectSegment(segment)}
						key={unprotectString(segment._id)}
						tabIndex={0}
					>
						{segment.name}
					</li>
				) : null
			})
		}

		renderListView(withSegments?: boolean) {
			return (
				<React.Fragment>
					<AdLibPanelToolbar
						onFilterChange={this.onFilterChange}
						noSegments={!withSegments}
						searchFilter={this.state.searchFilter}
					/>
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
						studio={this.props.studio}
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
							}
						>
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
