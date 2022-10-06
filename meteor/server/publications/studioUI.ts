import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UIStudio } from '../../lib/api/studios'
import { DBStudio, Studios } from '../../lib/collections/Studios'
import { Complete, literal } from '../../lib/lib'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { StudioReadAccess } from '../security/studio'

interface UIStudioArgs {
	readonly studioId: StudioId | null
}

interface UIStudioState {
	cachedStudios: Map<StudioId, UIStudio>
}

interface UIStudioUpdateProps {
	invalidateStudioIds: StudioId[]
}

function trackChange(id: StudioId): Partial<UIStudioUpdateProps> {
	return {
		invalidateStudioIds: [id],
	}
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
	// Set up observers:
	return [
		Studios.find(args.studioId ? args.studioId : {}, { fields: fieldSpecifier }).observe({
			added: (e) => triggerUpdate(trackChange(e._id)),
			changed: (e) => triggerUpdate(trackChange(e._id)),
			removed: (e) => triggerUpdate(trackChange(e._id)),
		}),
	]
}
async function manipulateUIStudioPublicationData(
	args: UIStudioArgs,
	state: Partial<UIStudioState>,
	updateProps: ReadonlyDeep<Partial<UIStudioUpdateProps>> | undefined
): Promise<UIStudio[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	if (args.studioId) {
		// Operate on a single studio
		const studio = (await Studios.findOneAsync(args.studioId, { projection: fieldSpecifier })) as
			| Pick<DBStudio, StudioFields>
			| undefined
		if (!studio) return []

		return [convertDocument(studio)]
	} else {
		if (!state.cachedStudios) state.cachedStudios = new Map()

		if (!updateProps) {
			// First run
			const docs = (await Studios.findFetchAsync({}, { projection: fieldSpecifier })) as Array<
				Pick<DBStudio, StudioFields>
			>

			for (const doc of docs) {
				state.cachedStudios.set(doc._id, convertDocument(doc))
			}
		} else if (updateProps.invalidateStudioIds && updateProps.invalidateStudioIds.length > 0) {
			const changedIds = updateProps.invalidateStudioIds

			// Remove them from the state, so that we detect deletions
			for (const id of changedIds) {
				state.cachedStudios.delete(id)
			}

			const docs = await Studios.findFetchAsync({ _id: { $in: changedIds as StudioId[] } })
			for (const doc of docs) {
				state.cachedStudios.set(doc._id, convertDocument(doc))
			}
		}

		// TODO - it would be nice to optimise this by telling the optimizedobserver which docs may have changed, rather than letting it diff them all

		return Array.from(state.cachedStudios.values())
	}
}

meteorCustomPublishArray(
	PubSub.uiStudio,
	CustomCollectionName.UIStudio,
	async function (pub, studioId: StudioId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (!cred || NoSecurityReadAccess.any() || (studioId && (await StudioReadAccess.studio(studioId, cred)))) {
			const observer = await setUpOptimizedObserver<UIStudio, UIStudioArgs, UIStudioState, UIStudioUpdateProps>(
				`pub_${PubSub.uiStudio}_${studioId}`,
				{ studioId },
				setupUIStudioPublicationObservers,
				manipulateUIStudioPublicationData,
				(_args, newData) => {
					pub.updatedDocs(newData)
				}
			)
			pub.onStop(() => {
				observer.stop()
			})
		} else {
			logger.warn(`Pub.${CustomCollectionName.UIStudio}: Not allowed: "${studioId}"`)
		}
	}
)
