
import { CoreConnection } from '../coreConnection'

test('CoreConnection credentials', () => {

	let cred0 = CoreConnection.getCredentials('test')
	expect(cred0).toBeTruthy()

	let cred1 = CoreConnection.getCredentials('test2')
	expect(cred1).toBeTruthy()
	expect(cred1).not.toEqual(cred0)

	let cred2 = CoreConnection.getCredentials('test')
	expect(cred2).toBeTruthy()
	expect(cred2).toEqual(cred0)

	CoreConnection.deleteCredentials('test2')
	let cred3 = CoreConnection.getCredentials('test2')
	expect(cred3).toBeTruthy()
	expect(cred3).not.toEqual(cred1)
})
