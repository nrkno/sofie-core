export { objectToXml }

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
		} else {
			rootNode.appendChild(createNode(name, value, doc))
		}
	}
}

function createNode(name, value, doc) {
	if (name.startsWith('@')) {
		return createAttributeNode(name, value, doc)
	}

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
