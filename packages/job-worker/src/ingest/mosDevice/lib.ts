import { MOS } from '@sofie-automation/corelib'
import { IngestPart } from '@sofie-automation/blueprints-integration'
import { getPartId } from '../lib'
import { PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import _ = require('underscore')

export function getPartIdFromMosStory(rundownId: RundownId, partMosId: MOS.IMOSString128 | string): PartId {
	if (!partMosId) throw new Error('parameter partMosId missing!')
	return getPartId(rundownId, typeof partMosId === 'string' ? partMosId : parseMosString(partMosId))
}

export function getSegmentExternalId(rundownId: RundownId, ingestPart: IngestPart): string {
	return `${rundownId}_${ingestPart.name.split(';')[0]}_${ingestPart.externalId}`
}

export function fixIllegalObject(o: unknown): void {
	if (_.isArray(o)) {
		_.each(o, (val, _key) => {
			fixIllegalObject(val)
		})
	} else if (_.isObject(o)) {
		_.each(_.keys(o), (key: string) => {
			const val = o[key]
			if ((key + '').match(/^\$/)) {
				const newKey = key.replace(/^\$/, '@')
				o[newKey] = val
				delete o[key]
				key = newKey
			}
			fixIllegalObject(val)
		})
	}
}

const mosTypes = MOS.getMosTypes(false)
export function parseMosString(str: MOS.IMOSString128): string {
	if (!str) throw new Error('parseMosString: str parameter missing!')
	if (mosTypes.mosString128.is(str)) return mosTypes.mosString128.stringify(str)
	return (str as any).toString()
}
