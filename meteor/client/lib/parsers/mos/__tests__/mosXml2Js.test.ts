import {mosXml2Js} from '../mosXml2Js'
import {readFileSync} from 'fs'
import {join} from 'path'
import * as parser from 'xml2json'

const mosReqAppInfoXmlString = readFileSync(join(__dirname, './mosReqAppInfo.xml'), 'utf-8')
const domParser = new DOMParser()

describe('MOS XML to JavaScript object parser', () => {
	describe('mosXml2Js', () => {
		it('should return an object', () => {
			const doc = domParser.parseFromString('<root />', 'text/xml')

			const actual = mosXml2Js(doc)

			expect(actual).toBeInstanceOf(Object)
		})
		
		describe('ReqAppInfo', () => {
			const doc = domParser.parseFromString(mosReqAppInfoXmlString, 'text/xml')

			it('should contain an empty ncsReqAppInfo node', () => {
				const expected = {mos: {ncsReqAppInfo: {}}}
	
				const actual = mosXml2Js(doc)

				expect(actual).toEqual(expected)
			}) 
		})
	})
})
