import { RundownId } from './collections/Rundowns'
import { PartNote } from './api/notes'
import { Segments } from './collections/Segments'
import { Parts } from './collections/Parts'
import { unprotectString } from './lib'
import * as _ from 'underscore'
import { RundownPlaylistId } from './collections/RundownPlaylists'

export function getSegmentPartNotes (rRundownIds: RundownId[]) {
	let notes: Array<PartNote & {rank: number}> = []
	const segments = Segments.find({
		rundownId: {
			$in: rRundownIds
		}
	}, {
		sort: { _rank: 1 },
		fields: {
			_id: 1,
			_rank: 1,
			notes: 1
		}
	}).fetch()

	const segmentNotes = _.object(segments.map(segment => [ segment._id, {
		rank: segment._rank,
		notes: segment.notes
	} ])) as { [key: string ]: { notes: PartNote[], rank: number } }
	Parts.find({
		rundownId: { $in: rRundownIds },
		segmentId: { $in: segments.map(segment => segment._id) }
	}, {
		sort: { _rank: 1 },
		fields: {
			segmentId: 1,
			notes: 1
		}
	}).map(part => {
		if (part.notes) {
			const sn = segmentNotes[unprotectString(part.segmentId)]
			if (sn) {
				return sn.notes.concat(part.notes)
			}
		}
	})
	notes = notes.concat(_.flatten(_.map(_.values(segmentNotes), (o) => {
		return o.notes.map(note => _.extend(note, {
			rank: o.rank
		}))
	})))

	return notes
}

export function getMediaObjectIssues (playlistId: RundownPlaylistId) {
	
}