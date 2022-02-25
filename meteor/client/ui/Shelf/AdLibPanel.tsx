import React, { useState, useCallback, useEffect } from 'react'
import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { useTranslation } from 'react-i18next'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { RundownPlaylist, RundownPlaylistCollectionUtil } from '../../../lib/collections/RundownPlaylists'
import { DBSegment, Segment, SegmentId } from '../../../lib/collections/Segments'
import { DBPart, PartId } from '../../../lib/collections/Parts'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { IAdLibListItem } from './AdLibListItem'
import ClassNames from 'classnames'

import { Spinner } from '../../lib/Spinner'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import {
	IOutputLayer,
	ISourceLayer,
	PieceLifespan,
	IBlueprintActionTriggerMode,
	SomeContent,
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
import { literal, normalizeArray, unprotectString, protectString } from '../../../lib/lib'
import { memoizedIsolatedAutorun } from '../../lib/reactiveData/reactiveDataHelper'
import {
	PartInstance,
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
import { ScanInfoForPackages } from '../../../lib/mediaObjects'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../i18n'
import { getShelfFollowsOnAir, getShowHiddenSourceLayers } from '../../lib/localStorage'
import { sortAdlibs } from '../../../lib/Rundown'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPanelToolbar } from './AdLibPanelToolbar'
import { AdLibListView } from './AdLibListView'

export interface AdLibPieceUi extends Omit<AdLibPiece, 'timelineObjectsString'> {
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	isGlobal?: boolean
	isHidden?: boolean
	isSticky?: boolean
	isAction?: boolean
	isClearSourceLayer?: boolean
	disabled?: boolean
	adlibAction?: AdLibAction | RundownBaselineAdLibAction
	contentMetaData?: any
	contentPackageInfos?: ScanInfoForPackages
	message?: string | null
}

export interface AdlibSegmentUi extends DBSegment {
	/** Pieces belonging to this part */
	parts: Array<PartInstance>
	pieces: Array<AdLibPieceUi>
	isLive: boolean
	isNext: boolean
	isCompatibleShowStyle: boolean
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
	selectedPiece: BucketAdLibUi | BucketAdLibActionUi | IAdLibListItem | PieceUi | undefined

	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

type SourceLayerLookup = Record<string, ISourceLayer>

type MinimalRundown = Pick<
	Rundown,
	| '_id'
	| 'name'
	| '_rank'
	| 'playlistId'
	| 'timing'
	| 'showStyleBaseId'
	| 'showStyleVariantId'
	| 'endOfRundownIsShowBreak'
>

export interface AdLibFetchAndFilterProps {
	uiSegments: Array<AdlibSegmentUi>
	liveSegment: AdlibSegmentUi | undefined
	sourceLayerLookup: SourceLayerLookup
	rundownBaselineAdLibs: Array<AdLibPieceUi>
}

function actionToAdLibPieceUi(
	action: AdLibAction | RundownBaselineAdLibAction,
	sourceLayers: _.Dictionary<ISourceLayer>,
	outputLayers: _.Dictionary<IOutputLayer>
): AdLibPieceUi {
	let sourceLayerId = ''
	let outputLayerId = ''
	let content: SomeContent = {}
	if (RundownUtils.isAdlibActionContent(action.display)) {
		sourceLayerId = action.display.sourceLayerId
		outputLayerId = action.display.outputLayerId
		content = {
			...action.display.content,
		}
	}

	return literal<AdLibPieceUi>({
		_id: protectString(`${action._id}`),
		name: translateMessage(action.display.label, i18nTranslator),
		status: PieceStatusCode.UNKNOWN,
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
		lifespan: PieceLifespan.WithinPart, // value doesn't matter
		uniquenessId: action.display.uniquenessId,
		expectedPackages: action.expectedPackages,
	})
}

interface IFetchAndFilterProps {
	playlist: Pick<RundownPlaylist, '_id' | 'currentPartInstanceId' | 'nextPartInstanceId' | 'previousPartInstanceId'>
	showStyleBase: Pick<ShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers'>
	filter?: RundownLayoutFilterBase
	includeGlobalAdLibs?: boolean
}

export function fetchAndFilter(props: IFetchAndFilterProps): AdLibFetchAndFilterProps {
	const sourceLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.sourceLayers, '_id')
	const outputLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.outputLayers, '_id')

	if (!props.playlist || !props.showStyleBase) {
		return {
			uiSegments: [],
			liveSegment: undefined,
			sourceLayerLookup,
			rundownBaselineAdLibs: [],
		}
	}

	const { segments, rundowns } = memoizedIsolatedAutorun(
		(playlist) => {
			const rundownsAndSegments = RundownPlaylistCollectionUtil.getRundownsAndSegments(playlist)
			const segments: DBSegment[] = []
			const rundowns: Record<string, MinimalRundown> = {}
			rundownsAndSegments.forEach((pair) => {
				segments.push(...pair.segments)
				rundowns[unprotectString(pair.rundown._id)] = pair.rundown
			})

			return {
				segments,
				rundowns,
			}
		},
		'rundownsAndSegments',
		props.playlist
	)

	const { uiSegments, liveSegment, uiPartSegmentMap, uiPartMap } = memoizedIsolatedAutorun(
		(
			currentPartInstanceId: PartInstanceId | null,
			nextPartInstanceId: PartInstanceId | null,
			segments: Segment[],
			rundowns: Record<string, MinimalRundown>
		) => {
			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				props.playlist
			)

			// This is a map of partIds mapped onto segments they are part of
			const uiPartSegmentMap = new Map<PartId, AdlibSegmentUi>()
			const uiPartMap = new Map<PartId, DBPart>()

			if (!segments) {
				return {
					uiSegments: [],
					liveSegment: undefined,
					uiPartSegmentMap,
					uiPartMap,
				}
			}

			const partInstances = RundownPlaylistCollectionUtil.getActivePartInstancesMap(props.playlist)

			let liveSegment: AdlibSegmentUi | undefined
			const uiSegmentMap = new Map<SegmentId, AdlibSegmentUi>()
			const uiSegments: Array<AdlibSegmentUi> = segments.map((segment) => {
				const segmentUi = literal<AdlibSegmentUi>({
					...segment,
					parts: [],
					pieces: [],
					isLive: false,
					isNext: false,
					isCompatibleShowStyle: currentPartInstance?.rundownId
						? rundowns[unprotectString(currentPartInstance.rundownId)].showStyleVariantId ===
						  rundowns[unprotectString(segment.rundownId)].showStyleVariantId
						: true,
				})

				uiSegmentMap.set(segmentUi._id, segmentUi)

				return segmentUi
			})

			RundownPlaylistCollectionUtil.getUnorderedParts(props.playlist, {
				segmentId: {
					$in: Array.from(uiSegmentMap.keys()),
				},
			}).forEach((part) => {
				const segment = uiSegmentMap.get(part.segmentId)
				if (segment) {
					const partInstance = findPartInstanceOrWrapToTemporary(partInstances, part)
					segment.parts.push(partInstance)

					uiPartSegmentMap.set(part._id, segment)
					uiPartMap.set(part._id, part)
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
				liveSegment,
				uiPartSegmentMap,
				uiPartMap,
			}
		},
		`uiSegments_${props.filter?._id || 'no_filter'}`,
		props.playlist.currentPartInstanceId,
		props.playlist.nextPartInstanceId,
		segments,
		rundowns
	)

	uiSegments.forEach((segment) => (segment.pieces.length = 0))

	if (props.filter === undefined || props.filter.rundownBaseline !== 'only') {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownIDs(props.playlist)
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
						disabled: !segment.isCompatibleShowStyle,
						sourceLayer: sourceLayerLookup[piece.sourceLayerId],
						outputLayer: outputLayerLookup[piece.outputLayerId],
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
				).map<{
					partId: PartId
					piece: AdLibPieceUi
				}>((action) => {
					return {
						partId: action.partId,
						piece: actionToAdLibPieceUi(action, sourceLayerLookup, outputLayerLookup),
					}
				}),
			'adLibActions',
			rundownIds,
			partIds
		)

		adlibActions.forEach((action) => {
			const segment = uiPartSegmentMap.get(action.partId)
			if (segment) {
				action.piece.disabled = !segment.isCompatibleShowStyle
				segment.pieces.push(action.piece)
			}
		})

		uiPartSegmentMap.forEach((segment) => {
			// Sort the pieces:
			segment.pieces = sortAdlibs(
				segment.pieces.map((piece) => ({
					adlib: piece,
					label: piece.adlibAction?.display?.label ?? piece.name,
					adlibRank: piece._rank,
					adlibId: piece._id,
					partRank: (piece.partId && uiPartMap.get(piece.partId))?._rank ?? null,
					segmentRank: segment._rank,
					rundownRank: 0, // not needed, bacause we are in just one rundown
				}))
			)
		})
	}

	let currentRundown: Rundown | undefined = undefined
	let rundownBaselineAdLibs: Array<AdLibPieceUi> = []
	if (
		props.filter &&
		props.includeGlobalAdLibs &&
		(props.filter.rundownBaseline === true || props.filter.rundownBaseline === 'only')
	) {
		const t = i18nTranslator

		const rundowns = RundownPlaylistCollectionUtil.getRundowns(props.playlist, undefined, {
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
					const rundownAdLibItems: Array<Omit<RundownBaselineAdLibItem, 'timelineObjectsString'>> =
						RundownBaselineAdLibPieces.find(
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
									status: PieceStatusCode.UNKNOWN,
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
									content: {},
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
								status: PieceStatusCode.UNKNOWN,
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
								content: {},
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
		uiSegments,
		liveSegment,
		sourceLayerLookup,
		rundownBaselineAdLibs,
	}
}

export function AdLibPanel({
	visible,
	playlist,
	showStyleBase,
	filter,
	selectedPiece,
	includeGlobalAdLibs,
	onSelectPiece,
}: IAdLibPanelProps): JSX.Element | null {
	const { t } = useTranslation()
	const studio = useTracker(
		() => RundownPlaylistCollectionUtil.getStudio(playlist as Pick<RundownPlaylist, '_id' | 'studioId'>),
		[playlist._id, playlist.studioId],
		undefined
	)

	const [searchFilter, setSearchFilter] = useState<string | undefined>(undefined)
	const [selectedSegment, setSelectedSegment] = useState<AdlibSegmentUi | undefined>(undefined)
	const shelfFollowsOnAir = getShelfFollowsOnAir()

	const { uiSegments, liveSegment, sourceLayerLookup, rundownBaselineAdLibs } = useTracker(
		() =>
			fetchAndFilter({
				playlist: playlist as Pick<
					RundownPlaylist,
					'_id' | 'studioId' | 'currentPartInstanceId' | 'nextPartInstanceId' | 'previousPartInstanceId'
				>,
				showStyleBase: showStyleBase as Pick<ShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers'>,
				filter,
				includeGlobalAdLibs,
			}),
		[
			playlist._id,
			playlist.studioId,
			playlist.currentPartInstanceId,
			playlist.nextPartInstanceId,
			playlist.previousPartInstanceId,
			showStyleBase._id,
			showStyleBase.sourceLayers,
			showStyleBase.outputLayers,
			filter,
			includeGlobalAdLibs,
		],
		{
			liveSegment: undefined,
			rundownBaselineAdLibs: [],
			sourceLayerLookup: {},
			uiSegments: [] as AdlibSegmentUi[],
		}
	)

	useEffect(() => {
		if (!shelfFollowsOnAir) return

		setSelectedSegment(liveSegment)
	}, [shelfFollowsOnAir, liveSegment])

	useEffect(() => {
		function onRevealInShelf(e: RevealInShelfEvent) {
			const { pieceId } = e
			let found = false
			if (pieceId) {
				const index = rundownBaselineAdLibs.findIndex((piece) => piece._id === pieceId)

				if (index >= 0) {
					found = true
				} else {
					uiSegments.forEach((segment) => {
						const index = segment.pieces.findIndex((piece) => piece._id === pieceId)
						if (index >= 0) {
							found = true
						}
					})
				}

				if (found) {
					RundownViewEventBus.emit(RundownViewEvents.SWITCH_SHELF_TAB, {
						tab: filter ? `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${filter._id}` : ShelfTabs.ADLIB,
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
		RundownViewEventBus.on(RundownViewEvents.REVEAL_IN_SHELF, onRevealInShelf)

		return () => {
			RundownViewEventBus.off(RundownViewEvents.REVEAL_IN_SHELF, onRevealInShelf)
		}
	}, [rundownBaselineAdLibs, uiSegments])

	const playlistId = playlist._id
	const currentPartInstanceId = playlist.currentPartInstanceId

	const onToggleAdLib = useCallback(
		(adlibPiece: IAdLibListItem, queue: boolean, e: KeyboardEvent, mode?: IBlueprintActionTriggerMode | undefined) => {
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
				sourceLayerLookup &&
				sourceLayerLookup[adlibPiece.sourceLayerId] &&
				!sourceLayerLookup[adlibPiece.sourceLayerId].isQueueable
			) {
				console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
				return
			}
			if (currentPartInstanceId) {
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(t, e, adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.executeAction(e, playlistId, action._id, action.actionId, action.userData, mode?.data)
					)
				} else if (!adlibPiece.isGlobal && !adlibPiece.isAction) {
					doUserAction(t, e, UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.segmentAdLibPieceStart(
							e,
							playlistId,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e) =>
						MeteorCall.userAction.baselineAdLibPieceStart(
							e,
							playlistId,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_STICKY_PIECE, (e) =>
						MeteorCall.userAction.sourceLayerStickyPieceStart(e, playlistId, adlibPiece.sourceLayerId)
					)
				}
			}
		},
		[t, playlistId, currentPartInstanceId, sourceLayerLookup]
	)

	function renderSegmentList() {
		return uiSegments.map((segment) => {
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
					onClick={() => setSelectedSegment(segment)}
					key={unprotectString(segment._id)}
					tabIndex={0}
				>
					{segment.name}
				</li>
			) : null
		})
	}

	if (!visible) {
		return null
	}
	if (!uiSegments || !playlist || !studio) {
		return <Spinner />
	}

	const withSegments = uiSegments.length > 30

	return (
		<div
			className="adlib-panel super-dark"
			data-tab-id={filter ? `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${filter._id}` : ShelfTabs.ADLIB}
		>
			{withSegments && <ul className="adlib-panel__segments">{renderSegmentList()}</ul>}
			<AdLibPanelToolbar onFilterChange={setSearchFilter} noSegments={!withSegments} searchFilter={searchFilter} />
			<AdLibListView
				uiSegments={uiSegments}
				rundownAdLibs={rundownBaselineAdLibs}
				onSelectAdLib={onSelectPiece}
				onToggleAdLib={onToggleAdLib}
				selectedPiece={selectedPiece}
				selectedSegment={selectedSegment}
				showStyleBase={showStyleBase}
				searchFilter={searchFilter}
				filter={filter as RundownLayoutFilter}
				playlist={playlist}
				studio={studio}
				noSegments={!withSegments}
			/>
		</div>
	)
}
