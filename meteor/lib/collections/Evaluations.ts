import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection, ProtectedString } from '../lib'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'
import { StudioId } from './Studios'
import { RundownPlaylistId } from './RundownPlaylists'
import { SnapshotId } from './Snapshots'
/** A string, identifying a Evaluation */
export type EvaluationId = ProtectedString<'EvaluationId'>

export interface Evaluation extends EvaluationBase {
	_id: EvaluationId
	userId: string
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

export const Evaluations: TransformedCollection<Evaluation, Evaluation> = createMongoCollection<Evaluation>(
	'evaluations'
)
registerCollection('Evaluations', Evaluations)

Meteor.startup(() => {
	if (Meteor.isServer) {
		Evaluations._ensureIndex({
			timestamp: 1,
		})
	}
})
