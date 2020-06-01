export { objectToXml }

/**
 * Converts a JavaScript object (does not have to be JSON) to an XML document.
 *
 * Special syntax:
 * - properties that have a name starting with a @ will be created as attributes
 * - properties named #textContent will be created as text nodes
 *
 * @param {object} obj - a JavaScript object
 * @param {string} rootName - name for the XML document root node
 *
 * @returns {XMLDocument} - an XML document representation of the input object
 */
function objectToXml(obj, rootName) {
	const doc = new Document()
	const root = doc.createElement(rootName)

	addNodes(obj, root)

	doc.appendChild(root)
	return doc
}

function addNodes(obj, rootNode) {
	const doc = rootNode.ownerDocument

	for (const name of Object.keys(obj)) {
		const value = obj[name]

		if (Array.isArray(value)) {
			value.forEach((element) => {
				rootNode.appendChild(createNode(name, element, doc))
			})
		} else if (name.startsWith('@')) {
			rootNode.setAttribute(name.substring(1), String(value))
		} else {
			rootNode.appendChild(createNode(name, value, doc))
		}
	}
}

function createNode(name, value, doc) {
	if (name === '#textContent') {
		return doc.createTextNode(String(value))
	}

	const node = doc.createElement(name)

	if (typeof value === 'object' && value !== null) {
		addNodes(value, node)
	} else {
		node.textContent = value
	}

	return node
}

function createAttributeNode(name, value, doc) {
	const attribute = doc.createAttribute(name)
	attribute.value = String(value)

	return attribute
}
