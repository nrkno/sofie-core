import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { CreateTestingRundownForShowStyleVariantProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../jobs'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { convertShowStyleVariantToBlueprints } from '../blueprints/context/lib'
import { ShowStyleUserContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { handleUpdatedRundown } from './ingestRundownJobs'

export async function handleCreateTestingRundownForShowStyleVariant(
	context: JobContext,
	data: CreateTestingRundownForShowStyleVariantProps
): Promise<RundownId> {
	const showStyleVariant = await context.getShowStyleVariant(data.showStyleVariantId)
	const showStyleCompound = await context.getShowStyleCompound(showStyleVariant._id)
	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

	const generateTestingRundown = showStyleBlueprint.blueprint.generateTestingRundown
	if (!generateTestingRundown) {
		throw UserError.create(UserErrorMessage.AdlibTestingNotAllowed) // nocommit error message
	}

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
			throw UserError.from(e, UserErrorMessage.AdlibTestingNotAllowed) // nocommit error message
		})

	// const rundownId = getRundownId(context.studioId, data.rundownExternalId)
	ingestRundown.externalId = `testing:${ingestRundown.externalId || showStyleVariant._id}`

	return handleUpdatedRundown(context, {
		rundownExternalId: ingestRundown.externalId,
		ingestRundown,
		peripheralDeviceId: null, // nocommit something here to indicate it can be resynced
		isCreateAction: true,
	})
}
