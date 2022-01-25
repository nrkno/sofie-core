import { StudioId } from '../collections/Studios'

export interface NewPlayoutAPI {
	updateStudioBaseline(studioId: StudioId): Promise<string | false>
	shouldUpdateStudioBaseline(studioId: StudioId): Promise<string | false>
}

export enum PlayoutAPIMethods {
	'updateStudioBaseline' = 'playout.updateStudioBaseline',
	'shouldUpdateStudioBaseline' = 'playout.shouldUpdateStudioBaseline',
}
