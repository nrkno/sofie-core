import { createMosObjectXmlStringNoraBluePrintPiece, createMosAppInfoXmlString } from '../browser-plugin-data'
import * as parser from 'xml2json'
import { NoraPayload, IBlueprintPieceGeneric, NoraContent } from 'tv-automation-sofie-blueprints-integration';

const superPayload: NoraPayload = {
	"manifest": "nyheter",
	"template": {
		"layer": "super",
		"name": "01_navn",
		"event": "take"
	},
	"metadata": {
		"templateName": "01 navn",
		"templateVariant": "Ett navn"
	},
	"content": {
		"navn": "Petter Blomkvist",
		"tittel": "regiondirektør, Entreprenørforeningen",
		"_valid": true
	}
}

const bakskjermPayload: NoraPayload = {
	"manifest": "nyheter",
	"template": {
		"layer": "bakskjerm",
		"name": "202_bilde",
		"event": "take"
	},
	"metadata": {
		"templateName": "202 Bilde",
		"templateVariant": ""
	},
	"content": {
		"bilde": {
			"credit": "",
			"title": "jente-bygg og anlegg",
			"w": 1,
			"format": "image/jpeg",
			"width": 1920,
			"text": 0,
			"x": 0,
			"h": 1,
			"y": 0,
			"id": "-lHEKEkn5Hwlvc4jk9Nx8g",
			"type": "image/jpeg",
			"uri": "-lHEKEkn5Hwlvc4jk9Nx8gV7eL0rd5M_mxrv3XlaDMTg",
			"quality": 0.9,
			"height": 1080,
			"url": "https://gfx.nrk.no/-lHEKEkn5Hwlvc4jk9Nx8gV7eL0rd5M_mxrv3XlaDMTg"
		},
		"_valid": true
	}
}

const superContent: NoraContent = {
	sourceDuration: 5000,
	payload: superPayload,
	timelineObjects: []
}

const bakskjermContent: NoraContent = {
	sourceDuration: 0,
	payload: bakskjermPayload,
	timelineObjects: []
}

const noraSuperPiece: IBlueprintPieceGeneric = {
	externalId: 'bb19514d-44d7-4521-ad17-ea658b12e149',
	name: 'names dont matter',
	sourceLayerId: 'dont know if this matters yet',
	outputLayerId: 'dont know if this matters yet either',
	content: superContent
}

const noraBakskjermPiece: IBlueprintPieceGeneric = {
	externalId: 'bb19514d-4521-44d7-ad17-ea658b12e149',
	name: 'names still dont matter',
	sourceLayerId: 'who knows if this matters yet',
	outputLayerId: 'who really knows if this matters?',
	content: bakskjermContent
}

describe('createMosObjectXmlStringNoraBluePrintPiece', () => {
	describe('Input validation', () => {
		it('should throw when piece doesnt have content', () => {
			const piece = Object.assign({}, noraSuperPiece)
			delete piece.content

			expect(() => {
				createMosObjectXmlStringNoraBluePrintPiece(piece)
			}).toThrow()
		})

		it('should throw when piece content doesnt have a payload', () => {
			const piece = Object.assign({}, noraSuperPiece, {
				content: {}
			})

			expect(() => {
				createMosObjectXmlStringNoraBluePrintPiece(piece)
			}).toThrow()
		})
	})

	describe('output', () => {
		const superXmlString = createMosObjectXmlStringNoraBluePrintPiece(noraSuperPiece)
		const bakskjermXmlString = createMosObjectXmlStringNoraBluePrintPiece(noraBakskjermPiece)

		it.each([ [ 'superXmlString', superXmlString ], [ 'bakskjermXmlString', bakskjermXmlString ] ])('%s: should return a string that is a valid XML document', (typeName, xmlString) => {
			expect(typeof xmlString).toEqual('string')
			parser.toJson(xmlString) // will throw if invalid
		})

		describe('XML content', () => {
			const superDocument: any = parser.toJson(superXmlString, { object: true })
			const bakskjermDocument: any = parser.toJson(bakskjermXmlString, { object: true })

			const documents = [
				[ 'superDocument', superDocument , noraSuperPiece],
				[ 'bakskjermDocument', bakskjermDocument, noraBakskjermPiece ]
			]


			describe.each(documents)('%s: shared content', (typeName, doc, sourceObj) => {
				describe('basic XML document structure', () => {
					it('the root node should be named mos', () => {
						const nodeNames = Object.keys(doc)

						expect(nodeNames.length).toEqual(1)
						expect(nodeNames[ 0 ]).toEqual('mos')
					})

					it('the root node should contain a single ncsItem node', () => {
						const nodeNames = Object.keys(doc.mos)

						expect(nodeNames.length).toEqual(1)
						expect(nodeNames[ 0 ]).toEqual('ncsItem')
					})

					it('the ncsItem node should contain a single item node', () => {
						const nodeNames = Object.keys(doc.mos.ncsItem)

						expect(nodeNames.length).toEqual(1)
						expect(nodeNames[ 0 ]).toEqual('item')
					})
				})

				describe('item node', () => {
					const itemNode = doc.mos.ncsItem.item

					test.todo('itemID node should contain the ENPS item id')

					it('itemSlug node should be empty', () => {
						const itemSlugNode = itemNode.itemSlug

						expect(itemSlugNode).toEqual({})
					})

					it('objID should containg the external id from the piece', () => {
						const expected = sourceObj.externalId

						const actual = itemNode.objID

						expect(actual).toEqual(expected)
					})

					describe('mosExternalMetadata node 0 (content)', () => {
						const mosExternalMetadata = itemNode.mosExternalMetadata[ 0 ]

						it('mosSchema node should use URL for Nora content', () => {
							const expected = 'http://nora.core.mesosint.nrk.no/mos/content'

							const actual = mosExternalMetadata.mosSchema

							expect(actual).toEqual(expected)
						})

						describe('mosPayload node', () => {
							const mosPayload = mosExternalMetadata.mosPayload

							test.todo('uuid node should contain...')

							describe('metadata node', () => {
								const metadata = mosPayload.metadata

								describe('selection node', () => {
									const selection = metadata.selection

									describe('design node', () => {
										const design = selection.design

										it('id node should equal input manifest property', () => {
											const expected = sourceObj.content.payload.manifest

											const actual = design.id

											expect(actual).toEqual(expected)
										})
									})

									describe('type node', () => {
										const type = selection.type

										it('id node should equal input template layer', () => {
											const expected = sourceObj.content.payload.template.layer

											const actual = type.id

											expect(actual).toEqual(expected)
										})
									})

									describe('mal node', () => {
										const mal = selection.mal

										it('id node should equal template name', () => {
											const expected = sourceObj.content.payload.template.name

											const actual = mal.id

											expect(actual).toEqual(expected)
										})
									})
								})

								it('type node should equal template layer', () => {
									const expected = sourceObj.content.payload.template.layer

									const actual = metadata.type

									expect(actual).toEqual(expected)
								})

								it('userContext node should be empty', () => {
									const actual = metadata.userContext

									expect(actual).toEqual({})
								})
							})

							describe('template node', () => {
								const template = mosPayload.template

								it('name node should equal payload template name ', () => {
									const expected = sourceObj.content.payload.template.name

									const actual = template.name

									expect(actual).toEqual(expected)
								})

								it('layer node should equal payload template layer ', () => {
									const expected = sourceObj.content.payload.template.layer

									const actual = template.layer

									expect(actual).toEqual(expected)
								})
							})	
						})
					})

					describe('mosExternalMetadata node 1 (timing)', () => {
						const mosExternalMetadata = itemNode.mosExternalMetadata[ 1 ]

						it('mosSchema should use URL for Nora timing', () => {
							const expected = 'http://nora.core.mesosint.nrk.no/mos/timing'

							const actual = mosExternalMetadata.mosSchema

							expect(actual).toEqual(expected)
						})

						describe('mosPayload', () => {
							const mosPayload = mosExternalMetadata.mosPayload

							it('should set timeIn to 0', () => {
								const expected = String(0) // XML content will always be a string

								const actual = mosPayload.timeIn

								expect(actual).toEqual(expected)
							})

							it('should set duration to value of piece.content.sourceDuration', () => {
								const expected = String(sourceObj.content.sourceDuration) // XML content will always be a string

								const actual = mosPayload.duration

								expect(actual).toEqual(expected)
							})
						})
					})
				})

			})

			describe('item node - super specific content', () => {
				const itemNode = superDocument.mos.ncsItem.item

				describe('mosExternalMetadata node 0 (content)', () => {
					const mosExternalMetadata = itemNode.mosExternalMetadata[ 0 ]

					describe('mosPayload node', () => {
						const mosPayload = mosExternalMetadata.mosPayload

						describe('content node', () => {
							const content = mosPayload.content

							it('navn node should equal content navn', () => {
								const expected = superPayload.content.navn

								const actual = content.navn

								expect(actual).toEqual(expected)
							})

							it('tittel node should equal content tittel', () => {
								const expected = superPayload.content.tittel

								const actual = content.tittel

								expect(actual).toEqual(expected)
							})

							it('_valid node should equal content _valid', () => {
								// since we're going via XML, the result will come back as a string
								const expected = String(superPayload.content._valid)

								const actual = content._valid

								expect(actual).toEqual(expected)
							})
						})
					})
				})
			})

			describe('item node - bakskjerm specific content', () => {
				const itemNode = bakskjermDocument.mos.ncsItem.item

				describe('mosExternalMetadata node 0 (content)', () => {
					const mosExternalMetadata = itemNode.mosExternalMetadata[ 0 ]

					describe('mosPayload node', () => {
						const mosPayload = mosExternalMetadata.mosPayload

						describe('content node', () => {
							const content = mosPayload.content

							describe('bilde node', () => {
								const bilde = content.bilde

								it('title node should equal content title', () => {
									const expected = bakskjermPayload.content.bilde['title']
		
									const actual = bilde.title

									expect(actual).toEqual(expected)
								})
							})

							it('_valid node should equal content _valid', () => {
								// since we're going via XML, the result will come back as a string
								const expected = String(bakskjermPayload.content._valid)
	
								const actual = content._valid

								expect(actual).toEqual(expected)
							})
						})
					})
				})
			})
		})
	})
})

describe('createMosAppInfoXmlString', () => {
	const xmlString = createMosAppInfoXmlString()

	it('should return a string that is a valid XML document', () => {
		expect(typeof xmlString).toEqual('string')
		parser.toJson(xmlString) // will throw if invalid
	})

	describe('XML document', () => {
		const doc: any = parser.toJson(xmlString, { object: true })

		it('the root node should be named mos', () => {
			const nodeNames = Object.keys(doc)

			expect(nodeNames.length).toEqual(1)
			expect(nodeNames[ 0 ]).toEqual('mos')
		})

		describe('mos node contents', () => {
			const mos = doc.mos

			//TODO: this should either be the official Sofie name or possibly the instance name?
			it('node ncsID should be sofie-core', () => {
				const expected = 'sofie-core'

				const actual = mos.ncsID

				expect(actual).toEqual(expected)
			})

			//TODO: this is completely bogus. The Nora plugin doesn't actually check the values
			describe('node ncsAppInfo', () => {
				const ncsAppInfo = mos.ncsAppInfo
				describe('node ncsInformation', () => {
					const ncsInformation = ncsAppInfo.ncsInformation

					it('node userID should contain something', () => {
						const actual = ncsInformation.userID

						expect(actual).toEqual(expect.anything())
					})

					it('node software should contain something', () => {
						const actual = ncsInformation.software

						expect(actual).toEqual(expect.anything())
					})
				})
			})
		})
	})

})