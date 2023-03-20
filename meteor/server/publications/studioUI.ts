import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UIStudio } from '../../lib/api/studios'
import { DBStudio } from '../../lib/collections/Studios'
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
import { StudioReadAccess } from '../security/studio'
import { Studios } from '../collections'

interface UIStudioArgs {
	readonly studioId: StudioId | null
}

type UIStudioState = Record<string, never>

interface UIStudioUpdateProps {
	invalidateStudioIds: StudioId[]
}

function convertDocument(studio: Pick<DBStudio, StudioFields>): UIStudio {
	return literal<Complete<UIStudio>>({
		_id: studio._id,
		name: studio.name,
		mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,

		settings: studio.settings,

		routeSets: studio.routeSets,
		routeSetExclusivityGroups: studio.routeSetExclusivityGroups,
		packageContainers: studio.packageContainers,
		previewContainerIds: studio.previewContainerIds,
		thumbnailContainerIds: studio.thumbnailContainerIds,
	})
}

type StudioFields =
	| '_id'
	| 'name'
	| 'mappingsWithOverrides'
	| 'settings'
	| 'routeSets'
	| 'routeSetExclusivityGroups'
	| 'packageContainers'
	| 'previewContainerIds'
	| 'thumbnailContainerIds'
const fieldSpecifier = literal<IncludeAllMongoFieldSpecifier<StudioFields>>({
	_id: 1,
	name: 1,
	mappingsWithOverrides: 1,
	settings: 1,
	routeSets: 1,
	routeSetExclusivityGroups: 1,
	packageContainers: 1,
	previewContainerIds: 1,
	thumbnailContainerIds: 1,
})

async function setupUIStudioPublicationObservers(
	args: ReadonlyDeep<UIStudioArgs>,
	triggerUpdate: TriggerUpdate<UIStudioUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const trackChange = (id: StudioId): Partial<UIStudioUpdateProps> => ({
		invalidateStudioIds: [id],
	})

	// Set up observers:
	return [
		Studios.observeChanges(
			args.studioId ? args.studioId : {},
			{
				added: (id) => triggerUpdate(trackChange(id)),
				changed: (id) => triggerUpdate(trackChange(id)),
				removed: (id) => triggerUpdate(trackChange(id)),
			},
			{ fields: fieldSpecifier }
		),
	]
}
async function manipulateUIStudioPublicationData(
	args: UIStudioArgs,
	_state: Partial<UIStudioState>,
	collection: CustomPublishCollection<UIStudio>,
	updateProps: ReadonlyDeep<Partial<UIStudioUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (args.studioId) {
		// Operate on a single studio
		const studio = (await Studios.findOneAsync(args.studioId, { projection: fieldSpecifier })) as
			| Pick<DBStudio, StudioFields>
			| undefined

		if (studio) {
			collection.replace(convertDocument(studio))
		} else {
			collection.remove(args.studioId)
		}
	} else {
		if (!updateProps) {
			// First run
			const docs = (await Studios.findFetchAsync({}, { projection: fieldSpecifier })) as Array<
				Pick<DBStudio, StudioFields>
			>

			for (const doc of docs) {
				collection.insert(convertDocument(doc))
			}
		} else if (updateProps.invalidateStudioIds && updateProps.invalidateStudioIds.length > 0) {
			const changedIds = updateProps.invalidateStudioIds

			// Remove them from the state, so that we detect deletions
			for (const id of changedIds) {
				collection.remove(id)
			}

			const docs = await Studios.findFetchAsync({ _id: { $in: changedIds as StudioId[] } })
			for (const doc of docs) {
				collection.replace(convertDocument(doc))
			}
		}
	}
}

meteorCustomPublish(PubSub.uiStudio, CustomCollectionName.UIStudio, async function (pub, studioId: StudioId | null) {
	const cred = await resolveCredentials({ userId: this.userId, token: undefined })

	if (!cred || NoSecurityReadAccess.any() || (studioId && (await StudioReadAccess.studio(studioId, cred)))) {
		await setUpCollectionOptimizedObserver<UIStudio, UIStudioArgs, UIStudioState, UIStudioUpdateProps>(
			`pub_${PubSub.uiStudio}_${studioId}`,
			{ studioId },
			setupUIStudioPublicationObservers,
			manipulateUIStudioPublicationData,
			pub
		)
	} else {
		logger.warn(`Pub.${CustomCollectionName.UIStudio}: Not allowed: "${studioId}"`)
	}
})
