import { useMemo } from 'react'
import { useSubscription, useSubscriptions, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../lib/api/pubsub'
import { getSegmentsWithPartInstances } from '../../../lib/Rundown'
import {
	AdLibActionId,
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	AdLibActions,
	AdLibPieces,
	PieceInstances,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
} from '../../collections'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ExpectedPackage } from '@sofie-automation/shared-lib/dist/package-manager/package'
import { PartInvalidReason } from '@sofie-automation/corelib/dist/dataModel/Part'
import { IBlueprintActionManifestDisplayContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PieceContentStatusObj } from '../../../lib/mediaObjects'
import { Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { UIPieceContentStatuses, UIShowStyleBases } from '../Collections'
import { isTranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../i18n'

export function MediaStatus({
	playlistIds,
	children,
	fallback,
}: {
	playlistIds: RundownPlaylistId[]
	children: (listItems: MediaStatusListItem[]) => JSX.Element | null
	fallback?: JSX.Element | null
}): JSX.Element | null {
	const { rundownIds, partIds, partInstanceIds, partInstanceMeta, partMeta, rundownMeta, showStyleBaseIds } =
		useRundownPlaylists(playlistIds)

	const pieceInstanceItems = usePieceInstanceItems(partInstanceIds, partInstanceMeta)
	const pieceItems = usePieceItems(partIds, partMeta)
	const adlibItems = useAdLibItems(partIds, partMeta)
	const adlibActionItems = useAdLibActionItems(partIds, partMeta)
	const rundownAdlibItems = useRundownAdLibItems(rundownIds, rundownMeta)
	const rundownAdlibActionItems = useRundownAdLibActionItems(rundownIds, rundownMeta)

	const allReady = useMediaStatusSubscriptions(playlistIds, rundownIds, showStyleBaseIds)

	const combinedList = useCombinedItems(
		pieceInstanceItems,
		pieceItems,
		adlibItems,
		adlibActionItems,
		rundownAdlibItems,
		rundownAdlibActionItems
	)

	if (!allReady && combinedList.length == 0) {
		return fallback ?? null
	}

	return children(combinedList)
}

function useCombinedItems(...items: (MediaStatusListItem | undefined)[][]): MediaStatusListItem[] {
	return useMemo(() => items.flat().filter(Boolean) as MediaStatusListItem[], items)
}

function useRundownPlaylists(playlistIds: RundownPlaylistId[]) {
	const playlistsWithContent = useTracker(
		() =>
			RundownPlaylists.find(
				{
					_id: {
						$in: playlistIds,
					},
				},
				{
					projection: {
						assignedAbSessions: 0,
						currentPartInfo: 0,
						holdState: 0,
						lastIncorrectPartPlaybackReported: 0,
						lastTakeTime: 0,
						metaData: 0,
						modified: 0,
						nextPartInfo: 0,
						nextSegmentId: 0,
						nextTimeOffset: 0,
						previousPartInfo: 0,
						previousPersistentState: 0,
						resetTime: 0,
						rundownsStartedPlayback: 0,
						trackedAbSessions: 0,
					},
				}
			)
				.fetch()
				.sort(sortRundownPlaylists)
				.map((playlist) => ({
					playlist,
					segments: getSegmentsWithPartInstances(
						playlist,
						undefined,
						undefined,
						undefined,
						{
							projection: {
								displayAs: 0,
								externalId: 0,
								externalModified: 0,
								metaData: 0,
								notes: 0,
								segmentTiming: 0,
								showShelf: 0,
							},
						},
						undefined,
						{
							projection: {
								timings: 0,
								partPlayoutTimings: 0,
							},
						}
					),
				})),
		[playlistIds],
		[]
	)

	const rundowns = useTracker(
		() =>
			Rundowns.find({
				playlistId: {
					$in: playlistIds,
				},
			}).fetch(),
		[playlistIds],
		[]
	)

	const { partInstanceIds, partIds, partInstanceMeta, partMeta } = useMemo(() => {
		const partInstanceIds: PartInstanceId[] = []
		const partIds: PartId[] = []
		const partInstanceMeta = new Map<PartInstanceId, PartMeta>()
		const partMeta = new Map<PartId, PartMeta>()
		playlistsWithContent.forEach(({ playlist, segments }, playlistRank) => {
			segments.forEach(({ segment, partInstances }, segmentRank) => {
				partInstances.forEach((partInstance, partInstanceRank) => {
					const rundown = rundowns.find((rundown) => rundown._id === segment.rundownId)
					if (partInstance.isTemporary) {
						partIds.push(partInstance.part._id)
						partMeta.set(partInstance.part._id, {
							playlistId: playlist._id,
							playlistName: playlist.name,
							rundownName: rundown?.name,
							showStyleBaseId: rundown?.showStyleBaseId,
							playlistRank,
							segmentRank,
							segmentIdentifier: segment.identifier,
							invalid: partInstance.part.invalid,
							invalidReason: partInstance.part.invalidReason,
							identifier: partInstance.part.identifier,
							rank: partInstanceRank,
						})
						return
					}

					partInstanceIds.push(partInstance._id)
					partInstanceMeta.set(partInstance._id, {
						playlistId: playlist._id,
						playlistName: playlist.name,
						rundownName: rundown?.name,
						showStyleBaseId: rundown?.showStyleBaseId,
						playlistRank,
						segmentRank,
						segmentIdentifier: segment.identifier,
						invalid: partInstance.part.invalid,
						invalidReason: partInstance.part.invalidReason,
						identifier: partInstance.part.identifier,
						rank: partInstanceRank,
					})
				})
			})
		})

		return {
			partInstanceIds,
			partIds,
			partInstanceMeta,
			partMeta,
		}
	}, [playlistsWithContent])

	const rundownIds = useMemo(() => rundowns.map((rundown) => rundown._id), [rundowns])
	const showStyleBaseIds = useMemo(
		() => Array.from(new Set(rundowns.map((rundown) => rundown.showStyleBaseId))),
		[rundowns]
	)

	const rundownMeta = useMemo(() => {
		const rundownMeta = new Map<RundownId, RundownMeta>()
		rundowns.forEach((rundown) => {
			const playlistIndex = playlistsWithContent.findIndex(
				(playlistWithContent) => playlistWithContent.playlist._id === rundown.playlistId
			)
			if (playlistIndex < 0) return
			const playlist = playlistsWithContent[playlistIndex].playlist
			const rank = playlist.rundownIdsInOrder.indexOf(rundown._id)

			rundownMeta.set(rundown._id, {
				playlistId: rundown.playlistId,
				playlistName: playlist.name,
				playlistRank: playlistIndex,
				rundownName: rundown.name,
				rank,
				showStyleBaseId: rundown.showStyleBaseId,
			})
		})

		return rundownMeta
	}, [rundowns, playlistsWithContent])

	return {
		rundownIds,
		partIds,
		partInstanceIds,
		partInstanceMeta,
		partMeta,
		rundownMeta,
		showStyleBaseIds,
	}
}

function useMediaStatusSubscriptions(
	playlistIds: RundownPlaylistId[],
	rundownIds: RundownId[],
	showStyleBaseIds: ShowStyleBaseId[]
): boolean {
	const readyStatus: boolean[] = []
	let counter = 0
	readyStatus[counter++] = useSubscription(PubSub.rundownPlaylists, {
		_id: {
			$in: playlistIds,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.rundowns, playlistIds, null)
	const uiShowStyleBaseSubArguments = useMemo(
		() => showStyleBaseIds.map((showStyleBaseId) => [showStyleBaseId] as [ShowStyleBaseId]),
		[showStyleBaseIds]
	)
	readyStatus[counter++] = useSubscriptions(PubSub.uiShowStyleBase, uiShowStyleBaseSubArguments)
	readyStatus[counter++] = useSubscription(PubSub.segments, {
		rundownId: {
			$in: rundownIds,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.parts, rundownIds)
	readyStatus[counter++] = useSubscription(PubSub.partInstancesSimple, {
		rundownId: {
			$in: rundownIds,
		},
		reset: {
			$ne: true,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.pieceInstancesSimple, {
		rundownId: {
			$in: rundownIds,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.pieces, {
		startRundownId: {
			$in: rundownIds,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.adLibActions, {
		rundownId: {
			$in: rundownIds,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.adLibPieces, {
		rundownId: {
			$in: rundownIds,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.rundownBaselineAdLibActions, {
		rundownId: {
			$in: rundownIds,
		},
	})
	readyStatus[counter++] = useSubscription(PubSub.rundownBaselineAdLibPieces, {
		rundownId: {
			$in: rundownIds,
		},
	})
	const uiPieceContentStatusesSubArguments = useMemo(
		() => playlistIds.map((playlistIds) => [playlistIds] as [RundownPlaylistId]),
		[playlistIds]
	)
	readyStatus[counter++] = useSubscriptions(PubSub.uiPieceContentStatuses, uiPieceContentStatusesSubArguments)

	return readyStatus.reduce((mem, current) => mem && current, true)
}

function useAdLibActionItems(partIds: PartId[], partMeta: Map<PartId, PartMeta>) {
	const adlibActions = useTracker(
		() =>
			AdLibActions.find({
				partId: {
					$in: partIds,
				},
				expectedPackages: {
					$exists: true,
				},
			})
				.fetch()
				.filter(onlyWithExpectedPackages),
		[partIds],
		[]
	)
	const adlibActionItems = useTracker(
		() =>
			adlibActions
				.map((adlibAction) => {
					const meta = partMeta.get(adlibAction.partId)
					if (!meta) return

					const adLibActionDisplay = adlibAction.display as Partial<IBlueprintActionManifestDisplayContent>

					return getListItemFromPieceAndPartMeta(
						adlibAction._id,
						{
							name: isTranslatableMessage(adlibAction.display.label)
								? translateMessage(adlibAction.display.label, i18nTranslator)
								: adlibAction.display.label,
							sourceLayerId: adLibActionDisplay.sourceLayerId,
							_rank: adlibAction.display._rank,
							content: adLibActionDisplay?.content,
						},
						meta,
						adlibAction.partId,
						undefined
					)
				})
				.filter(Boolean),
		[adlibActions, partMeta],
		[]
	)

	return adlibActionItems
}

function useAdLibItems(partIds: PartId[], partMeta: Map<PartId, PartMeta>) {
	const adlibs = useTracker(
		() =>
			AdLibPieces.find({
				partId: {
					$in: partIds,
				},
				expectedPackages: {
					$exists: true,
				},
			})
				.fetch()
				.filter(onlyWithExpectedPackages),
		[partIds],
		[]
	)
	const adlibItems = useTracker(
		() =>
			adlibs.map((adlib) => {
				if (!adlib.partId) return // this will never happen, since all AdLibPieces in this array will have it set
				const meta = partMeta.get(adlib.partId)

				if (!meta) return
				return getListItemFromPieceAndPartMeta(adlib._id, adlib, meta, adlib.partId, undefined)
			}),
		[adlibs, partMeta],
		[]
	)

	return adlibItems
}

function useRundownAdLibActionItems(rundownIds: RundownId[], rundownMeta: Map<RundownId, RundownMeta>) {
	const rundownAdlibActions = useTracker(
		() =>
			RundownBaselineAdLibActions.find({
				rundownId: {
					$in: rundownIds,
				},
				expectedPackages: {
					$exists: true,
				},
			})
				.fetch()
				.filter(onlyWithExpectedPackages),
		[rundownIds],
		[]
	)
	const rundownAdlibActionItems = useTracker(
		() =>
			rundownAdlibActions.map((adlibAction) => {
				const meta = rundownMeta.get(adlibAction.rundownId)
				if (!meta) return

				const adLibActionDisplay = adlibAction.display as Partial<IBlueprintActionManifestDisplayContent>

				return getListItemFromRundownPieceAndRundownMeta(
					adlibAction._id,
					{
						name: isTranslatableMessage(adlibAction.display.label)
							? translateMessage(adlibAction.display.label, i18nTranslator)
							: adlibAction.display.label,
						sourceLayerId: adLibActionDisplay.sourceLayerId,
						_rank: adlibAction.display._rank,
						content: adLibActionDisplay?.content,
					},
					meta
				)
			}),
		[rundownAdlibActions, rundownMeta],
		[]
	)

	return rundownAdlibActionItems
}

function useRundownAdLibItems(rundownIds: RundownId[], rundownMeta: Map<RundownId, RundownMeta>) {
	const rundownAdlibs = useTracker(
		() =>
			RundownBaselineAdLibPieces.find({
				rundownId: {
					$in: rundownIds,
				},
				expectedPackages: {
					$exists: true,
				},
			})
				.fetch()
				.filter(onlyWithExpectedPackages),
		[rundownIds],
		[]
	)
	const rundownAdlibItems = useTracker(
		() =>
			rundownAdlibs.map((adlib) => {
				const meta = rundownMeta.get(adlib.rundownId)
				if (!meta) return

				return getListItemFromRundownPieceAndRundownMeta(adlib._id, adlib, meta)
			}),
		[rundownAdlibs, rundownMeta],
		[]
	)

	return rundownAdlibItems
}

function usePieceItems(partIds: PartId[], partMeta: Map<PartId, PartMeta>) {
	const pieces = useTracker(
		() =>
			Pieces.find({
				startPartId: {
					$in: partIds,
				},
				expectedPackages: {
					$exists: true,
				},
			})
				.fetch()
				.filter(onlyWithExpectedPackages),
		[partIds],
		[]
	)
	const pieceItems = useTracker(
		() =>
			pieces.map((piece) => {
				const meta = partMeta.get(piece.startPartId)

				if (!meta) return
				return getListItemFromPieceAndPartMeta(piece._id, piece, meta, piece.startPartId, undefined)
			}),
		[pieces, partMeta],
		[]
	)
	return pieceItems
}

function usePieceInstanceItems(partInstanceIds: PartInstanceId[], partInstanceMeta: Map<PartInstanceId, PartMeta>) {
	const pieceInstances = useTracker(
		() =>
			PieceInstances.find({
				partInstanceId: {
					$in: partInstanceIds,
				},
				reset: {
					$ne: true,
				},
				adLibSourceId: {
					$exists: false,
				},
			})
				.fetch()
				.filter((pieceInstance) => onlyWithExpectedPackages(pieceInstance.piece)),
		[partInstanceIds],
		[]
	)
	const pieceInstanceItems = useTracker(
		() =>
			pieceInstances.map((pieceInstance) => {
				const meta = partInstanceMeta.get(pieceInstance.partInstanceId)

				if (!meta) return
				return getListItemFromPieceAndPartMeta(
					pieceInstance._id,
					pieceInstance.piece,
					meta,
					undefined,
					pieceInstance.partInstanceId
				)
			}),
		[pieceInstances, partInstanceMeta],
		[]
	)

	return pieceInstanceItems
}

function sortRundownPlaylists(a: DBRundownPlaylist, b: DBRundownPlaylist): number {
	return unprotectString(a._id).localeCompare(unprotectString(b._id))
}

interface PartMeta {
	playlistId: RundownPlaylistId
	playlistName: string
	playlistRank: number
	rundownName: string | undefined
	showStyleBaseId: ShowStyleBaseId | undefined
	segmentRank: number
	segmentIdentifier: string | undefined
	invalid: boolean | undefined
	invalidReason: PartInvalidReason | undefined
	rank: number
	identifier: string | undefined
}

interface RundownMeta {
	playlistId: RundownPlaylistId
	playlistName: string
	playlistRank: number
	rundownName: string | undefined
	showStyleBaseId: ShowStyleBaseId | undefined
	rank: number
}

export interface MediaStatusListItem {
	_id: ProtectedString<any>
	playlistId: RundownPlaylistId
	partId?: PartId
	partInstanceId?: PartInstanceId
	sourceLayerType: SourceLayerType | undefined
	sourceLayerName: string | undefined
	partIdentifier: string | undefined
	segmentIdentifier: string | undefined
	name: string
	duration: number | undefined
	playlistName: string
	playlistRank: number
	rundownName: string | undefined
	segmentRank: number | undefined
	partRank: number | undefined
	invalid: boolean
	rank: number
	status: PieceStatusCode
	pieceContentStatus: PieceContentStatusObj | undefined
}

function onlyWithExpectedPackages(obj: { expectedPackages?: ExpectedPackage.Any[] }) {
	return obj.expectedPackages && obj.expectedPackages.length > 0
}

function getListItemFromRundownPieceAndRundownMeta(
	objId: SomePieceId,
	piece: Pick<Piece, 'name'> &
		Partial<Pick<Piece, 'sourceLayerId' | 'content' | 'invalid'>> & { _rank?: number | undefined },
	meta: RundownMeta
): MediaStatusListItem | undefined {
	const showStyleBase = meta.showStyleBaseId && UIShowStyleBases.findOne(meta.showStyleBaseId)
	const sourceLayer = piece.sourceLayerId !== undefined ? showStyleBase?.sourceLayers?.[piece.sourceLayerId] : undefined

	if (sourceLayer && sourceLayer.isHidden) return

	const partIdentifier = undefined
	const segmentIdentifier = undefined
	const partRank = meta.rank
	const segmentRank = undefined
	const playlistName = meta.playlistName
	const playlistRank = meta.playlistRank
	const rundownName = meta.rundownName
	const playlistId = meta.playlistId

	const uiPieceContentStatus = UIPieceContentStatuses.findOne({
		pieceId: objId,
	})

	const name = piece.name
	const rank = piece._rank ?? 0 // if no rank (Pieces), should go to the top when "natural"-order sorting
	const invalid = piece.invalid ?? false
	const sourceLayerType = sourceLayer?.type
	const sourceLayerName = sourceLayer?.name
	const duration = piece.content?.sourceDuration
	const status = uiPieceContentStatus?.status.status ?? PieceStatusCode.UNKNOWN

	return literal<MediaStatusListItem>({
		_id: objId,
		playlistId,
		name,
		sourceLayerName,
		sourceLayerType,
		partIdentifier,
		segmentIdentifier,
		segmentRank,
		partRank,
		invalid,
		playlistName,
		rundownName,
		duration,
		playlistRank,
		rank,
		status,
		pieceContentStatus: uiPieceContentStatus?.status,
	})
}

/** This is a reactive function, depending on UIShowStyleBases and UIPieceContentStatuses */
function getListItemFromPieceAndPartMeta(
	objId: SomePieceId,
	piece: Pick<Piece, 'name'> &
		Partial<Pick<Piece, 'sourceLayerId' | 'content' | 'invalid'>> & { _rank?: number | undefined },
	meta: PartMeta,
	sourcePartId: PartId | undefined,
	sourcePartInstanceId: PartInstanceId | undefined
): MediaStatusListItem | undefined {
	const showStyleBase = meta.showStyleBaseId && UIShowStyleBases.findOne(meta.showStyleBaseId)
	const sourceLayer = piece.sourceLayerId !== undefined ? showStyleBase?.sourceLayers?.[piece.sourceLayerId] : undefined

	if (sourceLayer && sourceLayer.isHidden) return

	const partIdentifier = meta.identifier
	const segmentIdentifier = meta.segmentIdentifier
	const partRank = meta.rank
	const segmentRank = meta.segmentRank
	const playlistName = meta.playlistName
	const playlistRank = meta.playlistRank
	const rundownName = meta.rundownName
	const playlistId = meta.playlistId

	const uiPieceContentStatus = UIPieceContentStatuses.findOne({
		pieceId: objId,
	})

	const name = piece.name
	const rank = piece._rank ?? 0 // if no rank (Pieces), should go to the top when "natural"-order sorting
	const invalid = piece.invalid ?? false
	const sourceLayerType = sourceLayer?.type
	const sourceLayerName = sourceLayer?.abbreviation || sourceLayer?.name
	const duration = piece.content?.sourceDuration ?? uiPieceContentStatus?.status.contentDuration ?? undefined
	const status = uiPieceContentStatus?.status.status ?? PieceStatusCode.UNKNOWN

	return literal<MediaStatusListItem>({
		_id: objId,
		playlistId,
		partId: sourcePartId,
		partInstanceId: sourcePartInstanceId,
		name,
		sourceLayerName,
		sourceLayerType,
		partIdentifier,
		invalid,
		segmentIdentifier,
		segmentRank,
		partRank,
		playlistName,
		rundownName,
		duration,
		playlistRank,
		rank,
		status,
		pieceContentStatus: uiPieceContentStatus?.status,
	})
}

type SomePieceId = PieceId | AdLibActionId | RundownBaselineAdLibActionId | PieceInstanceId