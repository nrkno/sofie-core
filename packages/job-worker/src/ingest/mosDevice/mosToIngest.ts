import { MOS } from '@sofie-automation/corelib'
import { PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { normalizeArray, literal } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')
import { JobContext } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { LocalIngestPart, LocalIngestSegment } from '../ingestCache'
import { parseMosString, getPartIdFromMosStory, getSegmentExternalId } from './lib'

export interface AnnotatedIngestPart {
	externalId: string
	partId: PartId
	segmentName: string
	ingest: LocalIngestPart
}
export function storiesToIngestParts(
	context: JobContext,
	rundownId: RundownId,
	stories: MOS.IMOSStory[],
	undefinedPayload: boolean,
	existingIngestParts: AnnotatedIngestPart[]
): (AnnotatedIngestPart | null)[] {
	const span = context.startSpan('ingest.storiesToIngestParts')

	const existingIngestPartsMap = normalizeArray(existingIngestParts, 'externalId')

	const parts = stories.map((s, i) => {
		if (!s) return null

		const externalId = parseMosString(s.ID)
		const existingIngestPart = existingIngestPartsMap[externalId]

		const name = s.Slug ? parseMosString(s.Slug) : ''
		return {
			externalId: externalId,
			partId: getPartIdFromMosStory(rundownId, s.ID),
			segmentName: name.split(';')[0],
			ingest: literal<LocalIngestPart>({
				externalId: parseMosString(s.ID),
				name: name,
				rank: i,
				payload: undefinedPayload ? undefined : {},
				modified: existingIngestPart ? existingIngestPart.ingest.modified : getCurrentTime(),
			}),
		}
	})

	span?.end()
	return parts
}
/** Group IngestParts together into something that could be Segments */
export function groupIngestParts(parts: AnnotatedIngestPart[]): { name: string; parts: LocalIngestPart[] }[] {
	const groupedParts: { name: string; parts: LocalIngestPart[] }[] = []
	_.each(parts, (part) => {
		const lastSegment = _.last(groupedParts)
		if (lastSegment && lastSegment.name === part.segmentName) {
			lastSegment.parts.push(part.ingest)
		} else {
			groupedParts.push({ name: part.segmentName, parts: [part.ingest] })
		}
	})

	// Ensure ranks are correct
	_.each(groupedParts, (group) => {
		for (let i = 0; i < group.parts.length; i++) {
			group.parts[i].rank = i
		}
	})

	return groupedParts
}
export function groupedPartsToSegments(
	rundownId: RundownId,
	groupedParts: { name: string; parts: LocalIngestPart[] }[]
): LocalIngestSegment[] {
	return _.map(groupedParts, (grp, i) => {
		return literal<LocalIngestSegment>({
			externalId: getSegmentExternalId(rundownId, grp.parts[0]),
			name: grp.name,
			rank: i,
			parts: grp.parts,
			modified: Math.max(...grp.parts.map((p) => p.modified)), // pick the latest
		})
	})
}

/** Takes a list of ingestParts, modify it, then output them grouped together into ingestSegments, keeping track of the modified property */
export function makeChangeToIngestParts(
	context: JobContext,
	rundownId: RundownId,
	ingestParts: AnnotatedIngestPart[],
	modifyFunction: (ingestParts: AnnotatedIngestPart[]) => AnnotatedIngestPart[]
): LocalIngestSegment[] {
	const span = context.startSpan('mosDevice.ingest.makeChangeToIngestParts')

	// Before making the modification to ingestParts, create a list of segments from the original data, to use for calculating the
	// .modified property below.
	const referenceIngestSegments = groupPartsIntoIngestSegments(rundownId, ingestParts)

	const modifiedParts = modifyFunction(ingestParts)

	// Compare to reference, to make sure that ingestSegment.modified is updated in case of a change
	const newIngestSegments = groupPartsIntoIngestSegments(rundownId, modifiedParts)

	_.each(newIngestSegments, (ingestSegment) => {
		if (!ingestSegment.modified) {
			ingestSegment.modified = getCurrentTime()
		} else {
			const ref = referenceIngestSegments.find((s) => s.externalId === ingestSegment.externalId)
			if (ref) {
				if (ref.parts.length !== ingestSegment.parts.length) {
					// A part has been added, or removed
					ingestSegment.modified = getCurrentTime()
				} else {
					// No obvious change.
					// (If an individual part has been updated, the segment.modified property has already been updated anyway)
				}
			} else {
				// The reference doesn't exist (can happen for example if a segment has been merged, or split into two)
				ingestSegment.modified = getCurrentTime()
			}
		}
	})

	span?.end()
	return newIngestSegments
}
function groupPartsIntoIngestSegments(
	rundownId: RundownId,
	newIngestParts: AnnotatedIngestPart[]
): LocalIngestSegment[] {
	// Group the parts and make them into Segments:
	const newGroupedParts = groupIngestParts(newIngestParts)
	return groupedPartsToSegments(rundownId, newGroupedParts)
}
