import { PeripheralDeviceId } from '../dataModel/Ids'
import * as MOS from 'mos-connection'

export enum IngestJobs {
	MosFullStory = 'mosFullStory',
	MosDeleteStory = 'mosDeleteStory',
}

export interface IngestPropsBase {
	rundownExternalId: string
	peripheralDeviceId: PeripheralDeviceId | null
}
export interface IngestMosFullStoryProps extends IngestPropsBase {
	story: MOS.IMOSROFullStory
}
export interface IngestMosDeleteStoryProps extends IngestPropsBase {
	stories: Array<MOS.MosString128>
}

/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type IngestJobFunc = {
	[IngestJobs.MosFullStory]: (data: IngestMosFullStoryProps) => void
	[IngestJobs.MosDeleteStory]: (data: IngestMosDeleteStoryProps) => void
}

export function getIngestQueueName(externalId: string): string {
	return `rundown:${externalId}`
}
