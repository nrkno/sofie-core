import { Meteor } from 'meteor/meteor'
import { ProtectedString, registerCollection, Time } from '../lib'
import { TransformedCollection, UserId } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { OrganizationId } from './Organization'
import { RundownPlaylistId } from './RundownPlaylists'
import { SnapshotId } from './Snapshots'
import { StudioId } from './Studios'

/** A string, identifying a Evaluation */
export type EvaluationId = ProtectedString<'EvaluationId'>

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

export const Evaluations: TransformedCollection<Evaluation, Evaluation> = createMongoCollection<Evaluation>(
	'evaluations'
)
registerCollection('Evaluations', Evaluations)

Meteor.startup(() => {
	if (Meteor.isServer) {
		Evaluations._ensureIndex({
			organizationId: 1,
			timestamp: 1,
		})
	}
})
