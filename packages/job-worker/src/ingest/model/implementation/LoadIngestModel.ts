import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../../../jobs'
import { ReadonlyDeep } from 'type-fest'
import { RundownLock } from '../../../jobs/lock'
import { IngestModel } from '../IngestModel'
import { DatabasePersistedModel } from '../../../modelBase'
import { getRundownId } from '../../lib'
import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageFromRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { IngestModelImpl } from './IngestModelImpl'
import { clone } from '@sofie-automation/corelib/dist/lib'

/**
 * Load an IngestModel for the given Rundown
 * @param context Context from the job queue
 * @param rundownLock Lock for the Rundown to load
 * @param rundown Preloaded copy of the Rundown
 * @returns Loaded IngestModel
 */
export async function loadIngestModelFromRundown(
	context: JobContext,
	rundownLock: RundownLock,
	rundown: ReadonlyDeep<DBRundown>
): Promise<IngestModel & DatabasePersistedModel> {
	const span = context.startSpan('IngestModel.loadFromRundown')
	if (span) span.setLabel('rundownId', unprotectString(rundown._id))

	if (!rundownLock.isLocked) {
		throw new Error('Cannot create model with released RundownLock')
	}

	const collections = await loadCollections(context, rundown._id)
	if (rundown._id !== rundownLock.rundownId)
		throw new Error(
			`loadIngestModelFromRundown: RundownLock "${rundownLock.rundownId}" is for the wrong Rundown. Expected ${rundown._id}`
		)

	const res = new IngestModelImpl(context, rundownLock, rundown.externalId, clone<DBRundown>(rundown), ...collections)

	if (span) span.end()
	return res
}

/**
 * Load an IngestModel for the given Rundown
 * @param context Context from the job queue
 * @param rundownLock Lock for the Rundown to load
 * @param rundownExternalId externalId of the Rundown to load
 * @returns Loaded IngestModel
 */
export async function loadIngestModelFromRundownExternalId(
	context: JobContext,
	rundownLock: RundownLock,
	rundownExternalId: string
): Promise<IngestModel & DatabasePersistedModel> {
	const span = context.startSpan('IngestModel.loadFromExternalId')
	if (span) span.setLabel('externalId', rundownExternalId)

	const rundownId = getRundownId(context.studioId, rundownExternalId)
	if (span) span.setLabel('rundownId', unprotectString(rundownId))

	if (!rundownLock.isLocked) {
		throw new Error('Cannot create model with released RundownLock')
	}

	const [rundown, collections] = await Promise.all([
		context.directCollections.Rundowns.findOne(rundownId),
		loadCollections(context, rundownId),
	])

	const res = new IngestModelImpl(context, rundownLock, rundownExternalId, rundown, ...collections)

	if (span) span.end()
	return res
}

async function loadCollections(context: JobContext, rundownId: RundownId) {
	return Promise.all([
		context.directCollections.Segments.findFetch({
			rundownId: rundownId,
			orphaned: { $ne: SegmentOrphanedReason.SCRATCHPAD },
		}),
		context.directCollections.Parts.findFetch({
			rundownId: rundownId,
		}),
		context.directCollections.Pieces.findFetch({
			startRundownId: rundownId,
		}),

		context.directCollections.AdLibPieces.findFetch({
			rundownId: rundownId,
		}),
		context.directCollections.AdLibActions.findFetch({
			rundownId: rundownId,
		}),

		context.directCollections.ExpectedMediaItems.findFetch({
			rundownId: rundownId,
		}) as Promise<ExpectedMediaItemRundown[]>,
		context.directCollections.ExpectedPlayoutItems.findFetch({
			rundownId: rundownId,
		}) as Promise<ExpectedPlayoutItemRundown[]>,
		context.directCollections.ExpectedPackages.findFetch({
			rundownId: rundownId,
		}) as Promise<ExpectedPackageFromRundown[]>,
	])
}
