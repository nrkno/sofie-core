import { SegmentOrphanedReason, Segment } from './collections/Segments'
import { Part } from './collections/Parts'
import { literal, generateTranslation, protectString } from './lib'
import { DBPartInstance } from './collections/PartInstances'
import { ITranslatableMessage, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { UISegmentPartNote } from './api/rundownNotifications'

export type SegmentForNotes = Pick<Segment, '_id' | '_rank' | 'rundownId' | 'name' | 'notes' | 'orphaned'>
export type PartForNotes = Pick<
	Part,
	'_id' | '_rank' | 'segmentId' | 'rundownId' | 'notes' | 'title' | 'invalid' | 'invalidReason'
>

export type BasicSegmentPartNote = Omit<UISegmentPartNote, 'playlistId' | 'rundownId' | 'segmentId'>

export function getBasicNotesForSegment(
	segment: SegmentForNotes,
	nrcsName: string,
	parts: PartForNotes[],
	partInstances: Pick<DBPartInstance, 'orphaned' | 'reset' | 'part'>[]
): Array<BasicSegmentPartNote> {
	const notes: Array<BasicSegmentPartNote> = []

	if (segment.notes) {
		notes.push(
			...segment.notes.map((note, i) =>
				literal<BasicSegmentPartNote>({
					_id: protectString(`${segment._id}_segment_${i}`),
					note: {
						rank: segment._rank,
						...note,
						origin: {
							...note.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
							name: note.origin.name || segment.name,
						},
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
			_id: protectString(`${segment._id}_segment_orphaned`),
			note: {
				type: NoteSeverity.WARNING,
				message,
				rank: segment._rank,
				origin: {
					segmentId: segment._id,
					rundownId: segment.rundownId,
					name: segment.name,
				},
			},
		})
	} else {
		const deletedPartInstances = partInstances.filter((p) => p.orphaned === 'deleted' && !p.reset)
		if (deletedPartInstances.length > 0) {
			notes.push({
				_id: protectString(`${segment._id}_partinstances_deleted`),
				note: {
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
				},
			})
		}
	}

	for (const part of parts) {
		const commonOrigin = {
			segmentId: part.segmentId,
			partId: part._id,
			rundownId: part.rundownId,
			segmentName: segment.name,
		}

		if (part.invalidReason) {
			notes.push({
				_id: protectString(`${segment._id}_part_${part._id}_invalid`),
				note: {
					type: part.invalidReason.severity ?? NoteSeverity.ERROR,
					message: part.invalidReason.message,
					rank: segment._rank,
					origin: {
						...commonOrigin,
						name: part.title,
					},
				},
			})
		}

		if (part.notes && part.notes.length > 0) {
			notes.push(
				...part.notes.map((n, i) =>
					literal<BasicSegmentPartNote>({
						_id: protectString(`${segment._id}_part_${part._id}_${i}`),
						note: {
							...n,
							rank: segment._rank,
							origin: {
								...n.origin,
								...commonOrigin,
								name: n.origin.name || part.title,
							},
						},
					})
				)
			)
		}
	}

	return notes
}
