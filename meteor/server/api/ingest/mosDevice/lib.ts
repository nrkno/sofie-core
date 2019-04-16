import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Studio } from '../../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import { getRundownId, getPartId } from '../lib'
import { IngestPart } from 'tv-automation-sofie-blueprints-integration'

export function getMosRundownId (studio: Studio, mosId: MOS.MosString128) {
	if (!mosId) throw new Meteor.Error(401, 'parameter mosId missing!')
	return getRundownId(studio, mosId.toString())
}

export function getMosPartId (rundownId: string, partMosId: MOS.MosString128) {
	if (!partMosId) throw new Meteor.Error(401, 'parameter partMosId missing!')
	return getPartId(rundownId, partMosId.toString())
}

export function getSegmentExternalId (rundownId: MOS.MosString128, ingestPart: IngestPart) {
	// TODO - this is not unique enough. multiple segments could have the same name
	return `${rundownId.toString()}_${ingestPart.name.split(';')[0]}`
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
