import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { UIPieceContentStatus } from '../../../lib/api/rundownNotifications'
import { Part } from '../../../lib/collections/Parts'
import { PieceStatusCode } from '../../../lib/collections/Pieces'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'
import { UIPieceContentStatuses } from '../Collections'
import { SegmentNoteCounts } from './withResolvedSegment'

export function getReactivePieceNoteCountsForPart(part: Part): SegmentNoteCounts {
	const counts: SegmentNoteCounts = {
		criticial: 0,
		warning: 0,
	}

	const mediaObjectStatuses = UIPieceContentStatuses.find(
		{
			rundownId: part.rundownId,
			partId: part._id,
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
					counts.criticial++
					break
				case PieceStatusCode.SOURCE_HAS_ISSUES:
				case PieceStatusCode.SOURCE_BROKEN:
				case PieceStatusCode.SOURCE_MISSING:
					counts.warning++
					break
				default:
					assertNever(obj.status.status)
					break
			}
		}
	}

	return counts
}
