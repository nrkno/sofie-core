import { createMosAppInfoXmlString } from "../plugin-support"
import * as parser from 'xml2json'

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