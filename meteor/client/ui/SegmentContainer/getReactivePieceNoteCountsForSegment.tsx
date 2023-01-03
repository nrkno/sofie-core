import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { UIPieceContentStatus, UISegmentPartNote } from '../../../lib/api/rundownNotifications'
import { PieceStatusCode } from '../../../lib/collections/Pieces'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'
import { UIPieceContentStatuses, UISegmentPartNotes } from '../Collections'
import { SegmentNoteCounts, SegmentUi } from './withResolvedSegment'

export function getReactivePieceNoteCountsForSegment(segment: SegmentUi): SegmentNoteCounts {
	const segmentNoteCounts: SegmentNoteCounts = {
		criticial: 0,
		warning: 0,
	}

	const rawNotes = UISegmentPartNotes.find({ segmentId: segment._id }, { fields: { note: 1 } }).fetch() as Pick<
		UISegmentPartNote,
		'note'
	>[]
	for (const note of rawNotes) {
		if (note.note.type === NoteSeverity.ERROR) {
			segmentNoteCounts.criticial++
		} else if (note.note.type === NoteSeverity.WARNING) {
			segmentNoteCounts.warning++
		}
	}

	const mediaObjectStatuses = UIPieceContentStatuses.find(
		{
			rundownId: segment.rundownId,
			segmentId: segment._id,
		},
		{
			fields: literal<MongoFieldSpecifierOnes<UIPieceContentStatus>>({
				_id: 1,
				// @ts-expect-error deep property
				'status.status': 1,
			}),
		}
	).fetch() as Array<Pick<UIPieceContentStatus, '_id'> & { status: Pick<UIPieceContentStatus['status'], 'status'> }>

	if (!getIgnorePieceContentStatus()) {
		for (const obj of mediaObjectStatuses) {
			switch (obj.status.status) {
				case PieceStatusCode.OK:
				case PieceStatusCode.UNKNOWN:
					// Ignore
					break
				case PieceStatusCode.SOURCE_NOT_SET:
					segmentNoteCounts.criticial++
					break
				case PieceStatusCode.SOURCE_HAS_ISSUES:
				case PieceStatusCode.SOURCE_BROKEN:
				case PieceStatusCode.SOURCE_MISSING:
					segmentNoteCounts.warning++
					break
				default:
					assertNever(obj.status.status)
					break
			}
		}
	}

	return segmentNoteCounts
}
