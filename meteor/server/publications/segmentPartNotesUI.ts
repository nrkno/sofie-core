import {
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	TriggeredActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UISegmentPartNote } from '../../lib/api/rundownNotifications'
import { RundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Rundowns } from '../../lib/collections/Rundowns'
import { Complete, literal } from '../../lib/lib'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../lib/customPublication'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'
import { ShowStyleReadAccess } from '../security/showStyle'

interface UISegmentPartNotesArgs {
	readonly playlistId: RundownPlaylistId
}

type UISegmentPartNotesState = Record<string, never>

interface UISegmentPartNotesUpdateProps {
	rundownOrderChanged: boolean
	rundownChanged: RundownId[]
	invalidateSegmentPartNotes: TriggeredActionId[]
}

function compileMongoSelector(
	showStyleBaseId: ShowStyleBaseId | null,
	docIds?: readonly TriggeredActionId[]
): Mongo.Selector<DBSegmentPartNotes> {
	const selector: Mongo.Selector<DBSegmentPartNotes> = { showStyleBaseId: null }
	if (showStyleBaseId) {
		selector.showStyleBaseId = { $in: [null, showStyleBaseId] }
	}
	if (docIds) {
		selector._id = { $in: docIds as TriggeredActionId[] }
	}
	return selector
}

function convertDocument(doc: DBSegmentPartNotes): UISegmentPartNote {
	return literal<Complete<UISegmentPartNote>>({
		_id: doc._id,
		_rank: doc._rank,

		showStyleBaseId: doc.showStyleBaseId,
		name: doc.name,

		actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
		triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,
	})
}

type PlaylistFields = '_id' | 'rundownIdsInOrder'
const playlistFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PlaylistFields>>({
	_id: 1,
	rundownIdsInOrder: 1,
})

type RundownFields = '_id' | 'externalNRCSName'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	externalNRCSName: 1,
})

async function setupUISegmentPartNotesPublicationObservers(
	args: ReadonlyDeep<UISegmentPartNotesArgs>,
	triggerUpdate: TriggerUpdate<UISegmentPartNotesUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const trackRundownChange = (id: RundownId): Partial<UISegmentPartNotesUpdateProps> => ({
		rundownChanged: [id],
	})

	// Set up observers:
	return [
		RundownPlaylists.find(args.playlistId, { fields: playlistFieldSpecifier }).observe({
			added: () => triggerUpdate({ rundownOrderChanged: true }),
			changed: () => triggerUpdate({ rundownOrderChanged: true }),
			removed: () => triggerUpdate({ rundownOrderChanged: true }),
		}),
		Rundowns.find({ playlistId: args.playlistId }, { fields: rundownFieldSpecifier }).observe({
			added: (obj) => triggerUpdate(trackRundownChange(obj._id)),
			changed: (obj) => triggerUpdate(trackRundownChange(obj._id)),
			removed: (obj) => triggerUpdate(trackRundownChange(obj._id)),
		}),
		// TODO - reactive to parts and segments
	]
}
async function manipulateUISegmentPartNotesPublicationData(
	args: UISegmentPartNotesArgs,
	_state: Partial<UISegmentPartNotesState>,
	collection: CustomPublishCollection<UISegmentPartNote>,
	updateProps: Partial<ReadonlyDeep<UISegmentPartNotesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:
	/*
	if (!updateProps) {
		// First run
		const docs = await SegmentPartNotes.findFetchAsync(compileMongoSelector(args.showStyleBaseId))

		for (const doc of docs) {
			collection.insert(convertDocument(doc))
		}
	} else if (updateProps.invalidateSegmentPartNotes && updateProps.invalidateSegmentPartNotes.length > 0) {
		const changedIds = updateProps.invalidateSegmentPartNotes

		// Remove them from the state, so that we detect deletions
		for (const id of changedIds) {
			collection.remove(id)
		}

		const docs = await SegmentPartNotes.findFetchAsync(compileMongoSelector(args.showStyleBaseId, changedIds))
		for (const doc of docs) {
			collection.replace(convertDocument(doc))
		}
	}
	*/
}

meteorCustomPublish(
	PubSub.uiSegmentPartNotes,
	CustomCollectionName.UISegmentPartNotes,
	async function (pub, playlistId: RundownPlaylistId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			playlistId &&
			(!cred ||
				NoSecurityReadAccess.any() ||
				(await RundownPlaylistReadAccess.rundownPlaylistContent(playlistId, cred)))
		) {
			await setUpCollectionOptimizedObserver<
				UISegmentPartNote,
				UISegmentPartNotesArgs,
				UISegmentPartNotesState,
				UISegmentPartNotesUpdateProps
			>(
				`pub_${PubSub.uiSegmentPartNotes}_${playlistId}`,
				{ playlistId },
				setupUISegmentPartNotesPublicationObservers,
				manipulateUISegmentPartNotesPublicationData,
				pub
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UISegmentPartNotes}: Not allowed: "${playlistId}"`)
		}
	}
)
