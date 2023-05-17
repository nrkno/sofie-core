import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UIShowStyleBase } from '../../lib/api/showStyles'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { Complete, literal } from '../../lib/lib'
import { meteorCustomPublish, setUpOptimizedObserverArray, TriggerUpdate } from '../lib/customPublication'
import { logger } from '../logging'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { OrganizationReadAccess } from '../security/organization'
import { ShowStyleReadAccess } from '../security/showStyle'
import { ShowStyleBases } from '../collections'
import { AutoFillSelector } from './lib'

interface UIShowStyleBaseArgs {
	readonly showStyleBaseId: ShowStyleBaseId
}

type UIShowStyleBaseState = Record<string, never>

interface UIShowStyleBaseUpdateProps {
	invalidateShowStyle: boolean
}

type ShowStyleBaseFields = '_id' | 'name' | 'outputLayersWithOverrides' | 'sourceLayersWithOverrides' | 'hotkeyLegend'
const fieldSpecifier = literal<IncludeAllMongoFieldSpecifier<ShowStyleBaseFields>>({
	_id: 1,
	name: 1,
	outputLayersWithOverrides: 1,
	sourceLayersWithOverrides: 1,
	hotkeyLegend: 1,
})

async function setupUIShowStyleBasePublicationObservers(
	args: ReadonlyDeep<UIShowStyleBaseArgs>,
	triggerUpdate: TriggerUpdate<UIShowStyleBaseUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		ShowStyleBases.observeChanges(
			args.showStyleBaseId,
			{
				added: () => triggerUpdate({ invalidateShowStyle: true }),
				changed: () => triggerUpdate({ invalidateShowStyle: true }),
				removed: () => triggerUpdate({ invalidateShowStyle: true }),
			},
			{
				fields: fieldSpecifier,
			}
		),
	]
}
async function manipulateUIShowStyleBasePublicationData(
	args: UIShowStyleBaseArgs,
	_state: Partial<UIShowStyleBaseState>,
	_updateProps: Partial<UIShowStyleBaseUpdateProps> | undefined
): Promise<UIShowStyleBase[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	const showStyleBase = (await ShowStyleBases.findOneAsync(args.showStyleBaseId, { projection: fieldSpecifier })) as
		| Pick<ShowStyleBase, ShowStyleBaseFields>
		| undefined
	if (!showStyleBase) return []

	const resolvedOutputLayers = applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj
	const resolvedSourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj

	return [
		literal<Complete<UIShowStyleBase>>({
			_id: showStyleBase._id,
			name: showStyleBase.name,
			sourceLayers: resolvedSourceLayers,
			outputLayers: resolvedOutputLayers,
			hotkeyLegend: showStyleBase.hotkeyLegend,
		}),
	]
}

meteorCustomPublish(
	PubSub.uiShowStyleBase,
	CustomCollectionName.UIShowStyleBase,
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
			await setUpOptimizedObserverArray<
				UIShowStyleBase,
				UIShowStyleBaseArgs,
				UIShowStyleBaseState,
				UIShowStyleBaseUpdateProps
			>(
				`pub_${PubSub.uiShowStyleBase}_${showStyleBaseId}`,
				{ showStyleBaseId },
				setupUIShowStyleBasePublicationObservers,
				manipulateUIShowStyleBasePublicationData,
				pub
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UIShowStyleBase}: Not allowed: "${showStyleBaseId}"`)
		}
	}
)
