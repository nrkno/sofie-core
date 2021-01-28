import { IBlueprintPieceGeneric, NoraContent } from '@sofie-automation/blueprints-integration'

export { createMosObjectXmlStringNoraBluePrintPiece }

function createMosObjectXmlStringNoraBluePrintPiece(piece: IBlueprintPieceGeneric): string {
	const noraContent = piece.content as NoraContent | undefined
	const noraPayload = noraContent?.payload
	if (!noraPayload) {
		throw new Error('Not a Nora blueprint piece')
	}

	const doc = objectToXML(
		{
			ncsItem: {
				item: {
					itemSlug: null,
					objID: piece.externalId,
					mosExternalMetadata: [
						{
							mosSchema: 'http://nora.core.mesosint.nrk.no/mos/content',
							mosPayload: {
								metadata: {
									selection: {
										design: {
											id: noraPayload.manifest,
										},
										type: {
											id: noraPayload.template.layer,
										},
										mal: {
											id: noraPayload.template.name,
										},
									},
									type: noraPayload.template.layer,
									userContext: {},
								},
								template: noraPayload.template,
								content: noraPayload.content,
							},
						},
						{
							mosSchema: 'http://nora.core.mesosint.nrk.no/mos/timing',
							mosPayload: {
								timeIn: 0,
								duration: noraContent.sourceDuration,
							},
						},
					],
				},
			},
		},
		'mos'
	)

	return new XMLSerializer().serializeToString(doc)
}

function objectToXML(obj: object, rootName: string): Document {
	const doc = new Document()
	const root = doc.createElement(rootName)

	addNodes(obj, root)

	doc.appendChild(root)
	return doc
}

function addNodes(obj: object, rootNode: Node): void {
	const doc = rootNode.ownerDocument
	if (!doc) {
		// this should never happen, given that this is an internal function
		// and that the rootNode is explicitly created from a document in
		// both objectToXML() and createNode(), who are the only callers of
		// this function
		throw new Error('Root node has no owner document.')
	}

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

function createNode(name: string, value: any, doc: Document) {
	const node = doc.createElement(name)

	if (typeof value === 'object' && value !== null) {
		addNodes(value, node)
	} else {
		node.textContent = value
	}

	return node
}
