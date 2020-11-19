import { PartInstance, PartInstanceId } from '../collections/PartInstances'
import { PieceInstance, PieceInstanceId } from '../collections/PieceInstances'
import { isProtectedString } from '../lib'

enum PlayoutTimelinePrefixes {
	PART_GROUP_PREFIX = 'part_group_',
	PART_GROUP_FIRST_ITEM_PREFIX = 'part_group_firstobject_',
	PIECE_GROUP_PREFIX = 'piece_group_',
	PIECE_GROUP_FIRST_ITEM_PREFIX = 'piece_group_firstobject_',
}

export function getPartGroupId(part: Pick<PartInstance, '_id'> | PartInstanceId) {
	if (isProtectedString(part)) {
		return PlayoutTimelinePrefixes.PART_GROUP_PREFIX + part
	}
	return PlayoutTimelinePrefixes.PART_GROUP_PREFIX + part._id
}
export function getPieceGroupId(piece: Pick<PieceInstance, '_id'> | PieceInstanceId) {
	if (isProtectedString(piece)) {
		return PlayoutTimelinePrefixes.PIECE_GROUP_PREFIX + piece
	}

	return PlayoutTimelinePrefixes.PIECE_GROUP_PREFIX + piece._id
}
export function getPartFirstObjectId(part: Pick<PartInstance, '_id'> | PartInstanceId) {
	if (isProtectedString(part)) {
		return PlayoutTimelinePrefixes.PART_GROUP_FIRST_ITEM_PREFIX + part
	}
	return PlayoutTimelinePrefixes.PART_GROUP_FIRST_ITEM_PREFIX + part._id
}
export function getPieceFirstObjectId(piece: Pick<PieceInstance, '_id'> | PieceInstanceId) {
	if (isProtectedString(piece)) {
		return PlayoutTimelinePrefixes.PIECE_GROUP_FIRST_ITEM_PREFIX + piece
	}

	return PlayoutTimelinePrefixes.PIECE_GROUP_FIRST_ITEM_PREFIX + piece._id
}
