// eslint-disable-next-line node/no-missing-import
import { Configuration, ShowStyleBase, ShowstylesApi, ShowStyleVariant } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.ACTIONS_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const showStylesApi = new ShowstylesApi(config)
	const showStyleBaseIds: string[] = []
	test('can request all ShowStyleBases', async () => {
		const showStyles = await showStylesApi.getShowStyleBases()
		expect(showStyles.status).toBe(200)
		expect(showStyles).toHaveProperty('result')
		expect(showStyles.result.length).toBeGreaterThanOrEqual(1)
		showStyles.result.forEach((id) => showStyleBaseIds.push(id))
	})

	let newShowStyleBase: ShowStyleBase | undefined
	test('can request a ShowStyleBase by id', async () => {
		const showStyle = await showStylesApi.showStyleBase({
			showStyleBaseId: showStyleBaseIds[0],
		})
		expect(showStyle.status).toBe(200)
		expect(showStyle).toHaveProperty('result')
		expect(showStyle.result).toHaveProperty('name')
		expect(showStyle.result).toHaveProperty('blueprintId')
		expect(showStyle.result).toHaveProperty('outputLayers')
		expect(showStyle.result).toHaveProperty('sourceLayers')
		expect(showStyle.result).toHaveProperty('config')
		newShowStyleBase = JSON.parse(JSON.stringify(showStyle.result))
	})

	let testShowStyleBaseId: string | undefined
	test('can add a ShowStyleBase', async () => {
		newShowStyleBase.name = newShowStyleBase.name + 'Added'
		const showStyle = await showStylesApi.addShowStyleBase({
			showStyleBase: newShowStyleBase,
		})
		expect(showStyle.status).toBe(200)
		expect(typeof showStyle.result).toBe('string')
		testShowStyleBaseId = showStyle.result
	})

	test('can update a ShowStyleBase', async () => {
		newShowStyleBase.config.developerMode = !newShowStyleBase.config.developerMode
		const showStyle = await showStylesApi.addOrUpdateShowStyleBase({
			showStyleBaseId: testShowStyleBaseId,
			showStyleBase: newShowStyleBase,
		})
		expect(showStyle.status).toBe(200)
	})

	test('can remove a ShowStyleBase', async () => {
		const showStyle = await showStylesApi.deleteShowStyleBase({
			showStyleBaseId: testShowStyleBaseId,
		})
		expect(showStyle.status).toBe(200)
	})

	const showStyleVariantIds: string[] = []
	test('can request all ShowStyleVariants', async () => {
		const showStyleVariants = await showStylesApi.getShowStyleVariants({
			showStyleBaseId: showStyleBaseIds[0],
		})
		expect(showStyleVariants.status).toBe(200)
		expect(showStyleVariants).toHaveProperty('result')
		expect(showStyleVariants.result.length).toBeGreaterThanOrEqual(1)
		showStyleVariants.result.forEach((id) => showStyleVariantIds.push(id))
	})

	let newShowStyleVariant: ShowStyleVariant | undefined
	test('can request a ShowStyleVariant by id', async () => {
		const showStyleVariant = await showStylesApi.showStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariantId: showStyleVariantIds[0],
		})
		expect(showStyleVariant.status).toBe(200)
		expect(showStyleVariant).toHaveProperty('result')
		expect(showStyleVariant.result).toHaveProperty('name')
		expect(showStyleVariant.result).toHaveProperty('rank')
		expect(showStyleVariant.result).toHaveProperty('showStyleBaseId')
		expect(showStyleVariant.result).toHaveProperty('config')
		newShowStyleVariant = JSON.parse(JSON.stringify(showStyleVariant.result))
	})

	let testShowStyleVariantId: string | undefined
	test('can add a ShowStyleVariant', async () => {
		newShowStyleVariant.name = newShowStyleVariant.name + 'Added'
		const showStyleVariant = await showStylesApi.addShowStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariant: newShowStyleVariant,
		})
		expect(showStyleVariant.status).toBe(200)
		expect(typeof showStyleVariant.result).toBe('string')
		testShowStyleVariantId = showStyleVariant.result
	})

	test('can update a ShowStyleVariant', async () => {
		newShowStyleVariant.config.developerMode = !newShowStyleVariant.config.developerMode
		const showStyleVariant = await showStylesApi.addOrUpdateShowStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariantId: testShowStyleVariantId,
			showStyleVariant: newShowStyleVariant,
		})
		expect(showStyleVariant.status).toBe(200)
	})

	test('can remove a ShowStyleVariant', async () => {
		const showStyle = await showStylesApi.deleteShowStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariantId: testShowStyleVariantId,
		})
		expect(showStyle.status).toBe(200)
	})
})
