// eslint-disable-next-line node/no-missing-import
import { Configuration, BlueprintsApi } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.ACTIONS_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const blueprintsApi = new BlueprintsApi(config)
	const blueprintIds: string[] = []
	test('can request all blueprints available in Sofie', async () => {
		const blueprints = await blueprintsApi.blueprints()
		expect(blueprints.success).toBe(200)
		expect(blueprints).toHaveProperty('result')
		expect(blueprints.result.length).toBeGreaterThanOrEqual(3)
		blueprints.result.forEach((id) => blueprintIds.push(id))
	})

	test('fails to request a blueprint with null id', async () => {
		await expect(blueprintsApi.blueprint({ blueprintId: null })).rejects.toThrow()
	})

	test('can request information about a blueprint', async () => {
		const blueprint = await blueprintsApi.blueprint({
			blueprintId: blueprintIds.length ? blueprintIds[blueprintIds.length - 1] : '',
		})
		expect(blueprint.success).toBe(200)
		expect(blueprint).toHaveProperty('result')
		expect(blueprint.result).toHaveProperty('id')
		expect(blueprint.result).toHaveProperty('name')
		expect(blueprint.result).toHaveProperty('blueprintType')
		expect(blueprint.result).toHaveProperty('blueprintVersion')
	})
})
