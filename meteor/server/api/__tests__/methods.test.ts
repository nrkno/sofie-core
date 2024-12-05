import '../../../__mocks__/_extendJest'
import { MeteorDebugMethods } from '../../methods'
import { Settings } from '../../Settings'
import { MeteorPromiseApply } from '../methods'
import { testInFiber } from '../../../__mocks__/helpers/jest'

testInFiber('MeteorPromiseApply', async () => {
	// set up method:
	Settings.enableUserAccounts = false
	MeteorDebugMethods({
		myMethod: async (value1: string, value2: string) => {
			// Do an async operation, to ensure that asynchronous operations work:
			const v = await new Promise((resolve) => {
				setTimeout(() => {
					resolve(value1 + value2)
				}, 10)
			})
			return v
		},
	})
	const pValue: any = MeteorPromiseApply('myMethod', ['myValue', 'AAA']).catch((e) => {
		throw e
	})
	expect(pValue).toHaveProperty('then') // be a promise
	const value = await pValue
	expect(value).toEqual('myValueAAA')
})
