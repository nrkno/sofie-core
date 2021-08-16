import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { JobContext } from '../../jobs'

export async function getSelectedPartInstances(
	context: JobContext,
	playlist: DBRundownPlaylist
): Promise<{
	currentPartInstance: DBPartInstance | null
	nextPartInstance: DBPartInstance | null
	previousPartInstance: DBPartInstance | null
}> {
	const [currentPartInstance, nextPartInstance, previousPartInstance] = await Promise.all([
		playlist.currentPartInstanceId
			? await context.directCollections.PartInstances.findOne(playlist.currentPartInstanceId)
			: null,
		playlist.nextPartInstanceId
			? await context.directCollections.PartInstances.findOne(playlist.nextPartInstanceId)
			: null,
		playlist.previousPartInstanceId
			? await context.directCollections.PartInstances.findOne(playlist.previousPartInstanceId)
			: null,
	])

	if (currentPartInstance === undefined)
		throw new Error(`Missing currentPartInstance "${playlist.currentPartInstanceId}"`)
	if (nextPartInstance === undefined) throw new Error(`Missing currentPartInstance "${playlist.nextPartInstanceId}"`)
	if (previousPartInstance === undefined)
		throw new Error(`Missing currentPartInstance "${playlist.previousPartInstanceId}"`)

	return { currentPartInstance, nextPartInstance, previousPartInstance }
}
