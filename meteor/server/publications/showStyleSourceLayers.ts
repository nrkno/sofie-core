import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { DBSourceLayer } from '../../lib/api/showStyles'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { literal, protectString } from '../../lib/lib'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { logger } from '../logging'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { OrganizationReadAccess } from '../security/organization'
import { ShowStyleReadAccess } from '../security/showStyle'
import { AutoFillSelector } from './lib'

interface SourceLayersForShowStyleArgs {
	readonly showStyleBaseId: ShowStyleBaseId
}

type SourceLayersForShowStyleState = Record<string, never>

interface SourceLayersForShowStyleUpdateProps {
	invalidateStudio: boolean
}

async function setupSourceLayersPublicationObservers(
	args: ReadonlyDeep<SourceLayersForShowStyleArgs>,
	triggerUpdate: TriggerUpdate<SourceLayersForShowStyleUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		ShowStyleBases.find(args.showStyleBaseId, {
			fields: {
				sourceLayersWithOverrides: 1,
			},
		}).observe({
			added: () => triggerUpdate({ invalidateStudio: true }),
			changed: () => triggerUpdate({ invalidateStudio: true }),
			removed: () => triggerUpdate({ invalidateStudio: true }),
		}),
	]
}
async function manipulateSourceLayersPublicationData(
	args: SourceLayersForShowStyleArgs,
	_state: Partial<SourceLayersForShowStyleState>,
	_updateProps: Partial<SourceLayersForShowStyleUpdateProps> | undefined
): Promise<DBSourceLayer[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	const showStyleBase = (await ShowStyleBases.findOneAsync(args.showStyleBaseId, {
		projection: {
			sourceLayersWithOverrides: 1,
		},
	})) as Pick<ShowStyleBase, '_id' | 'sourceLayersWithOverrides'> | undefined
	if (!showStyleBase) return []

	const resolvedSourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj

	const res: DBSourceLayer[] = []
	for (const [id, sourceLayer] of Object.entries(resolvedSourceLayers)) {
		if (sourceLayer) {
			res.push(
				literal<DBSourceLayer>({
					_id: protectString(`sourceLayer:${args.showStyleBaseId}:${id}`),
					showStyleBaseId: args.showStyleBaseId,
					sourceLayer,
				})
			)
		}
	}
	return res
}

meteorCustomPublishArray(
	PubSub.sourceLayersForShowStyleBase,
	CustomCollectionName.SourceLayersForShowStyleBase,
	async function (pub, showStyleBaseId: ShowStyleBaseId) {
		const { cred, selector } = await AutoFillSelector.organizationId<ShowStyleBase>(
			this.userId,
			{ _id: showStyleBaseId },
			undefined
		)

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.organizationId &&
				(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
			(selector._id && (await ShowStyleReadAccess.showStyleBase(selector, cred)))
		) {
			const observer = await setUpOptimizedObserver<
				DBSourceLayer,
				SourceLayersForShowStyleArgs,
				SourceLayersForShowStyleState,
				SourceLayersForShowStyleUpdateProps
			>(
				`pub_${PubSub.sourceLayersForShowStyleBase}_${showStyleBaseId}`,
				{ showStyleBaseId },
				setupSourceLayersPublicationObservers,
				manipulateSourceLayersPublicationData,
				(_args, newData) => {
					pub.updatedDocs(newData)
				}
			)
			pub.onStop(() => {
				observer.stop()
			})
		} else {
			logger.warn(`Pub.${CustomCollectionName.SourceLayersForShowStyleBase}: Not allowed: "${showStyleBaseId}"`)
		}
	}
)
