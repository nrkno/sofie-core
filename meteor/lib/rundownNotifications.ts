import { RundownId, Rundowns } from './collections/Rundowns'
import { PartNote, TrackedNote } from './api/notes'
import { Segments, Segment } from './collections/Segments'
import { Parts } from './collections/Parts'
import { unprotectString, makePromise, waitForPromise, asyncCollectionFindOne } from './lib'
import * as _ from 'underscore'
import { Pieces } from './collections/Pieces'
import { ShowStyleBases, ShowStyleBase } from './collections/ShowStyleBases'
import { checkPieceContentStatus } from './mediaObjects'
import { Studios, Studio } from './collections/Studios'
import { RundownAPI } from './api/rundown'
import { IMediaObjectIssue } from './api/rundownNotifications'
import { getAllNotesForSegmentAndParts } from './collections/RundownPlaylists'

export function getSegmentPartNotes(rundownIds: RundownId[]): TrackedNote[] {
	const segments = Segments.find(
		{
			rundownId: {
				$in: rundownIds,
			},
		},
		{
			sort: { _rank: 1 },
			fields: {
				_id: 1,
				_rank: 1,
				notes: 1,
			},
		}
	).fetch()

	const parts = Parts.find(
		{
			rundownId: { $in: rundownIds },
			segmentId: { $in: segments.map((segment) => segment._id) },
		},
		{
			sort: { _rank: 1 },
			fields: {
				_id: 1,
				segmentId: 1,
				rundownId: 1,
				notes: 1,
				title: 1,
				invalidReason: 1,
			},
		}
	).fetch()

	return getAllNotesForSegmentAndParts(segments, parts)
}

export function getMediaObjectIssues(rundownIds: RundownId[]): IMediaObjectIssue[] {
	const rundowns = Rundowns.find({
		_id: {
			$in: rundownIds,
		},
	})

	const p = Promise.all(
		rundowns.map((rundown) =>
			makePromise(() => {
				let showStyle: ShowStyleBase | undefined
				let rundownStudio: Studio | undefined
				let segments: {
					[key: string]: Segment
				}

				const p: Promise<void>[] = []

				// p.push(asyncCollectionFindOne(ShowStyleBases, rundown.showStyleBaseId))
				p.push(
					makePromise(() => {
						showStyle = ShowStyleBases.findOne(rundown.showStyleBaseId)
					})
				)
				p.push(
					makePromise(() => {
						rundownStudio = Studios.findOne(rundown.studioId)
					})
				)
				p.push(
					makePromise(() => {
						segments = _.object(
							Segments.find({ rundownId: rundown._id })
								.fetch()
								.map((segment) => [segment._id, segment])
						)
					})
				)
				waitForPromise(Promise.all(p))

				if (showStyle && rundownStudio) {
					const showStyleBase = showStyle
					const studio = rundownStudio
					const pieceStatus = Pieces.find({
						rundownId: rundown._id,
					}).map((piece) => {
						// run these in parallel
						const sourceLayer = showStyleBase.sourceLayers.find((i) => i._id === piece.sourceLayerId)
						const part = Parts.findOne(piece.startPartId, {
							fields: {
								_rank: 1,
								segmentId: 1,
							},
						})
						const segment = part ? segments[unprotectString(part.segmentId)] : undefined
						if (segment && sourceLayer && part) {
							// we don't want this to be in a non-reactive context, so we manage this computation manually
							const { status, message } = checkPieceContentStatus(piece, sourceLayer, studio.settings)
							if (
								status !== RundownAPI.PieceStatusCode.OK &&
								status !== RundownAPI.PieceStatusCode.UNKNOWN &&
								status !== RundownAPI.PieceStatusCode.SOURCE_NOT_SET
							) {
								return {
									rundownId: part.rundownId,
									segmentId: segment._id,
									segmentRank: segment._rank,
									partId: part._id,
									partRank: part._rank,
									pieceId: piece._id,
									name: piece.name,
									status,
									message,
								}
							}
						}
						return undefined
					})
					return _.compact(pieceStatus)
				}
			})
		)
	)
	const allStatus = waitForPromise(p)

	return _.flatten(allStatus)
}
