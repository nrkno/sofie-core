import { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

export function wrapPartToTemporaryInstance(
	playlistActivationId: RundownPlaylistActivationId,
	part: DBPart
): DBPartInstance {
	return {
		_id: protectString(`${part._id}_tmp_instance`),
		rundownId: part.rundownId,
		segmentId: part.segmentId,
		playlistActivationId,
		segmentPlayoutId: protectString(''), // Only needed when stored in the db, and filled in nearer the time
		takeCount: -1,
		rehearsal: false,
		part: part,
	}
}
