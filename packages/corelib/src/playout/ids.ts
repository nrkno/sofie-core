import { PartInstanceId, PieceInstanceId } from '../dataModel/Ids'
import { DBPartInstance } from '../dataModel/PartInstance'
import { PieceInstance } from '../dataModel/PieceInstance'
import { isProtectedString } from '../protectedString'

enum PlayoutTimelinePrefixes {
	PART_GROUP_PREFIX = 'part_group_',
	PART_GROUP_FIRST_ITEM_PREFIX = 'part_group_firstobject_',
	PIECE_GROUP_PREFIX = 'piece_group_',
	PIECE_GROUP_FIRST_ITEM_PREFIX = 'piece_group_firstobject_',
}

export function getPartGroupId(part: Pick<DBPartInstance, '_id'> | PartInstanceId): string {
	if (isProtectedString(part)) {
		return PlayoutTimelinePrefixes.PART_GROUP_PREFIX + part
	}
	return PlayoutTimelinePrefixes.PART_GROUP_PREFIX + part._id
}
export function getPieceGroupId(piece: Pick<PieceInstance, '_id'> | PieceInstanceId): string {
	if (isProtectedString(piece)) {
		return PlayoutTimelinePrefixes.PIECE_GROUP_PREFIX + piece
	}

	return PlayoutTimelinePrefixes.PIECE_GROUP_PREFIX + piece._id
}
export function getPartFirstObjectId(part: Pick<DBPartInstance, '_id'> | PartInstanceId): string {
	if (isProtectedString(part)) {
		return PlayoutTimelinePrefixes.PART_GROUP_FIRST_ITEM_PREFIX + part
	}
	return PlayoutTimelinePrefixes.PART_GROUP_FIRST_ITEM_PREFIX + part._id
}
export function getPieceFirstObjectId(piece: Pick<PieceInstance, '_id'> | PieceInstanceId): string {
	if (isProtectedString(piece)) {
		return PlayoutTimelinePrefixes.PIECE_GROUP_FIRST_ITEM_PREFIX + piece
	}

	return PlayoutTimelinePrefixes.PIECE_GROUP_FIRST_ITEM_PREFIX + piece._id
}
