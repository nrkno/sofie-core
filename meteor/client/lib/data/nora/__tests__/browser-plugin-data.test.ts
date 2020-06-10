import { createMosObjectXmlStringFromPayload } from '../browser-plugin-data'
import * as parser from 'xml2json'

const superPayload = {
	manifest: 'nyheter',
	template: {
		layer: 'super',
		name: '01_navn',
		event: 'take',
	},
	metadata: {
		templateName: '01 navn',
		templateVariant: 'Ett navn',
	},
	content: {
		navn: 'Petter Blomkvist',
		tittel: 'regiondirektør, Entreprenørforeningen',
		_valid: true,
	},
}

describe.skip('createMosObjectXmlStringFromPayload', () => {
	const result = createMosObjectXmlStringFromPayload(superPayload)

	it('should return a string that is a valid XML document', () => {
		expect(typeof result).toEqual('string')
		parser.toJson(result) // will throw if invalid
	})

	describe('basic XML document structure', () => {
		const doc: any = parser.toJson(result, { object: true })

		it('the root node should be named mos', () => {
			const nodeNames = Object.keys(doc)

			expect(nodeNames.length).toEqual(1)
			expect(nodeNames[0]).toEqual('mos')
		})

		it('the root node should contain a single ncsItem node', () => {
			const nodeNames = Object.keys(doc.mos)

			expect(nodeNames.length).toEqual(1)
			expect(nodeNames[0]).toEqual('ncsItem')
		})

		it('the ncsItem node should contain a single item node', () => {
			const nodeNames = Object.keys(doc.mos.ncsItem)

			expect(nodeNames.length).toEqual(1)
			expect(nodeNames[0]).toEqual('item')
		})
	})

	describe('item node', () => {
		const doc: any = parser.toJson(result, { object: true })
		const itemNode = doc.mos.ncsItem.item

		test.todo('itemID node should contain the ENPS item id')

		it('itemSlug node should be empty', () => {
			const itemSlugNode = itemNode.itemSlug

			expect(itemSlugNode).toEqual({})
		})

		describe('mosExternalMetadata node ()', () => {
			const mosExternalMetadata = itemNode.mosExternalMetadata

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
								const expected = superPayload.manifest

								const actual = design.id

								expect(actual).toEqual(expected)
							})
						})

						describe('type node', () => {
							const type = selection.type

							it('id node should equal input template layer', () => {
								const expected = superPayload.template.layer

								const actual = type.id

								expect(actual).toEqual(expected)
							})
						})

						describe('mal node', () => {
							const mal = selection.mal

							it('id node should equal template name', () => {
								const expected = superPayload.template.name

								const actual = mal.id

								expect(actual).toEqual(expected)
							})
						})
					})

					it('type node should equal template layer', () => {
						const expected = superPayload.template.layer

						const actual = metadata.type

						expect(actual).toEqual(expected)
					})

					it('userContext node should be empty', () => {
						const actual = metadata.userContext

						expect(actual).toEqual({})
					})
				})

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
})
