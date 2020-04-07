import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'

export namespace RundownPlaylistSecurity {
	export function allowReadAccess (selector: object, token: string, context: any) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

RundownPlaylists.allow({
	insert (userId: string, doc: RundownPlaylist): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		// return true // tmp!
		return false
	},
	remove (userId, doc) {
		return false
	}
})
