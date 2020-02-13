import { xmlStringToObject } from '../xml/parser.js'

export { parseXmlString, objectTypes, getObjectType }

const objectTypes = {
	MOS_NCS_ITEM_REQUEST: 'mos-ncsItemRequest',
	NOT_MOS: 'non-mos',
	MOS_UNKNOWN: 'mos-unknown'
}

function parseXmlString(xmlString) {
	const obj = xmlStringToObject(xmlString)
	const type = getObjectType(obj)

	return { type }
}

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
