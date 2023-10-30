import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'
import { meteorPublish, AutoFillSelector } from './lib'
import { StudioReadAccess } from '../security/studio'
import { OrganizationReadAccess } from '../security/organization'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownPlaylists } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { resolveCredentials } from '../security/lib/credentials'

meteorPublish(
	CorelibPubSub.rundownPlaylists,
	async function (selector0: MongoQuery<DBRundownPlaylist>, token: string | undefined) {
		const { cred, selector } = await AutoFillSelector.organizationId<DBRundownPlaylist>(
			this.userId,
			selector0,
			token
		)
		const modifier = {
			fields: {},
		}
		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.organizationId &&
				(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
			(selector.studioId && (await StudioReadAccess.studioContent(selector.studioId, cred))) ||
			(isProtectedString(selector._id) && (await RundownPlaylistReadAccess.rundownPlaylist(selector._id, cred)))
		) {
			return RundownPlaylists.findWithCursor(selector, modifier)
		}
		return null
	}
)

meteorPublish(MeteorPubSub.activeRundownPlaylistForStudio, async function (studioId: StudioId) {
	if (!NoSecurityReadAccess.any()) {
		const cred = await resolveCredentials({ userId: this.userId })
		if (!cred) return null

		if (!(await StudioReadAccess.studioContent(studioId, cred))) return null
	}

	return RundownPlaylists.findWithCursor(
		{ studioId },
		{
			// Ensure the result is 'stable' and only produces one (there should only ever be one)
			sort: {
				_id: 1,
			},
			limit: 1,
		}
	)
})
