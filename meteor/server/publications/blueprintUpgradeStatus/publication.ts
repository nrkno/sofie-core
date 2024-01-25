import { BlueprintId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, MeteorPubSub } from '../../../lib/api/pubsub'
import { ProtectedString, protectString } from '../../../lib/lib'
import {
	CustomPublish,
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { resolveCredentials } from '../../security/lib/credentials'
import { NoSecurityReadAccess } from '../../security/noSecurity'
import { LiveQueryHandle } from '../../lib/lib'
import { ContentCache, createReactiveContentCache, ShowStyleBaseFields, StudioFields } from './reactiveContentCache'
import { UpgradesContentObserver } from './upgradesContentObserver'
import { BlueprintMapEntry, checkDocUpgradeStatus } from './checkStatus'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { UIBlueprintUpgradeStatus, UIBlueprintUpgradeStatusId } from '../../../lib/api/upgradeStatus'

type BlueprintUpgradeStatusArgs = Record<string, never>

export interface BlueprintUpgradeStatusState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface BlueprintUpgradeStatusUpdateProps {
	newCache: ContentCache

	invalidateStudioIds: StudioId[]
	invalidateShowStyleBaseIds: ShowStyleBaseId[]
	invalidateBlueprintIds: BlueprintId[]
}

async function setupBlueprintUpgradeStatusPublicationObservers(
	_args: ReadonlyDeep<BlueprintUpgradeStatusArgs>,
	triggerUpdate: TriggerUpdate<BlueprintUpgradeStatusUpdateProps>
): Promise<LiveQueryHandle[]> {
	// TODO - can this be done cheaper?
	const cache = createReactiveContentCache()

	// Push update
	triggerUpdate({ newCache: cache })

	const mongoObserver = new UpgradesContentObserver(cache)

	// Set up observers:
	return [
		mongoObserver,

		cache.Studios.find({}).observeChanges({
			added: (id) => triggerUpdate({ invalidateStudioIds: [protectString(id)] }),
			changed: (id) => triggerUpdate({ invalidateStudioIds: [protectString(id)] }),
			removed: (id) => triggerUpdate({ invalidateStudioIds: [protectString(id)] }),
		}),
		cache.ShowStyleBases.find({}).observeChanges({
			added: (id) => triggerUpdate({ invalidateShowStyleBaseIds: [protectString(id)] }),
			changed: (id) => triggerUpdate({ invalidateShowStyleBaseIds: [protectString(id)] }),
			removed: (id) => triggerUpdate({ invalidateShowStyleBaseIds: [protectString(id)] }),
		}),
		cache.Blueprints.find({}).observeChanges({
			added: (id) => triggerUpdate({ invalidateBlueprintIds: [protectString(id)] }),
			changed: (id) => triggerUpdate({ invalidateBlueprintIds: [protectString(id)] }),
			removed: (id) => triggerUpdate({ invalidateBlueprintIds: [protectString(id)] }),
		}),
	]
}

function getDocumentId(type: 'studio' | 'showStyle', id: ProtectedString<any>): UIBlueprintUpgradeStatusId {
	return protectString(`${type}:${id}`)
}

export async function manipulateBlueprintUpgradeStatusPublicationData(
	_args: BlueprintUpgradeStatusArgs,
	state: Partial<BlueprintUpgradeStatusState>,
	collection: CustomPublishCollection<UIBlueprintUpgradeStatus>,
	updateProps: Partial<ReadonlyDeep<BlueprintUpgradeStatusUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the notes
		collection.remove(null)

		return
	}

	const studioBlueprintsMap = new Map<BlueprintId, BlueprintMapEntry>()
	const showStyleBlueprintsMap = new Map<BlueprintId, BlueprintMapEntry>()
	state.contentCache.Blueprints.find({}).forEach((blueprint) => {
		switch (blueprint.blueprintType) {
			case BlueprintManifestType.SHOWSTYLE:
				showStyleBlueprintsMap.set(blueprint._id, {
					_id: blueprint._id,
					configPresets: blueprint.showStyleConfigPresets,
					configSchema: blueprint.showStyleConfigSchema,
					blueprintHash: blueprint.blueprintHash,
					hasFixUpFunction: blueprint.hasFixUpFunction,
				})
				break
			case BlueprintManifestType.STUDIO:
				studioBlueprintsMap.set(blueprint._id, {
					_id: blueprint._id,
					configPresets: blueprint.studioConfigPresets,
					configSchema: blueprint.studioConfigSchema,
					blueprintHash: blueprint.blueprintHash,
					hasFixUpFunction: blueprint.hasFixUpFunction,
				})
				break
			// TODO - default?
		}
	})

	const updateAll = !updateProps || !!updateProps?.newCache
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		state.contentCache.Studios.find({}).forEach((studio) => {
			updateStudioUpgradeStatus(collection, studioBlueprintsMap, studio)
		})

		state.contentCache.ShowStyleBases.find({}).forEach((showStyleBase) => {
			updateShowStyleUpgradeStatus(collection, showStyleBlueprintsMap, showStyleBase)
		})
	} else {
		const regenerateForStudioIds = new Set(updateProps.invalidateStudioIds)
		const regenerateForShowStyleBaseIds = new Set(updateProps.invalidateShowStyleBaseIds)

		if (updateProps.invalidateBlueprintIds) {
			// Find Studios whose blueprint triggered an invalidation
			const invalidatedStudios = state.contentCache.Studios.find({
				blueprintId: { $in: updateProps.invalidateBlueprintIds },
			})
			for (const studio of invalidatedStudios) {
				regenerateForStudioIds.add(studio._id)
			}

			// Find ShowStyleBases whose blueprint triggered an invalidation
			const invalidatedShowStyles = state.contentCache.ShowStyleBases.find({
				blueprintId: { $in: updateProps.invalidateBlueprintIds },
			})
			for (const showStyle of invalidatedShowStyles) {
				regenerateForShowStyleBaseIds.add(showStyle._id)
			}
		}

		// Regenerate Studios
		for (const studioId of regenerateForStudioIds) {
			const studio = state.contentCache.Studios.findOne(studioId)

			if (studio) {
				updateStudioUpgradeStatus(collection, studioBlueprintsMap, studio)
			} else {
				// Has already been removed
				collection.remove(getDocumentId('studio', studioId))
			}
		}

		// Regenerate ShowStyles
		for (const showStyleBaseId of regenerateForShowStyleBaseIds) {
			const showStyleBase = state.contentCache.ShowStyleBases.findOne(showStyleBaseId)

			if (showStyleBase) {
				updateShowStyleUpgradeStatus(collection, showStyleBlueprintsMap, showStyleBase)
			} else {
				// Has already been removed
				collection.remove(getDocumentId('showStyle', showStyleBaseId))
			}
		}
	}
}

function updateStudioUpgradeStatus(
	collection: CustomPublishCollection<UIBlueprintUpgradeStatus>,
	blueprintsMap: Map<BlueprintId, BlueprintMapEntry>,
	studio: Pick<DBStudio, StudioFields>
) {
	const status = checkDocUpgradeStatus(blueprintsMap, studio)

	collection.replace({
		...status,
		_id: getDocumentId('studio', studio._id),
		documentType: 'studio',
		documentId: studio._id,
		name: studio.name,
	})
}

function updateShowStyleUpgradeStatus(
	collection: CustomPublishCollection<UIBlueprintUpgradeStatus>,
	blueprintsMap: Map<BlueprintId, BlueprintMapEntry>,
	showStyleBase: Pick<DBShowStyleBase, ShowStyleBaseFields>
) {
	const status = checkDocUpgradeStatus(blueprintsMap, showStyleBase)

	collection.replace({
		...status,
		_id: getDocumentId('showStyle', showStyleBase._id),
		documentType: 'showStyle',
		documentId: showStyleBase._id,
		name: showStyleBase.name,
	})
}

export async function createBlueprintUpgradeStatusSubscriptionHandle(
	pub: CustomPublish<UIBlueprintUpgradeStatus>
): Promise<void> {
	await setUpCollectionOptimizedObserver<
		UIBlueprintUpgradeStatus,
		BlueprintUpgradeStatusArgs,
		BlueprintUpgradeStatusState,
		BlueprintUpgradeStatusUpdateProps
	>(
		`pub_${MeteorPubSub.uiBlueprintUpgradeStatuses}`,
		{},
		setupBlueprintUpgradeStatusPublicationObservers,
		manipulateBlueprintUpgradeStatusPublicationData,
		pub,
		100
	)
}

meteorCustomPublish(
	MeteorPubSub.uiBlueprintUpgradeStatuses,
	CustomCollectionName.UIBlueprintUpgradeStatuses,
	async function (pub) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (!cred || NoSecurityReadAccess.any()) {
			await createBlueprintUpgradeStatusSubscriptionHandle(pub)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UIBlueprintUpgradeStatuses}: Not allowed`)
		}
	}
)
