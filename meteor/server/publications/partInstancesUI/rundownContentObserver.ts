import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistActivationId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	partInstanceFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
	StudioFields,
	studioFieldSpecifier,
	StudioSettingsDoc,
} from './reactiveContentCache'
import { PartInstances, RundownPlaylists, Segments, Studios } from '../../collections'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

function convertStudioSettingsDoc(doc: Pick<DBStudio, StudioFields>): StudioSettingsDoc {
	return {
		_id: doc._id,
		settings: applyAndValidateOverrides(doc.settingsWithOverrides).obj,
	}
}

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache

	constructor(
		studioId: StudioId,
		playlistActivationId: RundownPlaylistActivationId,
		rundownIds: RundownId[],
		cache: ContentCache
	) {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)
		this.#cache = cache

		this.#observers = [
			Studios.observe(
				{
					_id: studioId,
				},
				{
					added: (doc) => {
						const newDoc = convertStudioSettingsDoc(doc)
						cache.StudioSettings.upsert(doc._id, { $set: newDoc as Partial<Document> })
					},
					changed: (doc) => {
						const newDoc = convertStudioSettingsDoc(doc)
						cache.StudioSettings.upsert(doc._id, { $set: newDoc as Partial<Document> })
					},
					removed: (doc) => {
						cache.StudioSettings.remove(doc._id)
					},
				},
				{
					fields: studioFieldSpecifier,
				}
			),
			RundownPlaylists.observeChanges(
				{
					activationId: playlistActivationId,
				},
				cache.RundownPlaylists.link(),
				{
					fields: rundownPlaylistFieldSpecifier,
				}
			),
			Segments.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.Segments.link(),
				{
					projection: segmentFieldSpecifier,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					playlistActivationId,
					reset: { $ne: true },
				},
				cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
				}
			),
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
