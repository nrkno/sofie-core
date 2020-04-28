import { RundownId, Rundowns } from './collections/Rundowns'
import { PartNote } from './api/notes'
import { Segments } from './collections/Segments'
import { Parts } from './collections/Parts'
import { unprotectString, makePromise, waitForPromise } from './lib'
import * as _ from 'underscore'
import { Pieces } from './collections/Pieces'
import { ShowStyleBases, ShowStyleBase } from './collections/ShowStyleBases'
import { checkPieceContentStatus } from './mediaObjects'
import { Studios, Studio } from './collections/Studios'
import { RundownAPI } from './api/rundown'
import { IMediaObjectIssue } from './api/rundownNotifications'

export function getSegmentPartNotes (rRundownIds: RundownId[]): (PartNote & { rank: number; })[] {
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

export function getMediaObjectIssues (rundownId: RundownId): IMediaObjectIssue[] {
	const rundown = Rundowns.findOne(rundownId)

	if (rundown) {
		let showStyle: ShowStyleBase | undefined
		let rundownStudio: Studio | undefined

		const p: Promise<void>[] = []
		p.push(makePromise(() => { showStyle = ShowStyleBases.findOne(rundown.showStyleBaseId) }))
		p.push(makePromise(() => { rundownStudio = Studios.findOne(rundown.studioId) }))
		waitForPromise(Promise.all(p))

		if (showStyle && rundownStudio) {
			const showStyleBase = showStyle
			const studio = rundownStudio
			const pieceStatus = Pieces.find({
				rundownId: rundown._id
			}).map((piece) => { // run these in parallel
				const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
				const part = Parts.findOne(piece.partId, {
					fields: {
						_rank: 1
					}
				})
				const segment = part ? Segments.findOne(part.segmentId, {
					fields: {
						_rank: 1
					}
				}) : undefined
				if (segment && sourceLayer && part) {
					// we don't want this to be in a non-reactive context, so we manage this computation manually
					const { status, message } = checkPieceContentStatus(piece, sourceLayer, studio.settings)
					if ((status !== RundownAPI.PieceStatusCode.OK) && (status !== RundownAPI.PieceStatusCode.UNKNOWN) && (status !== RundownAPI.PieceStatusCode.SOURCE_NOT_SET)) {
						return {
							pieceId: piece._id,
							name: piece.name,
							status,
							message
						}
					}
				}
				return undefined
			})
			return _.compact(pieceStatus)
		}
	}
	return []
}
