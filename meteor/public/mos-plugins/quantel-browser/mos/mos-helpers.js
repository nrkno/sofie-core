export { objectTypes, getObjectType }

/**
 * A map of MOS object types as string identifiers.
 */
const objectTypes = {
	MOS_NCS_ITEM_REQUEST: 'ncsItemRequest',
	NOT_MOS: 'non-mos',
	MOS_UNKNOWN: 'mos-unknown'
}

/**
 * Determine MOS object type for a JSON object. Uses really simple detection of
 * the second level node name (the level below the root mos node).
 *
 * @param {object} obj
 *
 * @returns {string} - a string constant representing the MOS object type
 */
function getObjectType(obj) {
	if (Object.keys(obj)[0] !== 'mos') {
		// not a mos object
		return objectTypes.NOT_MOS
	}

	switch (Object.keys(obj.mos)[0]) {
		case objectTypes.MOS_NCS_ITEM_REQUEST:
			return objectTypes.MOS_NCS_ITEM_REQUEST
		default:
			return objectTypes.MOS_UNKNOWN
	}
}
