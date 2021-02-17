import { DBRundown, RundownId, Rundowns } from './collections/Rundowns'
import { NoteType, TrackedNote } from './api/notes'
import { Segments, Segment, DBSegment } from './collections/Segments'
import { Part, Parts } from './collections/Parts'
import { unprotectString, makePromise, waitForPromise, literal, generateTranslation, normalizeArrayToMap } from './lib'
import * as _ from 'underscore'
import { Pieces } from './collections/Pieces'
import { ShowStyleBases, ShowStyleBase } from './collections/ShowStyleBases'
import { checkPieceContentStatus } from './mediaObjects'
import { Studios, Studio } from './collections/Studios'
import { RundownAPI } from './api/rundown'
import { IMediaObjectIssue } from './api/rundownNotifications'
import { DBPartInstance, PartInstance, PartInstances } from './collections/PartInstances'
import { MongoFieldSpecifierOnes } from './typings/meteor'
import { RundownPlaylist, RundownPlaylists } from './collections/RundownPlaylists'

export function getSegmentPartNotes(rundownIds: RundownId[]): TrackedNote[] {
	const rundowns = Rundowns.find(
		{ _id: { $in: rundownIds } },
		{
			fields: {
				_id: 1,
				_rank: 1,
				name: 1,
				externalNRCSName: 1,
			},
		}
	).fetch()

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
				rundownId: 1,
				name: 1,
				notes: 1,
				orphaned: 1,
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
				_rank: 1,
				segmentId: 1,
				rundownId: 1,
				notes: 1,
				title: 1,
				invalid: 1,
				invalidReason: 1,
			},
		}
	).fetch()

	const deletedPartInstances = PartInstances.find(
		{
			rundownId: { $in: rundownIds },
			segmentId: { $in: segments.map((segment) => segment._id) },
			reset: { $ne: true },
			orphaned: 'deleted',
		},
		{
			fields: literal<MongoFieldSpecifierOnes<DBPartInstance>>({
				_id: 1,
				segmentId: 1,
				rundownId: 1,
				orphaned: 1,
				reset: 1,
				// @ts-ignore
				'part.title': 1,
			}),
		}
	).fetch()

	const sortedSegments = RundownPlaylist._sortSegments(segments, rundowns)
	const sortedParts = RundownPlaylist._sortPartsInner(parts, segments)

	return getAllNotesForSegmentAndParts(rundowns, sortedSegments, sortedParts, deletedPartInstances)
}

function getAllNotesForSegmentAndParts(
	rundowns: DBRundown[],
	segments: DBSegment[],
	parts: Part[],
	deletedPartInstances: PartInstance[]
): Array<TrackedNote> {
	let notes: Array<TrackedNote> = []

	const rundownsMap = normalizeArrayToMap(rundowns, '_id')
	const partsBySegment = _.groupBy(parts, (p) => p.segmentId)
	const partInstancesBySegment = _.groupBy(deletedPartInstances, (p) => p.segmentId)

	for (const segment of segments) {
		const parts = partsBySegment[unprotectString(segment._id)] || []
		const partInstances = partInstancesBySegment[unprotectString(segment._id)] || []

		notes.push(
			...getBasicNotesForSegment(
				segment,
				rundownsMap.get(segment.rundownId)?.externalNRCSName ?? 'NRCS',
				parts,
				partInstances
			)
		)
	}

	return notes
}

export function getBasicNotesForSegment(
	segment: DBSegment,
	nrcsName: string,
	parts: Part[],
	partInstances: Pick<DBPartInstance, 'orphaned' | 'reset' | 'part'>[]
): Array<TrackedNote> {
	const notes: Array<TrackedNote> = []

	if (segment.notes) {
		notes.push(
			...segment.notes.map((note) =>
				literal<TrackedNote>({
					...note,
					rank: segment._rank,
					origin: {
						...note.origin,
						segmentId: segment._id,
						rundownId: segment.rundownId,
						name: note.origin.name || segment.name,
					},
				})
			)
		)
	}

	if (segment.orphaned === 'deleted') {
		notes.push({
			type: NoteType.WARNING,
			message: generateTranslation('Segment no longer exists in {{nrcs}}', {
				nrcs: nrcsName,
			}),
			rank: segment._rank,
			origin: {
				segmentId: segment._id,
				rundownId: segment.rundownId,
				name: segment.name,
			},
		})
	} else {
		const deletedPartInstances = partInstances.filter((p) => p.orphaned === 'deleted' && !p.reset)
		if (deletedPartInstances.length > 0) {
			notes.push({
				type: NoteType.WARNING,
				message: generateTranslation('The following parts no longer exist in {{nrcs}}: {{partNames}}', {
					nrcs: nrcsName,
					partNames: deletedPartInstances.map((p) => p.part.title).join(', '),
				}),
				rank: segment._rank,
				origin: {
					segmentId: segment._id,
					rundownId: segment.rundownId,
					name: segment.name,
				},
			})
		}
	}

	for (const part of parts) {
		const newNotes = part.notes || []

		if (part.invalidReason) {
			newNotes.push({
				type: NoteType.ERROR,
				message: part.invalidReason.message,
				origin: {
					name: part.title,
				},
			})
		}

		if (newNotes.length > 0) {
			notes.push(
				...newNotes.map((n) => ({
					...n,
					rank: segment._rank,
					origin: {
						...n.origin,
						segmentId: part.segmentId,
						partId: part._id,
						rundownId: part.rundownId,
						segmentName: segment.name,
						name: n.origin.name || part.title,
					},
				}))
			)
		}
	}

	return notes
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
						startRundownId: rundown._id,
					}).map((piece) => {
						// run these in parallel
						const sourceLayer = showStyleBase.sourceLayers.find((i) => i._id === piece.sourceLayerId)
						const part = Parts.findOne(piece.startPartId, {
							fields: {
								_rank: 1,
								title: 1,
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
									segmentName: segment.name,
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
