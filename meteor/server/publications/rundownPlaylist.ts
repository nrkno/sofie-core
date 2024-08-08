import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'
import { meteorPublish, AutoFillSelector } from './lib'
import { StudioReadAccess } from '../security/studio'
import { OrganizationReadAccess } from '../security/organization'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownPlaylists } from '../collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { resolveCredentials } from '../security/lib/credentials'
import { check, Match } from '../../lib/check'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

meteorPublish(
	CorelibPubSub.rundownPlaylists,
	async function (
		rundownPlaylistIds: RundownPlaylistId[] | null,
		studioIds: StudioId[] | null,
		token: string | undefined
	) {
		check(rundownPlaylistIds, Match.Maybe(Array))
		check(studioIds, Match.Maybe(Array))

		// If values were provided, they must have values
		if (rundownPlaylistIds && rundownPlaylistIds.length === 0) return null
		if (studioIds && studioIds.length === 0) return null

		const { cred, selector } = await AutoFillSelector.organizationId<DBRundownPlaylist>(this.userId, {}, token)

		// Add the requested filter
		if (rundownPlaylistIds) selector._id = { $in: rundownPlaylistIds }
		if (studioIds) selector.studioId = { $in: studioIds }

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.organizationId &&
				(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
			(selector.studioId && (await StudioReadAccess.studioContent(selector.studioId, cred))) ||
			(isProtectedString(selector._id) && (await RundownPlaylistReadAccess.rundownPlaylist(selector._id, cred)))
		) {
			return RundownPlaylists.findWithCursor(selector)
		}
		return null
	}
)

meteorPublish(MeteorPubSub.rundownPlaylistForStudio, async function (studioId: StudioId, isActive: boolean) {
	if (!NoSecurityReadAccess.any()) {
		const cred = await resolveCredentials({ userId: this.userId })
		if (!cred) return null

		if (!(await StudioReadAccess.studioContent(studioId, cred))) return null
	}

	const selector: MongoQuery<DBRundownPlaylist> = {
		studioId,
	}

	if (isActive) {
		selector.activationId = { $exists: true }
	} else {
		selector.activationId = { $exists: false }
	}

	return RundownPlaylists.findWithCursor(selector)
})
