import * as parser from 'xml2json'
import { NoraPayload } from 'tv-automation-sofie-blueprints-integration';

export { createMosObjectXmlStringFromPayload }

function createMosObjectXmlStringFromPayload(payload: NoraPayload): string {
	return parser.toXml({
		mos: {
			ncsItem: {
				item: {
					
				}
			}
		}
	})
}