import { isArray } from 'util';

export function createMosAppInfoXmlString ():string {
	const doc = objectToXML({

		//TODO: this is a hardcoded placeholder just to have something.
		// The Nora plugin doesn't actually check the value or use it for anything
		// the values might possibly be the same used to fill out a userContext node
		ncsID: 'sofie-core',
			ncsAppInfo: {
				ncsInformation: {
				//TODO: this is completely bogus. The Nora plugin doesn't actually check the values
					userID: 'sofie system',
					software: 'sofie-core'
				}
			}	
		},
		'mos')

	return new XMLSerializer().serializeToString(doc)
}

export function objectToXML (obj: object, rootName: string): Document {
	const doc = new Document()
	const root = doc.createElement(rootName)

	addNodes(obj, root)

	doc.appendChild(root)
	return doc
}

function addNodes (obj: object, rootNode: Node): void {
	const doc = rootNode.ownerDocument

	for (const name of Object.keys(obj)) {
		const value = obj[ name ]

		if(isArray(value)) {
			value.forEach((element) => {
				rootNode.appendChild(createNode(name, element, doc))
			})
		} else {
			rootNode.appendChild(createNode(name, value, doc))
		}
	}
}

function createNode(name:string, value:any, doc:Document) {
	const node = doc.createElement(name)

	if (typeof value === 'object' && value !== null) {
		addNodes(value, node)
	} else {
		node.textContent = value
	}

	return node
}