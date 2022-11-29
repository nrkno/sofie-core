import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { DBTriggeredActions, TriggeredActions, UITriggeredActionsObj } from '../../lib/collections/TriggeredActions'
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
import { ShowStyleReadAccess } from '../security/showStyle'

interface UITriggeredActionsArgs {
	readonly showStyleBaseId: ShowStyleBaseId | null
}

type UITriggeredActionsState = Record<string, never>

interface UITriggeredActionsUpdateProps {
	invalidateTriggeredActions: TriggeredActionId[]
}

function compileMongoSelector(
	showStyleBaseId: ShowStyleBaseId | null,
	docIds?: readonly TriggeredActionId[]
): Mongo.Selector<DBTriggeredActions> {
	const selector: Mongo.Selector<DBTriggeredActions> = { showStyleBaseId: null }
	if (showStyleBaseId) {
		selector.showStyleBaseId = { $in: [null, showStyleBaseId] }
	}
	if (docIds) {
		selector._id = { $in: docIds as TriggeredActionId[] }
	}
	return selector
}

function convertDocument(doc: DBTriggeredActions): UITriggeredActionsObj {
	return literal<Complete<UITriggeredActionsObj>>({
		_id: doc._id,
		_rank: doc._rank,

		showStyleBaseId: doc.showStyleBaseId,
		name: doc.name,

		actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
		triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,
	})
}

async function setupUITriggeredActionsPublicationObservers(
	args: ReadonlyDeep<UITriggeredActionsArgs>,
	triggerUpdate: TriggerUpdate<UITriggeredActionsUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const trackChange = (id: TriggeredActionId): Partial<UITriggeredActionsUpdateProps> => ({
		invalidateTriggeredActions: [id],
	})

	// Set up observers:
	return [
		TriggeredActions.find(compileMongoSelector(args.showStyleBaseId)).observeChanges({
			added: (id) => triggerUpdate(trackChange(id)),
			changed: (id) => triggerUpdate(trackChange(id)),
			removed: (id) => triggerUpdate(trackChange(id)),
		}),
	]
}
async function manipulateUITriggeredActionsPublicationData(
	args: UITriggeredActionsArgs,
	_state: Partial<UITriggeredActionsState>,
	collection: CustomPublishCollection<UITriggeredActionsObj>,
	updateProps: Partial<ReadonlyDeep<UITriggeredActionsUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (!updateProps) {
		// First run
		const docs = await TriggeredActions.findFetchAsync(compileMongoSelector(args.showStyleBaseId))

		for (const doc of docs) {
			collection.insert(convertDocument(doc))
		}
	} else if (updateProps.invalidateTriggeredActions && updateProps.invalidateTriggeredActions.length > 0) {
		const changedIds = updateProps.invalidateTriggeredActions

		// Remove them from the state, so that we detect deletions
		for (const id of changedIds) {
			collection.remove(id)
		}

		const docs = await TriggeredActions.findFetchAsync(compileMongoSelector(args.showStyleBaseId, changedIds))
		for (const doc of docs) {
			collection.replace(convertDocument(doc))
		}
	}
}

meteorCustomPublish(
	PubSub.uiTriggeredActions,
	CustomCollectionName.UITriggeredActions,
	async function (pub, showStyleBaseId: ShowStyleBaseId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(showStyleBaseId && (await ShowStyleReadAccess.showStyleBase({ _id: showStyleBaseId }, cred)))
		) {
			await setUpCollectionOptimizedObserver<
				UITriggeredActionsObj,
				UITriggeredActionsArgs,
				UITriggeredActionsState,
				UITriggeredActionsUpdateProps
			>(
				`pub_${PubSub.uiTriggeredActions}_${showStyleBaseId}`,
				{ showStyleBaseId },
				setupUITriggeredActionsPublicationObservers,
				manipulateUITriggeredActionsPublicationData,
				pub
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UITriggeredActions}: Not allowed: "${showStyleBaseId}"`)
		}
	}
)
