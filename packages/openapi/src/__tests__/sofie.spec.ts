// eslint-disable-next-line node/no-missing-import
import { Configuration, SofieApi } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false
const testServer = process.env.SERVER_TYPE === 'TEST'

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.ACTIONS_URL,
		middleware: httpLogging ? [new Logging()] : [],
	})

	beforeAll(async () => await checkServer(config))

	const sofieApi = new SofieApi(config)
	test('can request current version of Sofie application', async () => {
		const sofieVersion = await sofieApi.index()
		expect(sofieVersion.success).toBe(200)
		expect(sofieVersion.result.version).toMatch(/^(\d+\.)?(\d+\.)?(\d+)/)
	})

	test('fails to assign a system blueprint with null id', async () => {
		await expect(sofieApi.assignSystemBlueprint({ assignSystemBlueprintRequest: null })).rejects.toThrow()
	})

	if (testServer) {
		test('can assign a blueprint for Sofie Core', async () => {
			const sofieVersion = await sofieApi.assignSystemBlueprint({
				assignSystemBlueprintRequest: { blueprintId: 'systemBlueprint' },
			})
			expect(sofieVersion.success).toBe(200)
		})

		test('can unassign a blueprint for Sofie Core', async () => {
			const sofieVersion = await sofieApi.unassignSystemBlueprint()
			expect(sofieVersion.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
