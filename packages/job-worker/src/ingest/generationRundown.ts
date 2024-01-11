import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { BlueprintId, PeripheralDeviceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { StudioUserContext, GetRundownContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import {
	postProcessAdLibPieces,
	postProcessGlobalAdLibActions,
	postProcessRundownBaselineItems,
} from '../blueprints/postProcess'
import { logger } from '../logging'
import _ = require('underscore')
import { IngestModel } from './model/IngestModel'
import { LocalIngestRundown } from './ingestCache'
import { extendIngestRundownCore, canRundownBeUpdated } from './lib'
import { JobContext } from '../jobs'
import { CommitIngestData } from './lock'
import { SelectedShowStyleVariant, selectShowStyleVariant } from './selectShowStyleVariant'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { updateExpectedPackagesForRundownBaseline } from './expectedPackages'
import { ReadonlyDeep } from 'type-fest'
import { BlueprintResultRundown, ExtendedIngestRundown } from '@sofie-automation/blueprints-integration'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { convertRundownToBlueprintSegmentRundown } from '../blueprints/context/lib'
import { calculateSegmentsAndRemovalsFromIngestData } from './generationSegment'

/**
 * Regenerate and save a whole Rundown
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param isCreateAction Whether this operation is to create the Rundown or update it
 * @param peripheralDeviceId Id of the PeripheralDevice the Rundown originated from
 * @returns CommitIngestData describing the change
 */
export async function updateRundownFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: LocalIngestRundown,
	isCreateAction: boolean,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	const span = context.startSpan('ingest.rundownInput.updateRundownFromIngestData')

	if (!canRundownBeUpdated(ingestModel.rundown, isCreateAction)) return null

	logger.info(`${ingestModel.rundown ? 'Updating' : 'Adding'} rundown ${ingestModel.rundownId}`)

	// canBeUpdated is to be run by the callers

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, ingestModel.rundown)

	const pPeripheralDevice = peripheralDeviceId
		? context.directCollections.PeripheralDevices.findOne(peripheralDeviceId)
		: undefined

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${context.studio._id},rundownId=${ingestModel.rundownId},ingestRundownId=${ingestModel.rundownExternalId}`,
			tempSendUserNotesIntoBlackHole: true,
		},
		context.studio,
		context.getStudioBlueprintConfig()
	)
	// TODO-CONTEXT save any user notes from selectShowStyleContext
	const showStyle = await selectShowStyleVariant(context, selectShowStyleContext, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		throw new Error('Blueprint rejected the rundown')
	}

	const pAllRundownWatchedPackages = WatchedPackagesHelper.createForIngestRundown(context, ingestModel)

	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyle.base._id)
	const allRundownWatchedPackages = await pAllRundownWatchedPackages

	// Call blueprints, get rundown
	const dbRundown = await regenerateRundownAndBaselineFromIngestData(
		context,
		ingestModel,
		extendedIngestRundown,
		pPeripheralDevice,
		showStyle,
		showStyleBlueprint,
		allRundownWatchedPackages
	)
	if (!dbRundown) {
		// We got no rundown, abort:
		return null
	}

	// TODO - store notes from rundownNotesContext

	const { changedSegmentIds, removedSegmentIds } = await calculateSegmentsAndRemovalsFromIngestData(
		context,
		ingestModel,
		ingestRundown,
		allRundownWatchedPackages
	)

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: changedSegmentIds,
		removedSegmentIds: removedSegmentIds,
		renamedSegments: new Map(),

		removeRundown: false,
	})
}

/**
 * Regenerate Rundown if necessary from metadata change
 * Note: callers are expected to check the change is allowed by calling `canBeUpdated` prior to this
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param peripheralDeviceId Id of the PeripheralDevice the Rundown originated from
 * @returns CommitIngestData describing the change
 */
export async function updateRundownMetadataFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: LocalIngestRundown,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	if (!canRundownBeUpdated(ingestModel.rundown, false)) return null
	const existingRundown = ingestModel.rundown
	if (!existingRundown) {
		throw new Error(`Rundown "${ingestRundown.externalId}" does not exist`)
	}

	const pPeripheralDevice = peripheralDeviceId
		? context.directCollections.PeripheralDevices.findOne(peripheralDeviceId)
		: undefined

	const span = context.startSpan('ingest.rundownInput.handleUpdatedRundownMetaDataInner')

	logger.info(`Updating rundown ${ingestModel.rundownId}`)

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, ingestModel.rundown)

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${context.studio._id},rundownId=${ingestModel.rundownId},ingestRundownId=${ingestModel.rundownExternalId}`,
			tempSendUserNotesIntoBlackHole: true,
		},
		context.studio,
		context.getStudioBlueprintConfig()
	)

	// TODO-CONTEXT save any user notes from selectShowStyleContext
	const showStyle = await selectShowStyleVariant(context, selectShowStyleContext, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		throw new Error('Blueprint rejected the rundown')
	}

	const pAllRundownWatchedPackages = WatchedPackagesHelper.createForIngestRundown(context, ingestModel)

	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyle.base._id)
	const allRundownWatchedPackages = await pAllRundownWatchedPackages

	// Call blueprints, get rundown
	const dbRundown = await regenerateRundownAndBaselineFromIngestData(
		context,
		ingestModel,
		extendedIngestRundown,
		pPeripheralDevice,
		showStyle,
		showStyleBlueprint,
		allRundownWatchedPackages
	)
	if (!dbRundown) {
		// We got no rundown, abort:
		return null
	}

	let changedSegmentIds: SegmentId[] | undefined
	let removedSegmentIds: SegmentId[] | undefined
	if (
		!_.isEqual(
			convertRundownToBlueprintSegmentRundown(existingRundown, true),
			convertRundownToBlueprintSegmentRundown(dbRundown, true)
		)
	) {
		logger.info(`MetaData of rundown ${dbRundown.externalId} has been modified, regenerating segments`)
		const changes = await calculateSegmentsAndRemovalsFromIngestData(
			context,
			ingestModel,
			ingestRundown,
			allRundownWatchedPackages
		)
		changedSegmentIds = changes.changedSegmentIds
		removedSegmentIds = changes.removedSegmentIds
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: changedSegmentIds ?? [],
		removedSegmentIds: removedSegmentIds ?? [],
		renamedSegments: new Map(),

		removeRundown: false,
	})
}

/**
 * Generate a DBRundown from the ingest data
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param pPeripheralDevice The PeripheralDevice the Rundown originated from (if any)
 * @param showStyle ShowStyle to regenerate for
 * @param showStyleBlueprint ShowStyle Blueprint to regenerate with
 * @param allRundownWatchedPackages WatchedPackagesHelper for all packages belonging to the rundown
 * @returns Generated documents or null if Blueprints reject the Rundown
 */
export async function regenerateRundownAndBaselineFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	extendedIngestRundown: ExtendedIngestRundown,
	pPeripheralDevice: Promise<PeripheralDevice | undefined> | undefined,
	showStyle: SelectedShowStyleVariant,
	showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	allRundownWatchedPackages: WatchedPackagesHelper
): Promise<ReadonlyDeep<DBRundown> | null> {
	const rundownBaselinePackages = allRundownWatchedPackages.filter(
		context,
		(pkg) =>
			pkg.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_ACTION ||
			pkg.fromPieceType === ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
	)

	const blueprintContext = new GetRundownContext(
		{
			name: `${showStyle.base.name}-${showStyle.variant.name}`,
			identifier: `showStyleBaseId=${showStyle.base._id},showStyleVariantId=${showStyle.variant._id}`,
		},
		context,
		showStyle.compound,
		rundownBaselinePackages,
		async () => {
			// Note: This can cause a mild race-condition, in the case of two Rundowns being created at the same time.
			// But we're just ignoreing that for now.
			return context.directCollections.RundownPlaylists.findFetch({
				studioId: context.studioId,
			})
		},
		async () => {
			return context.directCollections.Rundowns.findFetch(
				{
					studioId: context.studioId,
				},
				{
					projection: {
						_id: 1,
						playlistId: 1,
					},
				}
			) as Promise<Pick<DBRundown, '_id' | 'playlistId'>[]>
		},
		async () => {
			return ingestModel.rundown
		}
	)
	let rundownRes: BlueprintResultRundown | null = null
	try {
		rundownRes = await showStyleBlueprint.blueprint.getRundown(blueprintContext, extendedIngestRundown)
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.getRundown: ${stringifyError(err)}`)
		rundownRes = null
	}

	if (rundownRes === null) {
		// There was an error in the blueprint, abort:
		return null
	}

	const translationNamespaces: BlueprintId[] = []
	if (showStyleBlueprint.blueprintId) {
		translationNamespaces.push(showStyleBlueprint.blueprintId)
	}
	if (context.studio.blueprintId) {
		translationNamespaces.push(context.studio.blueprintId)
	}

	// Ensure the ids in the notes are clean
	const rundownNotes = blueprintContext.notes.map((note) =>
		literal<RundownNote>({
			type: note.type,
			message: wrapTranslatableMessageFromBlueprints(note.message, translationNamespaces),
			origin: {
				name: `${showStyle.base.name}-${showStyle.variant.name}`,
			},
		})
	)

	const peripheralDevice = await pPeripheralDevice

	ingestModel.setRundownData(
		rundownRes.rundown,
		showStyle.base,
		showStyle.variant,
		showStyleBlueprint,
		peripheralDevice,
		rundownNotes
	)

	// get the rundown separetely to ensure it exists now
	const dbRundown = ingestModel.getRundown()

	// Save the baseline
	logger.info(`Building baseline objects for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.timelineObjects.length} objects from baseline.`)
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib objects from baseline.`)
	logger.info(`... got ${(rundownRes.globalActions || []).length} adLib actions from baseline.`)

	const timelineObjectsBlob = serializePieceTimelineObjectsBlob(
		postProcessRundownBaselineItems(showStyle.base.blueprintId, rundownRes.baseline.timelineObjects)
	)

	const adlibPieces = postProcessAdLibPieces(
		context,
		showStyle.base.blueprintId,
		dbRundown._id,
		undefined,
		rundownRes.globalAdLibPieces
	)
	const adlibActions = postProcessGlobalAdLibActions(
		showStyle.base.blueprintId,
		dbRundown._id,
		rundownRes.globalActions || []
	)

	await ingestModel.setRundownBaseline(timelineObjectsBlob, adlibPieces, adlibActions)

	await updateExpectedPackagesForRundownBaseline(context, ingestModel, rundownRes.baseline)

	return dbRundown
}
