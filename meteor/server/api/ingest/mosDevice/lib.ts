import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Studio } from '../../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import { getRundownId, getPartId, getRundown } from '../lib'
import { IngestPart } from 'tv-automation-sofie-blueprints-integration'

export function getRundownIdFromMosRO (studio: Studio, runningOrderMosId: MOS.MosString128) {
	if (!runningOrderMosId) throw new Meteor.Error(401, 'parameter runningOrderMosId missing!')
	return getRundownId(studio, runningOrderMosId.toString())
}

export function getRundownFromMosRO (studio: Studio, runningOrderMosId: MOS.MosString128) {
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)
	return getRundown(rundownId, runningOrderMosId.toString())
}

export function getPartIdFromMosStory (rundownId: string, partMosId: MOS.MosString128) {
	if (!partMosId) throw new Meteor.Error(401, 'parameter partMosId missing!')
	return getPartId(rundownId, partMosId.toString())
}

export function getSegmentExternalId (rundownId: string, ingestPart: IngestPart, rank: number) {
	return `${rundownId}_${ingestPart.name.split(';')[0]}_${rank}`
}

export function fixIllegalObject (o: any) {
	if (_.isArray(o)) {
		_.each(o, (val, key) => {
			fixIllegalObject(val)
		})
	} else if (_.isObject(o)) {
		_.each(_.keys(o), (key: string) => {
			let val = o[key]
			if ((key + '').match(/^\$/)) {
				let newKey = key.replace(/^\$/,'@')
				o[newKey] = val
				delete o[key]
				key = newKey
			}
			fixIllegalObject(val)
		})
	}
}
