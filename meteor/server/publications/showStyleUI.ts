import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UIShowStyleBase } from '../../lib/api/showStyles'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Complete, literal } from '../../lib/lib'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { logger } from '../logging'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { OrganizationReadAccess } from '../security/organization'
import { ShowStyleReadAccess } from '../security/showStyle'
import { AutoFillSelector } from './lib'

interface UIShowStyleBaseArgs {
	readonly showStyleBaseId: ShowStyleBaseId
}

type UIShowStyleBaseState = Record<string, never>

interface UIShowStyleBaseUpdateProps {
	invalidateShowStyle: boolean
}

async function setupUIShowStyleBasePublicationObservers(
	args: ReadonlyDeep<UIShowStyleBaseArgs>,
	triggerUpdate: TriggerUpdate<UIShowStyleBaseUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		ShowStyleBases.find(args.showStyleBaseId).observe({
			added: () => triggerUpdate({ invalidateShowStyle: true }),
			changed: () => triggerUpdate({ invalidateShowStyle: true }),
			removed: () => triggerUpdate({ invalidateShowStyle: true }),
		}),
	]
}
async function manipulateUIShowStyleBasePublicationData(
	args: UIShowStyleBaseArgs,
	_state: Partial<UIShowStyleBaseState>,
	_updateProps: Partial<UIShowStyleBaseUpdateProps> | undefined
): Promise<UIShowStyleBase[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	const showStyleBase = await ShowStyleBases.findOneAsync(args.showStyleBaseId, {})
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

meteorCustomPublishArray(
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
			const observer = await setUpOptimizedObserver<
				UIShowStyleBase,
				UIShowStyleBaseArgs,
				UIShowStyleBaseState,
				UIShowStyleBaseUpdateProps
			>(
				`pub_${PubSub.uiShowStyleBase}_${showStyleBaseId}`,
				{ showStyleBaseId },
				setupUIShowStyleBasePublicationObservers,
				manipulateUIShowStyleBasePublicationData,
				(_args, newData) => {
					pub.updatedDocs(newData)
				}
			)
			pub.onStop(() => {
				observer.stop()
			})
		} else {
			logger.warn(`Pub.${CustomCollectionName.UIShowStyleBase}: Not allowed: "${showStyleBaseId}"`)
		}
	}
)