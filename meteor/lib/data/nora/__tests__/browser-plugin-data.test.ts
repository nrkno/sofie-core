import {createMosObjectXmlStringFromPayload} from '../browser-plugin-data'
import * as parser from 'xml2json'

const superPayload =   {
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


describe('createMosObjectXmlStringFromPayload', () => {
	const toXML = createMosObjectXmlStringFromPayload
	const result = toXML(superPayload)

	it('should return a string that is a valid XML document', () => {
		expect(typeof result).toEqual('string')
		parser.toJson(result) // will throw if invalid
	})

	describe('basic XML document structure', () => {
		const doc:any = parser.toJson(result, {object: true})

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

	describe('item node content', () => {
		const doc:any = parser.toJson(result, {object: true})
		const itemNode = doc.mos.ncsItem.item

		describe('itemID', () => {
			test.todo('should contain the ENPS item id')
		})
		
		describe('itemSlug', () => {
			it('should be empty', () => {
				const itemSlugNode = itemNode.itemSlug

				expect(itemSlugNode).not.toBeDefined()
			})
		})
	})
})
