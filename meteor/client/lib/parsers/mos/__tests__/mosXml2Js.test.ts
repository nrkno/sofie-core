import {parseMosPluginMessageXml, fixMosData, generateMosPluginItemXml} from '../mosXml2Js'
import {readFileSync} from 'fs'
import {join} from 'path'
import * as parser from 'xml2json'

const mosReqAppInfoXmlString = readFileSync(join(__dirname, './mosReqAppInfo.xml'), 'utf-8')
const domParser = new DOMParser()

describe('MOS XML to JavaScript object parser', () => {
	describe('mosXml2Js', () => {
		// it('should return an object', () => {
		// 	const doc = domParser.parseFromString('<root />', 'text/xml')

		// 	const actual = mosXml2Js(doc)

		// 	expect(actual).toBeInstanceOf(Object)
		// })
		
		// describe('ReqAppInfo', () => {
		// 	const doc = domParser.parseFromString(mosReqAppInfoXmlString, 'text/xml')

		// 	it('should contain an empty ncsReqAppInfo node', () => {
		// 		const expected = {mos: {ncsReqAppInfo: {}}}
	
		// 		const actual = mosXml2Js(doc)

		// 		expect(actual).toEqual(expected)
		// 	}) 
		// })
		
		describe('Sample1', () => {
			const sample1XmlStr = readFileSync(join(__dirname, './mosSample1.xml'), 'utf-8')
			const sample1JsonStr = readFileSync(join(__dirname, './mosSample1.json'), 'utf-8')

			const jsonDoc = JSON.parse(sample1JsonStr)

			it('should match the json representation', () => {
				const actual = parseMosPluginMessageXml(sample1XmlStr);
				const actualJson = actual && fixMosData(actual.item) // Strip out any MosString etc

				expect(actualJson).toEqual(jsonDoc)
			})

			it('converting via xml should be lossless', () => {
				const generatedXml = generateMosPluginItemXml(jsonDoc)
				const actual = parseMosPluginMessageXml(generatedXml);
				const actualJson = actual && fixMosData(actual.item) // Strip out any MosString etc

				expect(actualJson).toEqual(jsonDoc)
			})
		})
	})
})
