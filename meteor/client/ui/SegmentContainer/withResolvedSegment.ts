import * as React from 'react'
import * as _ from 'underscore'
import { ISourceLayer, NoteSeverity, PieceLifespan } from '@sofie-automation/blueprints-integration'
import {
	RundownPlaylist,
	RundownPlaylistCollectionUtil,
	RundownPlaylistId,
} from '../../../lib/collections/RundownPlaylists'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Segments, SegmentId } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import {
	IOutputLayerExtended,
	ISourceLayerExtended,
	PieceExtended,
	PartExtended,
	SegmentExtended,
} from '../../../lib/Rundown'
import { IContextMenuContext } from '../RundownView'
import { ShowStyleBase, ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { equalSets } from '../../../lib/lib'
import { RundownUtils } from '../../lib/rundown'
import { Rundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { PartId, Part } from '../../../lib/collections/Parts'
import { memoizedIsolatedAutorun, slowDownReactivity } from '../../lib/reactiveData/reactiveDataHelper'
import { ScanInfoForPackages } from '../../../lib/mediaObjects'
import { getBasicNotesForSegment } from '../../../lib/rundownNotifications'
import { getIsFilterActive } from '../../lib/rundownLayouts'
import { RundownViewLayout } from '../../../lib/collections/RundownLayouts'
import { getMinimumReactivePieceNotesForPart } from './getMinimumReactivePieceNotesForPart'
import { SegmentViewMode } from './SegmentViewModes'
import { SegmentNote, TrackedNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { AdlibSegmentUi } from '../../lib/shelf'

export interface SegmentUi extends SegmentExtended {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerUi
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerUi
	}
}
export type PartUi = PartExtended
export interface IOutputLayerUi extends IOutputLayerExtended {
	/** Is output layer group collapsed */
	collapsed?: boolean
}
export type ISourceLayerUi = ISourceLayerExtended
export interface PieceUi extends PieceExtended {
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
	/** Metadata object */
	contentMetaData?: any
	contentPackageInfos?: ScanInfoForPackages
	message?: string | null
}

export type MinimalRundown = Pick<Rundown, '_id' | 'name' | 'timing' | 'showStyleBaseId' | 'endOfRundownIsShowBreak'>

export const FREEZE_FRAME_FLASH = 5000

export interface IProps {
	// id: string
	rundownId: RundownId
	segmentId: SegmentId
	segmentsIdsBefore: Set<SegmentId>
	rundownIdsBefore: RundownId[]
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>
	studio: Studio
	showStyleBase: ShowStyleBase
	playlist: RundownPlaylist
	rundown: MinimalRundown
	timeScale: number
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onSegmentScroll?: () => void
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
	onSwitchViewMode: (newViewMode: SegmentViewMode) => void
	followLiveSegments: boolean
	segmentRef?: (el: React.ComponentClass, sId: string) => void
	isLastSegment: boolean
	ownCurrentPartInstance: PartInstance | undefined
	ownNextPartInstance: PartInstance | undefined
	adLibSegmentUi?: AdlibSegmentUi
	isFollowingOnAirSegment: boolean
	rundownViewLayout: RundownViewLayout | undefined
	countdownToSegmentRequireLayers: string[] | undefined
	fixedSegmentDuration: boolean | undefined
	studioMode: boolean
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
}

export interface ITrackedProps {
	segmentui: SegmentUi | undefined
	parts: Array<PartUi>
	segmentNotes: Array<SegmentNote>
	hasRemoteItems: boolean
	hasGuestItems: boolean
	hasAlreadyPlayed: boolean
	lastValidPartIndex: number | undefined
	budgetDuration: number | undefined
	displayLiveLineCounter: boolean
	showCountdownToSegment: boolean
}

type IWrappedComponent<IProps, IState, TrackedProps> =
	| React.ComponentClass<IProps & TrackedProps, IState>
	| ((props: IProps & TrackedProps) => JSX.Element | null)

export function withResolvedSegment<T extends IProps, IState = {}>(
	WrappedComponent: IWrappedComponent<T, IState, ITrackedProps>
) {
	return withTracker<T, IState, ITrackedProps>(
		(props: T) => {
			const segment = Segments.findOne(props.segmentId) as SegmentUi | undefined

			// We need the segment to do anything
			if (!segment) {
				return {
					segmentui: undefined,
					parts: [],
					segmentNotes: [],
					hasRemoteItems: false,
					hasGuestItems: false,
					hasAlreadyPlayed: false,
					lastValidPartIndex: undefined,
					budgetDuration: undefined,
					displayLiveLineCounter: true,
					showCountdownToSegment: true,
				}
			}

			const rundownNrcsName = Rundowns.findOne(segment.rundownId, {
				fields: { externalNRCSName: 1 },
			})?.externalNRCSName

			// This registers a reactive dependency on infinites-capping pieces, so that the segment can be
			// re-evaluated when a piece like that appears.
			PieceInstances.find({
				rundownId: segment.rundownId,
				dynamicallyInserted: {
					$exists: true,
				},
				'infinite.fromPreviousPart': false,
				'piece.lifespan': {
					$in: [
						PieceLifespan.OutOnRundownEnd,
						PieceLifespan.OutOnRundownChange,
						PieceLifespan.OutOnShowStyleEnd,
					],
				},
				reset: {
					$ne: true,
				},
			}).fetch()

			const [orderedAllPartIds, { currentPartInstance, nextPartInstance }] = slowDownReactivity(
				() =>
					[
						memoizedIsolatedAutorun(
							(_playlistId: RundownPlaylistId) =>
								(
									RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(
										props.playlist,
										undefined,
										undefined,
										undefined,
										{
											fields: { _id: 1 },
										}
									).parts as Pick<Part, '_id' | 'segmentId' | '_rank'>[]
								).map((part) => part._id),
							'playlist.getAllOrderedParts',
							props.playlist._id
						),
						memoizedIsolatedAutorun(
							(_playlistId: RundownPlaylistId, _currentPartInstanceId, _nextPartInstanceId) =>
								RundownPlaylistCollectionUtil.getSelectedPartInstances(props.playlist),
							'playlist.getSelectedPartInstances',
							props.playlist._id,
							props.playlist.currentPartInstanceId,
							props.playlist.nextPartInstanceId
						),
					] as [
						PartId[],
						{ currentPartInstance: PartInstance | undefined; nextPartInstance: PartInstance | undefined }
					],
				// if the rundown isn't active, run the changes ASAP, we don't care if there's going to be jank
				// if this is the current or next segment (will have those two properties defined), run the changes ASAP,
				// otherwise, trigger the updates in a window of 500-2500 ms from change
				props.playlist.activationId === undefined || props.ownCurrentPartInstance || props.ownNextPartInstance
					? 0
					: props.isFollowingOnAirSegment
					? 150
					: Math.random() * 2000 + 500
			)

			const rundownOrder = RundownPlaylistCollectionUtil.getRundownOrderedIDs(props.playlist)
			const rundownIndex = rundownOrder.indexOf(segment.rundownId)

			const o = RundownUtils.getResolvedSegment(
				props.showStyleBase,
				props.playlist,
				props.rundown,
				segment,
				props.segmentsIdsBefore,
				rundownOrder.slice(0, rundownIndex),
				props.rundownsToShowstyles,
				orderedAllPartIds,
				currentPartInstance,
				nextPartInstance,
				true,
				true
			)

			if (props.rundownViewLayout && o.segmentExtended) {
				if (props.rundownViewLayout.visibleSourceLayers) {
					const visibleSourceLayers = props.rundownViewLayout.visibleSourceLayers
					Object.entries(o.segmentExtended.sourceLayers).forEach(([id, sourceLayer]) => {
						sourceLayer.isHidden = !visibleSourceLayers.includes(id)
					})
				}
				if (props.rundownViewLayout.visibleOutputLayers) {
					const visibleOutputLayers = props.rundownViewLayout.visibleOutputLayers
					Object.entries(o.segmentExtended.outputLayers).forEach(([id, outputLayer]) => {
						outputLayer.used = visibleOutputLayers.includes(id)
					})
				}
			}

			const notes: TrackedNote[] = getBasicNotesForSegment(
				segment,
				rundownNrcsName ?? 'NRCS',
				o.parts.map((p) => p.instance.part),
				o.parts.map((p) => p.instance)
			)
			o.parts.forEach((part) => {
				notes.push(
					...getMinimumReactivePieceNotesForPart(props.studio, props.showStyleBase, part.instance.part).map(
						(note): TrackedNote => ({
							...note,
							rank: segment._rank,
							origin: {
								...note.origin,
								partId: part.partId,
								rundownId: segment.rundownId,
								segmentId: segment._id,
								segmentName: segment.name,
							},
						})
					)
				)
			})

			let lastValidPartIndex = o.parts.length - 1

			for (let i = lastValidPartIndex; i > 0; i--) {
				if (o.parts[i].instance.part.invalid) {
					lastValidPartIndex = i - 1
				} else {
					break
				}
			}

			let budgetDuration: number | undefined
			for (const part of o.parts) {
				if (part.instance.part.budgetDuration !== undefined) {
					budgetDuration = (budgetDuration ?? 0) + part.instance.part.budgetDuration
				}
			}

			let displayLiveLineCounter: boolean = true
			if (props.rundownViewLayout && props.rundownViewLayout.liveLineProps?.requiredLayerIds) {
				const { active } = getIsFilterActive(
					props.playlist,
					props.showStyleBase,
					props.rundownViewLayout.liveLineProps
				)
				displayLiveLineCounter = active
			}

			let showCountdownToSegment = true
			if (props.countdownToSegmentRequireLayers?.length) {
				const sourcelayersInSegment = o.parts
					.map((pa) => pa.pieces.map((pi) => pi.sourceLayer?._id))
					.flat()
					.filter((s) => !!s) as string[]
				showCountdownToSegment = props.countdownToSegmentRequireLayers.some((s) =>
					sourcelayersInSegment.includes(s)
				)
			}

			return {
				segmentui: o.segmentExtended,
				parts: o.parts,
				segmentNotes: notes,
				hasAlreadyPlayed: o.hasAlreadyPlayed,
				hasRemoteItems: o.hasRemoteItems,
				hasGuestItems: o.hasGuestItems,
				lastValidPartIndex,
				budgetDuration,
				displayLiveLineCounter,
				showCountdownToSegment,
			}
		},
		(data: ITrackedProps, props: IProps, nextProps: IProps): boolean => {
			// This is a potentailly very dangerous hook into the React component lifecycle. Re-use with caution.
			// Check obvious primitive changes
			if (
				props.followLiveSegments !== nextProps.followLiveSegments ||
				props.onContextMenu !== nextProps.onContextMenu ||
				props.onSegmentScroll !== nextProps.onSegmentScroll ||
				props.segmentId !== nextProps.segmentId ||
				props.segmentRef !== nextProps.segmentRef ||
				props.timeScale !== nextProps.timeScale ||
				props.isFollowingOnAirSegment !== nextProps.isFollowingOnAirSegment ||
				props.ownCurrentPartInstance !== nextProps.ownCurrentPartInstance ||
				props.ownNextPartInstance !== nextProps.ownNextPartInstance ||
				!equalSets(props.segmentsIdsBefore, nextProps.segmentsIdsBefore) ||
				!_.isEqual(props.countdownToSegmentRequireLayers, nextProps.countdownToSegmentRequireLayers) ||
				props.rundownViewLayout !== nextProps.rundownViewLayout ||
				props.fixedSegmentDuration !== nextProps.fixedSegmentDuration ||
				!_.isEqual(props.adLibSegmentUi?.pieces, nextProps.adLibSegmentUi?.pieces) ||
				props.adLibSegmentUi?.showShelf !== nextProps.adLibSegmentUi?.showShelf
			) {
				return true
			}
			// Check RundownViewLayout changes that are important to the segment
			if (
				!_.isEqual(
					props.rundownViewLayout?.visibleSourceLayers,
					nextProps.rundownViewLayout?.visibleSourceLayers
				) ||
				!_.isEqual(
					props.rundownViewLayout?.visibleOutputLayers,
					nextProps.rundownViewLayout?.visibleOutputLayers
				) ||
				!_.isEqual(props.rundownViewLayout?.liveLineProps, nextProps.rundownViewLayout?.liveLineProps)
			) {
				return true
			}
			const findNextOrCurrentPart = (parts: PartUi[]) => {
				return (
					parts.find(
						(i) =>
							i.instance._id === props.playlist.currentPartInstanceId ||
							i.instance._id === nextProps.playlist.currentPartInstanceId
					) ||
					parts.find(
						(i) =>
							i.instance._id === props.playlist.nextPartInstanceId ||
							i.instance._id === nextProps.playlist.nextPartInstanceId
					)
				)
			}
			// Check rundown changes that are important to the segment
			if (
				typeof props.playlist !== typeof nextProps.playlist ||
				(props.playlist.nextSegmentId !== nextProps.playlist.nextSegmentId &&
					(props.playlist.nextSegmentId === props.segmentId ||
						nextProps.playlist.nextSegmentId === props.segmentId)) ||
				((props.playlist.currentPartInstanceId !== nextProps.playlist.currentPartInstanceId ||
					props.playlist.nextPartInstanceId !== nextProps.playlist.nextPartInstanceId) &&
					data.parts &&
					findNextOrCurrentPart(data.parts)) ||
				props.playlist.holdState !== nextProps.playlist.holdState ||
				props.playlist.nextTimeOffset !== nextProps.playlist.nextTimeOffset ||
				props.playlist.activationId !== nextProps.playlist.activationId ||
				PlaylistTiming.getExpectedStart(props.playlist.timing) !==
					PlaylistTiming.getExpectedStart(nextProps.playlist.timing) ||
				props.ownCurrentPartInstance !== nextProps.ownCurrentPartInstance ||
				props.ownNextPartInstance !== nextProps.ownNextPartInstance
			) {
				return true
			}
			// Check studio installation changes that are important to the segment.
			// We also could investigate just skipping this and requiring a full reload if the studio installation is changed
			if (
				typeof props.studio !== typeof nextProps.studio ||
				!_.isEqual(props.studio.settings, nextProps.studio.settings) ||
				!_.isEqual(props.showStyleBase.sourceLayers, nextProps.showStyleBase.sourceLayers) ||
				!_.isEqual(props.showStyleBase.outputLayers, nextProps.showStyleBase.outputLayers)
			) {
				return true
			}

			return false
		},
		true
	)(WrappedComponent)
}
