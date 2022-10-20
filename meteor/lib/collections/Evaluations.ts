import { Time } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import {
	EvaluationId,
	StudioId,
	RundownPlaylistId,
	SnapshotId,
	OrganizationId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export interface Evaluation extends EvaluationBase {
	_id: EvaluationId
	organizationId: OrganizationId | null
	userId: UserId | null
	timestamp: Time
}
export interface EvaluationBase {
	studioId: StudioId
	playlistId: RundownPlaylistId
	answers: {
		[key: string]: string
	}
	snapshots?: Array<SnapshotId>
}

export const Evaluations = createMongoCollection<Evaluation>(CollectionName.Evaluations)

registerIndex(Evaluations, {
	organizationId: 1,
	timestamp: 1,
})
