import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'

/** These are temorary mutation functions as spreadsheet gateway does not use the ingest types yet */
export function mutateRundown (rundown: any): IngestRundown {
	let ingestRundown: IngestRundown

	if (rundown.externalId) {
		ingestRundown = rundown // looks like it already is an IngestRundown
	} else {
		ingestRundown = {
			externalId: rundown.id,
			name: rundown.name,
			type: 'external',
			payload: _.omit(rundown, 'sections'),
			segments: _.values(rundown.sections || {}).map(mutateSegment)
		}
	}
	if (!ingestRundown.externalId) throw new Meteor.Error(400, `ingestRundown.externalId missing`)
	if (!ingestRundown.name) throw new Meteor.Error(400, `ingestRundown.name missing`)
	check(ingestRundown.externalId, String)
	check(ingestRundown.name, String)

	return ingestRundown
}
export function mutateSegment (segment: any): IngestSegment {
	let ingestSegment: IngestSegment

	if (segment.externalId) {
		ingestSegment = segment // looks like it already is an IngestSegment
	} else {
		ingestSegment = {
			externalId: segment.id,
			name: segment.name,
			rank: segment.rank,
			payload: _.omit(segment, 'stories'),
			parts: _.values(segment.stories || {}).map(mutatePart)
		}
	}
	if (!ingestSegment.externalId) throw new Meteor.Error(400, `ingestSegment.externalId missing`)
	if (!ingestSegment.name) throw new Meteor.Error(400, `ingestSegment.name missing`)
	check(ingestSegment.externalId, String)
	check(ingestSegment.name, String)

	return ingestSegment
}
export function mutatePart (part: any): IngestPart {
	let ingestPart: IngestPart

	if (part.externalId) {
		ingestPart = part // looks like it already is an IngestPart
	} else {
		ingestPart = {
			externalId: part.id,
			name: part.name,
			rank: part.rank,
			payload: part
		}
	}
	if (!ingestPart.externalId) throw new Meteor.Error(400, `ingestPart.externalId missing`)
	if (!ingestPart.name) throw new Meteor.Error(400, `ingestPart.name missing`)
	check(ingestPart.externalId, String)
	check(ingestPart.name, String)

	return ingestPart
}
