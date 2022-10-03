import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { DBTriggeredActions, TriggeredActions, UITriggeredActionsObj } from '../../lib/collections/TriggeredActions'
import { Complete, literal } from '../../lib/lib'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { ShowStyleReadAccess } from '../security/showStyle'

interface UITriggeredActionsArgs {
	readonly showStyleBaseId: ShowStyleBaseId | null
}

interface UITriggeredActionsState {
	cachedTriggeredActions: Map<TriggeredActionId, UITriggeredActionsObj>
}

interface UITriggeredActionsUpdateProps {
	invalidateTriggeredActions: TriggeredActionId[]
}

function getMongoSelector(
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

function trackChange(id: TriggeredActionId): Partial<UITriggeredActionsUpdateProps> {
	return {
		invalidateTriggeredActions: [id],
	}
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
	// Set up observers:
	return [
		TriggeredActions.find(getMongoSelector(args.showStyleBaseId)).observe({
			added: (obj) => triggerUpdate(trackChange(obj._id)),
			changed: (obj) => triggerUpdate(trackChange(obj._id)),
			removed: (obj) => triggerUpdate(trackChange(obj._id)),
		}),
	]
}
async function manipulateUITriggeredActionsPublicationData(
	args: UITriggeredActionsArgs,
	state: Partial<UITriggeredActionsState>,
	updateProps: Partial<ReadonlyDeep<UITriggeredActionsUpdateProps>> | undefined
): Promise<UITriggeredActionsObj[] | null> {
	// Prepare data for publication:

	if (!state.cachedTriggeredActions) state.cachedTriggeredActions = new Map()

	if (!updateProps) {
		// First run
		const docs = await TriggeredActions.findFetchAsync(getMongoSelector(args.showStyleBaseId))

		for (const doc of docs) {
			state.cachedTriggeredActions.set(doc._id, convertDocument(doc))
		}
	} else if (updateProps.invalidateTriggeredActions && updateProps.invalidateTriggeredActions.length > 0) {
		const changedIds = updateProps.invalidateTriggeredActions

		// Remove them from the state, so that we detect deletions
		for (const id of changedIds) {
			state.cachedTriggeredActions.delete(id)
		}

		const docs = await TriggeredActions.findFetchAsync(getMongoSelector(args.showStyleBaseId, changedIds))
		for (const doc of docs) {
			state.cachedTriggeredActions.set(doc._id, convertDocument(doc))
		}
	}

	// TODO - it would be nice to optimise this by telling the optimizedobserver which docs may have changed, rather than letting it diff them all

	return Array.from(state.cachedTriggeredActions.values())
}

meteorCustomPublishArray(
	PubSub.uiTriggeredActions,
	CustomCollectionName.UITriggeredActions,
	async function (pub, showStyleBaseId: ShowStyleBaseId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(showStyleBaseId && (await ShowStyleReadAccess.showStyleBase({ _id: showStyleBaseId }, cred)))
		) {
			const observer = await setUpOptimizedObserver<
				UITriggeredActionsObj,
				UITriggeredActionsArgs,
				UITriggeredActionsState,
				UITriggeredActionsUpdateProps
			>(
				`pub_${PubSub.uiTriggeredActions}_${showStyleBaseId}`,
				{ showStyleBaseId },
				setupUITriggeredActionsPublicationObservers,
				manipulateUITriggeredActionsPublicationData,
				(_args, newData) => {
					pub.updatedDocs(newData)
				}
			)
			pub.onStop(() => {
				observer.stop()
			})
		} else {
			logger.warn(`Pub.${CustomCollectionName.UITriggeredActions}: Not allowed: "${showStyleBaseId}"`)
		}
	}
)
