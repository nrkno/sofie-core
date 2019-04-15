import { getHash } from '../../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'

export function getRundownId (studio: Studio, externalId: string) {
	return getHash(`${studio._id}_${externalId}`)
}
export function getSegmentId (rundownId: string, segmentExternalId: string) {
	return getHash(`${rundownId}_segment_${segmentExternalId}`)
}
export function getPartId (rundownId: string, partExternalId: string) {
	return getHash(`${rundownId}_part_${partExternalId}`)
}
