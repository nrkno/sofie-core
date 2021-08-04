import { PartInstanceId, StudioId } from '../dataModel/Ids'

export enum EventsJobs {
	AdlibPieceStart = 'adLibPieceStart',
}

export interface AdlibPieceStartProps {
	partInstanceId: PartInstanceId
}
/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type EventsJobFunc = {
	[EventsJobs.AdlibPieceStart]: (data: AdlibPieceStartProps) => void
}

export function getEventsQueueName(id: StudioId): string {
	return `events:${id}`
}
