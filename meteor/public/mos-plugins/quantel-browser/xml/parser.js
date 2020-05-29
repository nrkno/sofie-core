/**
 * Client side XML to JavaScript object conversion. Not exhaustive, might cut
 * corners to fit specific use cases.
 * Originally developed for use by the Quantel Browser Plugin in the Sofie TV Automation project.
 *
 * Note that this module relies on a globally available DOMParser, which
 * typically is a browser thing. For server side usage, xml2json is probably
 * what you want :)
 */
export { xmlStringToObject, xmlToObject }

/**
 * Convenience function for conversion from XML source strings.
 */
function xmlStringToObject(xmlString) {
	const domparser = new window.DOMParser()
	const doc = domparser.parseFromString(xmlString, 'text/xml')

	return xmlToObject(doc)
}

/**
 * Returns an object representing the XML documents.
 */
function xmlToObject(doc) {
	if (doc.firstChild) {
		return {
			[doc.firstChild.nodeName]: nodeToObj(doc.firstChild)
		}
	}

	return {}
}

function nodeToObj(node) {
	if (node.childNodes) {
		const obj = {}

		for (const n of node.childNodes) {
			const { nodeName } = n

			switch (nodeName) {
				case '#text':
					if (n.textContent && n.textContent.trim() !== '') {
						return n.textContent
					}
					break
				default:
					if (obj[nodeName]) {
						if (Array.isArray(obj[nodeName])) {
							obj[nodeName].push(nodeToObj(n))
						} else {
							obj[nodeName] = [obj[nodeName], nodeToObj(n)]
						}
					} else {
						obj[nodeName] = nodeToObj(n)
					}
			}
		}

		return obj
	}

	return {}
}
