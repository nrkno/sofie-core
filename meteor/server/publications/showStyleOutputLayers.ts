import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { DBOutputLayer } from '../../lib/api/showStyles'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { literal, protectString } from '../../lib/lib'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { logger } from '../logging'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { OrganizationReadAccess } from '../security/organization'
import { ShowStyleReadAccess } from '../security/showStyle'
import { AutoFillSelector } from './lib'

interface OutputLayersForShowStyleArgs {
	readonly showStyleBaseId: ShowStyleBaseId
}

type OutputLayersForShowStyleState = Record<string, never>

interface OutputLayersForShowStyleUpdateProps {
	invalidateStudio: boolean
}

async function setupOutputLayersPublicationObservers(
	args: ReadonlyDeep<OutputLayersForShowStyleArgs>,
	triggerUpdate: TriggerUpdate<OutputLayersForShowStyleUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		ShowStyleBases.find(args.showStyleBaseId, {
			fields: {
				outputLayersWithOverrides: 1,
			},
		}).observe({
			added: () => triggerUpdate({ invalidateStudio: true }),
			changed: () => triggerUpdate({ invalidateStudio: true }),
			removed: () => triggerUpdate({ invalidateStudio: true }),
		}),
	]
}
async function manipulateOutputLayersPublicationData(
	args: OutputLayersForShowStyleArgs,
	_state: Partial<OutputLayersForShowStyleState>,
	_updateProps: Partial<OutputLayersForShowStyleUpdateProps> | undefined
): Promise<DBOutputLayer[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	const showStyleBase = (await ShowStyleBases.findOneAsync(args.showStyleBaseId, {
		projection: {
			outputLayersWithOverrides: 1,
		},
	})) as Pick<ShowStyleBase, '_id' | 'outputLayersWithOverrides'> | undefined
	if (!showStyleBase) return []

	const resolvedOutputLayers = applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj

	const res: DBOutputLayer[] = []
	for (const [id, outputLayer] of Object.entries(resolvedOutputLayers)) {
		if (outputLayer) {
			res.push(
				literal<DBOutputLayer>({
					_id: protectString(`outputLayer:${args.showStyleBaseId}:${id}`),
					showStyleBaseId: args.showStyleBaseId,
					outputLayer,
				})
			)
		}
	}
	return res
}

meteorCustomPublishArray(
	PubSub.outputLayersForShowStyleBase,
	CustomCollectionName.OutputLayersForShowStyleBase,
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
				DBOutputLayer,
				OutputLayersForShowStyleArgs,
				OutputLayersForShowStyleState,
				OutputLayersForShowStyleUpdateProps
			>(
				`pub_${PubSub.outputLayersForShowStyleBase}_${showStyleBaseId}`,
				{ showStyleBaseId },
				setupOutputLayersPublicationObservers,
				manipulateOutputLayersPublicationData,
				(_args, newData) => {
					pub.updatedDocs(newData)
				}
			)
			pub.onStop(() => {
				observer.stop()
			})
		} else {
			logger.warn(`Pub.${CustomCollectionName.OutputLayersForShowStyleBase}: Not allowed: "${showStyleBaseId}"`)
		}
	}
)
