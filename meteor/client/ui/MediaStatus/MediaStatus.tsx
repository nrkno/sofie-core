import React, { useMemo } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../lib/api/pubsub'
import { getSegmentsWithPartInstances } from '../../../lib/Rundown'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export function MediaStatus({
	className,
	playlistIds,
}: {
	className?: string
	playlistIds: RundownPlaylistId[]
}): JSX.Element {
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
		[],
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

	const rundownIds = useMemo(() => rundowns.map((rundown) => rundown._id), [rundowns])
	const showStyleBaseIds = useMemo(
		() => Array.from(new Set(rundowns.map((rundown) => rundown.showStyleBaseId))),
		[rundowns]
	)

	// TODO Rework this. All we need is a list of PartIds and RundownIds. Fetch the individual content types
	// in separate trackers so that there's less revalidation, if one of the object changes
	const pieces = useTracker(
		() =>
			playlistsWithContent.map(({ segments, playlist }, index) => ({
				playlist: playlist,
				playlistRank: index,
				partInstances: segments
					.map((segment, segmentIndex) =>
						segment.partInstances.map((partInstance, partInstanceIndex) => ({
							partId: partInstance.part._id,
							partInstanceRank: partInstanceIndex,
							segmentRank: segmentIndex,
							pieceInstances: PieceInstances.find({
								playlistActivationId: playlist.activationId,
								partInstanceId: partInstance._id,
								reset: {
									$ne: true,
								},
								adLibSourceId: {
									$exists: false,
								},
							})
								.fetch()
								.filter(
									(pieceInstance) =>
										pieceInstance.piece.expectedPackages && pieceInstance.piece.expectedPackages.length > 0
								),
							pieces: Pieces.find({
								startPartId: partInstance.part._id,
								expectedPackages: {
									$exists: true,
								},
							})
								.fetch()
								.filter((piece) => piece.expectedPackages && piece.expectedPackages.length > 0),
							adlibs: AdLibPieces.find({
								partId: partInstance.part._id,
							})
								.fetch()
								.filter((piece) => piece.expectedPackages && piece.expectedPackages.length > 0),
							adlibActions: AdLibActions.find({
								partId: partInstance.part._id,
							})
								.fetch()
								.filter((adlibAction) => adlibAction.expectedPackages && adlibAction.expectedPackages.length > 0),
						}))
					)
					.flat(),
				adlibs: RundownBaselineAdLibPieces.find({
					rundownId: {
						$in: [], // TODO somehow get the list of rundowns for this playlist,
					},
				}),
				adlibActions: RundownBaselineAdLibActions.find({
					rundownId: {
						$in: [], // TODO somehow get the list of rundowns for this playlist,
					},
				}),
			})),
		[playlistsWithContent],
		[]
	)

	useSubscription(PubSub.rundownPlaylists, {
		_id: {
			$in: playlistIds,
		},
	})
	useSubscription(PubSub.rundowns, playlistIds, null)
	useSubscription(PubSub.segments, {
		rundownId: {
			$in: rundownIds,
		},
	})
	useSubscription(PubSub.parts, rundownIds)
	useSubscription(PubSub.partInstancesSimple, {
		rundownId: {
			$in: rundownIds,
		},
		reset: {
			$ne: true,
		},
	})
	useSubscription(PubSub.pieceInstancesSimple, {
		rundownId: {
			$in: rundownIds,
		},
	})
	useSubscription(PubSub.pieces, {
		startRundownId: {
			$in: rundownIds,
		},
	})
	useSubscription(PubSub.showStyleBases, {
		_id: {
			$in: showStyleBaseIds,
		},
	})

	return <div className={className}></div>
}

function sortRundownPlaylists(a: DBRundownPlaylist, b: DBRundownPlaylist): number {
	return unprotectString(a._id).localeCompare(unprotectString(b._id))
}
