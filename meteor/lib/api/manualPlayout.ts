import { StudioId } from '../collections/Studios'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'

export interface NewManualPlayoutAPI {
	insertTimelineObject(studioId: StudioId, timelineObject: TimelineObjectCoreExt): Promise<void>
	removeTimelineObject(studioId: StudioId, id: string): Promise<void>
}

export enum ManualPlayoutAPIMethods {
	'insertTimelineObject' = 'manualPlayout.insertTimelineObject',
	'removeTimelineObject' = 'manualPlayout.removeTimelineObject',
}
