import { IMOSObject, IMOSItem, MosString128, IMOSScope, MosTime, MosDuration } from "mos-connection";
import { Parser as MosParser } from 'mos-connection/dist/mosModel/Parser'
import * as _ from 'underscore'

/**
 * Client side MOS XML to JavaScript object conversion. Not exhaustive, might cut
 * corners to fit specific use cases.
 * Originally developed for use by the Nora editor in the shelf inspector.
 * 
 * Note that this module relies on a globally available DOMParser, which
 * typically is a browser thing. For server side usage, xml2json is probably
 * what you want :)
 */

const domparser = new DOMParser()

/** Copied from mos-gateway */
export function fixMosData (o: any): any {
	if (
		_.isObject(o) && (
		o instanceof MosTime ||
		o instanceof MosDuration ||
		o instanceof MosString128
	)) {
		return o.toString()
	}
	if (_.isArray(o)) {
		return _.map(o, (val) => {
			return fixMosData(val)
		})
	} else if (_.isObject(o)) {
		let o2: any = {}
		_.each(o, (val, key) => {
			o2[key] = fixMosData(val)
		})
		return o2
	} else {
		return o
	}
}

export interface MosPluginMessage {
	ncsReqAppInfo?: boolean
	item?: IMOSItem
}

export function parseMosPluginMessageXml(xmlString: string): MosPluginMessage | undefined {
	const doc = nodeToObj(domparser.parseFromString(xmlString, 'text/xml')) as any

	if (doc && doc.mos) {
		const res: MosPluginMessage = {}
		if (doc.mos.ncsReqAppInfo) {
			res.ncsReqAppInfo = true
		}

		if (doc.mos.ncsItem && doc.mos.ncsItem.item) {
			res.item = MosParser.xml2Item(doc.mos.ncsItem.item)
		}

		return res
	} else {
		return undefined
	}
}

function nodeToObj(node: Node): object | string | null {
	if (node.childNodes && node.childNodes.length) {
		const obj = {}

		for (const n of node.childNodes) {
			const { nodeName } = n

			switch (nodeName) {
				case '#text':
					const { textContent } = n
					if (textContent && textContent.trim() !== '') {
						return textContent
					}
					break
				default:
					const child = nodeToObj(n)
					if (obj.hasOwnProperty(nodeName)) {
						if (_.isArray(obj[nodeName])) {
							obj[nodeName].push(child)
						} else {
							obj[nodeName] = [obj[nodeName], child]
						}

					} else  {
						obj[nodeName] = child
					}
			}
		}

		return obj
	}

	return ""
}

export function generateMosPluginItemXml(item: IMOSItem): string {
	const tmpItem = {
		...item
	}
	if (item.MosExternalMetaData) {
		tmpItem.MosExternalMetaData = item.MosExternalMetaData.map((md) => {
			return {
				mosScope: md.MosScope,
				mosSchema: md.MosSchema,
				mosPayload: md.MosPayload
			}
		}) as any
	}

	const builder = MosParser.item2xml(tmpItem)
	return `<mos><ncsItem>${builder.toString()}</ncsItem></mos>`
}
