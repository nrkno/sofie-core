import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import type { CreateTestingRundownForShowStyleVariantProps } from '@sofie-automation/corelib/dist/worker/ingest'
import type { JobContext } from '../jobs'
import type { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { convertShowStyleVariantToBlueprints } from '../blueprints/context/lib'
import { ShowStyleUserContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { handleUpdatedRundown } from './ingestRundownJobs'
import type {
	IShowStyleUserContext,
	IBlueprintShowStyleVariant,
	IngestRundown,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../logging'

export async function handleCreateTestingRundownForShowStyleVariant(
	context: JobContext,
	data: CreateTestingRundownForShowStyleVariantProps
): Promise<RundownId> {
	const showStyleVariant = await context.getShowStyleVariant(data.showStyleVariantId)
	const showStyleCompound = await context.getShowStyleCompound(showStyleVariant._id)
	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

	const generateTestingRundown = showStyleBlueprint.blueprint.generateTestingRundown || fallbackBlueprintMethod
	const blueprintContext = new ShowStyleUserContext(
		{
			name: `Create Testing Rundown`,
			identifier: `studioId=${context.studioId},showStyleBaseId=${showStyleCompound._id},showStyleVariantId=${showStyleCompound.showStyleVariantId}`,
			tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT
		},
		context,
		showStyleCompound,
		WatchedPackagesHelper.empty(context) // Can't provide any packages here, as we don't have a scope to limit it to yet
	)

	const ingestRundown = await Promise.resolve()
		.then(async () =>
			generateTestingRundown(blueprintContext, convertShowStyleVariantToBlueprints(showStyleVariant))
		)
		.catch(async (e) => {
			throw UserError.from(e, UserErrorMessage.TestingRundownsGenerationFailed, { message: e.toString() })
		})

	// const rundownId = getRundownId(context.studioId, data.rundownExternalId)
	ingestRundown.externalId = `testing:${ingestRundown.externalId || showStyleVariant._id}`

	logger.info(`Creating testing rundown "${ingestRundown.name}" for showStyleVariant "${showStyleVariant.name}"`)

	return handleUpdatedRundown(context, {
		rundownExternalId: ingestRundown.externalId,
		ingestRundown,
		isCreateAction: true,
		rundownSource: {
			type: 'testing',
			showStyleVariantId: showStyleVariant._id,
		},
	})
}

function fallbackBlueprintMethod(
	_context: IShowStyleUserContext,
	showStyleVariant: IBlueprintShowStyleVariant
): IngestRundown {
	return {
		externalId: '',
		name: `Rehearsal: ${showStyleVariant.name}`,
		type: 'rehearsal',
		payload: {},
		segments: [], // No contents
	}
}
