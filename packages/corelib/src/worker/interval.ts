import { StudioId } from '../dataModel/Ids'

export enum IntervalJobs {}
// PartInstanceTimings = 'partInstanceTimings',

// export interface PartInstanceTimingsProps {
// 	playlistId: RundownPlaylistId
// 	partInstanceId: PartInstanceId
// }

/**
 * Set of valid functions, of form:
 * `id: (data) => return`
 */
export type IntervalJobFunc = {
	// [EventsJobs.PartInstanceTimings]: (data: PartInstanceTimingsProps) => void
}

export function getIntervalQueueName(id: StudioId): string {
	return `interval:${id}`
}
