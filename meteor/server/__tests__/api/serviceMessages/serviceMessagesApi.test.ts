import { readAllMessages } from '../../../api/serviceMessages/serviceMessagesApi'
import { getCoreSystem } from '../../../../lib/collections/CoreSystem'

jest.mock('../../../../lib/collections/CoreSystem')

describe('Service messages internal API', () => {
	describe('readAllMessages', () => {
		it('should throw when core system object cant be accessed', () => {
			const cs = getCoreSystem()

			console.log(cs ? cs.serviceMessages : 'not found')
		})
	})
})
