import { PubSub } from '../../lib/api/pubsub'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { OrganizationReadAccess } from '../security/organization'
import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'
import { StudioReadAccess } from '../security/studio'
import { AutoFillSelector, meteorPublish } from './lib'

meteorPublish(PubSub.rundownPlaylists, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	const modifier = {
		fields: {},
	}
	if (
		NoSecurityReadAccess.any() ||
		(selector.organizationId && OrganizationReadAccess.organizationContent(selector, cred)) ||
		(selector.studioId && StudioReadAccess.studioContent(selector, cred)) ||
		(selector._id && RundownPlaylistReadAccess.rundownPlaylist(selector, cred))
	) {
		return RundownPlaylists.find(selector, modifier)
	}
	return null
})
