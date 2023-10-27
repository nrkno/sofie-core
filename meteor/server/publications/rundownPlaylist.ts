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
