import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { BlueprintId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { getRandomId, literal, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { StudioUserContext, GetRundownContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import {
	postProcessAdLibPieces,
	postProcessGlobalAdLibActions,
	postProcessRundownBaselineItems,
} from '../blueprints/postProcess'
import { saveIntoCache } from '../cache/lib'
import { sumChanges, anythingChanged } from '../db/changes'
import { getCurrentTime, getSystemVersion } from '../lib'
import { logger } from '../logging'
import _ = require('underscore')
import { CacheForIngest } from './cache'
import { LocalIngestRundown } from './ingestCache'
import { extendIngestRundownCore, canRundownBeUpdated } from './lib'
import { JobContext } from '../jobs'
import { CommitIngestData } from './lock'
import { SelectedShowStyleVariant, selectShowStyleVariant } from './selectShowStyleVariant'
import { getExternalNRCSName, PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { updateBaselineExpectedPackagesOnRundown } from './expectedPackages'
import { ReadonlyDeep } from 'type-fest'
import { BlueprintResultRundown } from '@sofie-automation/blueprints-integration'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { ReadOnlyCache } from '../cache/CacheBase'
import { convertRundownToBlueprintSegmentRundown } from '../blueprints/context/lib'
import {
	calculateSegmentsAndRemovalsFromIngestData,
	saveSegmentChangesToCache,
	UpdateSegmentsResult,
} from './generationSegment'

/**
 * Regenerate and save a whole Rundown
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param isCreateAction Whether this operation is to create the Rundown or update it
 * @param peripheralDeviceId Id of the PeripheralDevice the Rundown originated from
 * @returns CommitIngestData describing the change
 */
export async function updateRundownFromIngestData(
	context: JobContext,
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	isCreateAction: boolean,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	const span = context.startSpan('ingest.rundownInput.updateRundownFromIngestData')

	if (!canRundownBeUpdated(cache.Rundown.doc, isCreateAction)) return null

	logger.info(`${cache.Rundown.doc ? 'Updating' : 'Adding'} rundown ${cache.RundownId}`)

	// canBeUpdated is to be run by the callers

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, cache.Rundown.doc)

	const pPeripheralDevice = peripheralDeviceId
		? context.directCollections.PeripheralDevices.findOne(peripheralDeviceId)
		: undefined

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${context.studio._id},rundownId=${cache.RundownId},ingestRundownId=${cache.RundownExternalId}`,
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

	const pAllRundownWatchedPackages = WatchedPackagesHelper.createForIngest(context, cache, undefined)

	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyle.base._id)
	const allRundownWatchedPackages = await pAllRundownWatchedPackages

	// Call blueprints, get rundown
	const rundownData = await getRundownFromIngestData(
		context,
		cache,
		ingestRundown,
		pPeripheralDevice,
		showStyle,
		showStyleBlueprint,
		allRundownWatchedPackages
	)
	if (!rundownData) {
		// We got no rundown, abort:
		return null
	}

	const { dbRundownData, rundownRes } = rundownData

	// Save rundown and baseline
	const dbRundown = await saveChangesForRundown(context, cache, dbRundownData, rundownRes, showStyle)

	// TODO - store notes from rundownNotesContext

	const { segmentChanges, removedSegments } = await calculateSegmentsAndRemovalsFromIngestData(
		context,
		cache,
		ingestRundown,
		allRundownWatchedPackages
	)

	updateBaselineExpectedPackagesOnRundown(context, cache, rundownRes.baseline)

	saveSegmentChangesToCache(context, cache, segmentChanges, true)

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: removedSegments.map((s) => s._id),
		renamedSegments: new Map(),

		removeRundown: false,
	})
}

/**
 * Regenerate Rundown if necessary from metadata change
 * Note: callers are expected to check the change is allowed by calling `canBeUpdated` prior to this
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param peripheralDeviceId Id of the PeripheralDevice the Rundown originated from
 * @returns CommitIngestData describing the change
 */
export async function updateRundownMetadataFromIngestData(
	context: JobContext,
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	if (!canRundownBeUpdated(cache.Rundown.doc, false)) return null
	const existingRundown = cache.Rundown.doc
	if (!existingRundown) {
		throw new Error(`Rundown "${ingestRundown.externalId}" does not exist`)
	}

	const pPeripheralDevice = peripheralDeviceId
		? context.directCollections.PeripheralDevices.findOne(peripheralDeviceId)
		: undefined

	const span = context.startSpan('ingest.rundownInput.handleUpdatedRundownMetaDataInner')

	logger.info(`Updating rundown ${cache.RundownId}`)

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, cache.Rundown.doc)

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${context.studio._id},rundownId=${cache.RundownId},ingestRundownId=${cache.RundownExternalId}`,
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

	const pAllRundownWatchedPackages = WatchedPackagesHelper.createForIngest(context, cache, undefined)

	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyle.base._id)
	const allRundownWatchedPackages = await pAllRundownWatchedPackages

	// Call blueprints, get rundown
	const rundownData = await getRundownFromIngestData(
		context,
		cache,
		ingestRundown,
		pPeripheralDevice,
		showStyle,
		showStyleBlueprint,
		allRundownWatchedPackages
	)
	if (!rundownData) {
		// We got no rundown, abort:
		return null
	}

	const { dbRundownData, rundownRes } = rundownData

	// Save rundown and baseline
	const dbRundown = await saveChangesForRundown(context, cache, dbRundownData, rundownRes, showStyle)

	let segmentChanges: UpdateSegmentsResult | undefined
	let removedSegments: DBSegment[] | undefined
	if (
		!_.isEqual(
			convertRundownToBlueprintSegmentRundown(existingRundown, true),
			convertRundownToBlueprintSegmentRundown(dbRundown, true)
		)
	) {
		logger.info(`MetaData of rundown ${dbRundown.externalId} has been modified, regenerating segments`)
		const changes = await calculateSegmentsAndRemovalsFromIngestData(
			context,
			cache,
			ingestRundown,
			allRundownWatchedPackages
		)
		segmentChanges = changes.segmentChanges
		removedSegments = changes.removedSegments
	}

	updateBaselineExpectedPackagesOnRundown(context, cache, rundownRes.baseline)

	if (segmentChanges) {
		saveSegmentChangesToCache(context, cache, segmentChanges, true)
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges?.segments.map((s) => s._id) ?? [],
		removedSegmentIds: removedSegments?.map((s) => s._id) ?? [],
		renamedSegments: new Map(),

		removeRundown: false,
	})
}

/**
 * Generate a DBRundown from the ingest data
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param pPeripheralDevice The PeripheralDevice the Rundown originated from (if any)
 * @param showStyle ShowStyle to regenerate for
 * @param showStyleBlueprint ShowStyle Blueprint to regenerate with
 * @param allRundownWatchedPackages WatchedPackagesHelper for all packages belonging to the rundown
 * @returns Generated documents or null if Blueprints reject the Rundown
 */
export async function getRundownFromIngestData(
	context: JobContext,
	cache: ReadOnlyCache<CacheForIngest>,
	ingestRundown: LocalIngestRundown,
	pPeripheralDevice: Promise<PeripheralDevice | undefined> | undefined,
	showStyle: SelectedShowStyleVariant,
	showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	allRundownWatchedPackages: WatchedPackagesHelper
): Promise<{ dbRundownData: DBRundown; rundownRes: BlueprintResultRundown } | null> {
	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, cache.Rundown.doc)

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
			return cache.Rundown.doc
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
	const dbRundownData = literal<DBRundown>({
		...rundownRes.rundown,
		notes: rundownNotes,
		_id: cache.RundownId,
		externalId: ingestRundown.externalId,
		organizationId: context.studio.organizationId,
		studioId: context.studio._id,
		showStyleVariantId: showStyle.variant._id,
		showStyleBaseId: showStyle.base._id,
		orphaned: undefined,

		importVersions: {
			studio: context.studio._rundownVersionHash,
			showStyleBase: showStyle.base._rundownVersionHash,
			showStyleVariant: showStyle.variant._rundownVersionHash,
			blueprint: showStyleBlueprint.blueprint.blueprintVersion,
			core: getSystemVersion(),
		},

		created: cache.Rundown.doc?.created ?? getCurrentTime(),
		modified: getCurrentTime(),

		peripheralDeviceId: peripheralDevice?._id,
		externalNRCSName: getExternalNRCSName(peripheralDevice),

		// validated later
		playlistId: protectString(''),
		...(cache.Rundown.doc
			? _.pick(cache.Rundown.doc, 'playlistId', 'baselineModifyHash', 'airStatus', 'status')
			: {}),
	})

	return { dbRundownData, rundownRes }
}

/**
 * Save documents for an ingested Rundown into the cache
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param dbRundownData Rundown document to save
 * @param rundownRes Rundown owned documents
 * @param showStyle ShowStyle the rundown is generated for
 * @returns Reference to updated Rundown document
 */
export async function saveChangesForRundown(
	context: JobContext,
	cache: CacheForIngest,
	dbRundownData: DBRundown,
	rundownRes: BlueprintResultRundown,
	showStyle: SelectedShowStyleVariant
): Promise<ReadonlyDeep<DBRundown>> {
	const dbRundown = cache.Rundown.replace(dbRundownData)

	// Save the baseline
	logger.info(`Building baseline objects for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.timelineObjects.length} objects from baseline.`)
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib objects from baseline.`)
	logger.info(`... got ${(rundownRes.globalActions || []).length} adLib actions from baseline.`)

	const { baselineObjects, baselineAdlibPieces, baselineAdlibActions } = await cache.loadBaselineCollections()
	const rundownBaselineChanges = sumChanges(
		saveIntoCache<RundownBaselineObj>(context, baselineObjects, null, [
			{
				_id: getRandomId(7),
				rundownId: dbRundown._id,
				timelineObjectsString: serializePieceTimelineObjectsBlob(
					postProcessRundownBaselineItems(showStyle.base.blueprintId, rundownRes.baseline.timelineObjects)
				),
			},
		]),
		// Save the global adlibs
		saveIntoCache<RundownBaselineAdLibItem>(
			context,
			baselineAdlibPieces,
			null,
			postProcessAdLibPieces(
				context,
				showStyle.base.blueprintId,
				dbRundown._id,
				undefined,
				rundownRes.globalAdLibPieces
			)
		),
		saveIntoCache<RundownBaselineAdLibAction>(
			context,
			baselineAdlibActions,
			null,
			postProcessGlobalAdLibActions(showStyle.base.blueprintId, dbRundown._id, rundownRes.globalActions || [])
		)
	)
	if (anythingChanged(rundownBaselineChanges)) {
		// If any of the rundown baseline datas was modified, we'll update the baselineModifyHash of the rundown
		cache.Rundown.update((rd) => {
			rd.baselineModifyHash = getCurrentTime() + ''
			return rd
		})
	}

	return dbRundown
}
