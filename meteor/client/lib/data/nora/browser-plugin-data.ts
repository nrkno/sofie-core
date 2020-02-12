import { NoraPayload, IBlueprintPieceGeneric } from 'tv-automation-sofie-blueprints-integration'
import { isArray } from 'util';

export { createMosObjectXmlStringNoraBluePrintPiece }

function createMosObjectXmlStringNoraBluePrintPiece(piece: IBlueprintPieceGeneric): string {
	if (!piece.content || !piece.content.payload) {
		throw new Error('Not a Nora blueprint piece')
	}

	const noraPayload = piece.content.payload as NoraPayload

	const doc = objectToXML({
		ncsItem: {
			item: {
				itemSlug: null,
				objID: piece.externalId,
				mosExternalMetadata: [{
					mosSchema: 'http://nora.core.mesosint.nrk.no/mos/content',
					mosPayload: {
						metadata: {
							selection: {
								design: {
									id: noraPayload.manifest
								},
								type: {
									id: noraPayload.template.layer
								},
								mal: {
									id: noraPayload.template.name
								}
							},
							type: noraPayload.template.layer,
							userContext: {}
						},
						template: noraPayload.template,
						content: noraPayload.content
					}
				}, {
					mosSchema: 'http://nora.core.mesosint.nrk.no/mos/timing',
					mosPayload: {
						timeIn: 0,
						duration: piece.content.sourceDuration
					}
				}]
			},
		}
	}, 'mos'
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

	for (const name of Object.keys(obj)) {
		const value = obj[name]

		if (isArray(value)) {
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
