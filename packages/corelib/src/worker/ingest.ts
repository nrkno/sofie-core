import { RundownId } from '../dataModel/Ids'
import * as MOS from 'mos-connection'

export enum IngestJobs {
	MosFullStory = 'mosFullStory',
}

export interface IngestPropsBase {
	rundownId: RundownId
}
export interface IngestMosFullStoryProps extends IngestPropsBase {
	story: MOS.IMOSROFullStory
}

/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type IngestJobFunc = {
	[IngestJobs.MosFullStory]: (data: IngestMosFullStoryProps) => void
}

export function getIngestQueueName(id: RundownId): string {
	return `rundown:${id}`
}
