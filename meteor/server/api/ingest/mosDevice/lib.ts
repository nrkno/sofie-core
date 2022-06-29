import { MOS } from '@sofie-automation/corelib'
import { Meteor } from 'meteor/meteor'

export function parseMosString(str: MOS.MosString128): string {
	if (!str) throw new Meteor.Error(401, 'parseMosString: str parameter missing!')
	return str['_str'] || str.toString()
}
