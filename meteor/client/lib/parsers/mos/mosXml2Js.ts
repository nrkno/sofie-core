import { IMOSObject, IMOSItem, MosString128, IMOSScope } from "mos-connection";

/**
 * Client side MOS XML to JavaScript object conversion. Not exhaustive, might cut
 * corners to fit specific use cases.
 * Originally developed for use by the Nora editor in the shelf inspector.
 * 
 * Note that this module relies on a globally available DOMParser, which
 * typically is a browser thing. For server side usage, xml2json is probably
 * what you want :)
 */
export { mosXmlString2Js, mosXml2Js }

const domparser = new DOMParser()

/**
 * Convenience function for conversion from XML source strings.
 */
function mosXmlString2Js(xmlString: string): object {
	const doc = domparser.parseFromString(xmlString, 'text/xml')

	return mosXml2Js(doc)
}

/**
 * Returns an object representing the MOS XML document.
 * Documents without a mos root node will not be parsed, and an
 * empty object will be returned.
 */
function mosXml2Js(doc: XMLDocument): object {
	if (doc.firstChild && doc.firstChild.nodeName === 'mos') {
		return {
			mos: nodeToObj(doc.firstChild)
		}
	}

	return {}
}

function nodeToObj(node: Node): object | string | null {
	if (node.childNodes) {
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
					obj[nodeName] = nodeToObj(n)
			}
		}

		return obj
	}

	return {}
}
