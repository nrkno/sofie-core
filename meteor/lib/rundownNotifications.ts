import { DBRundown, RundownId, Rundowns } from './collections/Rundowns'
import { TrackedNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { Segments, DBSegment, SegmentOrphanedReason } from './collections/Segments'
import { Part, Parts } from './collections/Parts'
import { unprotectString, literal, generateTranslation, normalizeArrayToMap } from './lib'
import * as _ from 'underscore'
import { DBPartInstance, PartInstance, PartInstances } from './collections/PartInstances'
import { MongoFieldSpecifierOnes } from './typings/meteor'
import { RundownPlaylistCollectionUtil } from './collections/RundownPlaylists'
import { ITranslatableMessage, NoteSeverity } from '@sofie-automation/blueprints-integration'

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

	const sortedSegments = RundownPlaylistCollectionUtil._sortSegments(segments, rundowns)
	const sortedParts = RundownPlaylistCollectionUtil._sortPartsInner(parts, segments)

	return getAllNotesForSegmentAndParts(rundowns, sortedSegments, sortedParts, deletedPartInstances)
}

function getAllNotesForSegmentAndParts(
	rundowns: DBRundown[],
	segments: DBSegment[],
	parts: Part[],
	deletedPartInstances: PartInstance[]
): Array<TrackedNote> {
	const notes: Array<TrackedNote> = []

	const rundownsMap = normalizeArrayToMap(rundowns, '_id')
	const partsBySegment = _.groupBy(parts, (p) => p.segmentId)
	const partInstancesBySegment = _.groupBy(deletedPartInstances, (p) => p.segmentId)

	for (const segment of segments) {
		const segmentParts = partsBySegment[unprotectString(segment._id)] || []
		const partInstances = partInstancesBySegment[unprotectString(segment._id)] || []

		notes.push(
			...getBasicNotesForSegment(
				segment,
				rundownsMap.get(segment.rundownId)?.externalNRCSName ?? 'NRCS',
				segmentParts,
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

	if (segment.orphaned) {
		let message: ITranslatableMessage
		switch (segment.orphaned) {
			case SegmentOrphanedReason.DELETED:
				message = generateTranslation('Segment no longer exists in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
			case SegmentOrphanedReason.HIDDEN:
				message = generateTranslation('Segment was hidden in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
		}
		notes.push({
			type: NoteSeverity.WARNING,
			message,
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
				type: NoteSeverity.WARNING,
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
		const newNotes = part.notes?.slice() || []

		if (part.invalidReason) {
			newNotes.push({
				type: part.invalidReason.severity ?? NoteSeverity.ERROR,
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
