import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'
import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { DBRundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { StudioReadAccess } from '../security/studio'
import { OrganizationReadAccess } from '../security/organization'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'

meteorPublish(PubSub.rundownPlaylists, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.organizationId<DBRundownPlaylist>(this.userId, selector0, token)
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
		return RundownPlaylists.find(selector, modifier)
	}
	return null
})
