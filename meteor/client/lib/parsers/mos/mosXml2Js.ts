import * as MOS from '@mos-connection/helper'
import * as XMLBuilder from 'xmlbuilder'

/**
 * Client side MOS XML to JavaScript object conversion. Not exhaustive, might cut
 * corners to fit specific use cases.
 * Originally developed for use by the Nora editor in the shelf inspector.
 */

/** Copied from mos-gateway */
const MOS_DATA_IS_STRICT = true
const mosTypes = MOS.getMosTypes(MOS_DATA_IS_STRICT)
export function fixMosData(o: any): any {
	if (mosTypes.mosTime.is(o)) return mosTypes.mosTime.stringify(o)
	if (mosTypes.mosDuration.is(o)) return mosTypes.mosDuration.stringify(o)
	if (mosTypes.mosString128.is(o)) return mosTypes.mosString128.stringify(o)

	if (Array.isArray(o)) {
		return o.map((val) => {
			fixMosData(val)
		})
	} else if (typeof o === null) {
		return null
	} else if (typeof o === 'object') {
		const o2: any = {}
		for (const [key, value] of Object.entries(o)) {
			o2[key] = fixMosData(value)
		}
		return o2
	} else {
		return o
	}
}

export interface MosPluginMessage {
	ncsReqAppInfo?: boolean
	item?: MOS.IMOSItem
}

export function parseMosPluginMessageXml(xmlString: string): MosPluginMessage | undefined {
	const doc: any = MOS.xml2js(xmlString)

	if (doc && doc.mos) {
		const res: MosPluginMessage = {}
		if (doc.mos.ncsReqAppInfo) {
			res.ncsReqAppInfo = true
		}

		if (doc.mos.ncsItem && doc.mos.ncsItem.item) {
			res.item = MOS.MosModel.XMLMosItem.fromXML(doc.mos.ncsItem.item, MOS_DATA_IS_STRICT)
		}

		return res
	} else {
		return undefined
	}
}

export function generateMosPluginItemXml(item: MOS.IMOSItem): string {
	const builder = XMLBuilder.create('ncsItem')
	MOS.MosModel.XMLMosItem.toXML(builder, item, MOS_DATA_IS_STRICT)
	return `<mos>${builder.toString()}</mos>`
}
