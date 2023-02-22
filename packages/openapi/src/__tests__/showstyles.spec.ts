// eslint-disable-next-line node/no-missing-import
import { Configuration, ShowstylesApi } from '../../client/ts'
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

	const showStylesApi = new ShowstylesApi(config)
	const showStyleBaseIds: string[] = []
	test('can request all ShowStyleBases', async () => {
		const showStyles = await showStylesApi.getShowStyleBases()
		expect(showStyles.success).toBe(200)
		expect(showStyles).toHaveProperty('result')
		expect(showStyles.result.length).toBeGreaterThanOrEqual(1)
		showStyles.result.forEach((id) => showStyleBaseIds.push(id))
	})

	if (testServer) {
		test('can add a ShowStyleBase', async () => {
			const showStyle = await showStylesApi.addShowStyleBase({
				addShowStyleBaseRequest: {
					showStyleBase: {
						name: 'SSB',
						blueprintId: '',
						outputLayers: [],
						sourceLayers: [],
						config: {},
					},
				},
			})
			expect(showStyle.success).toBe(200)
		})
	} else {
		test.todo('todo - can add a ShowStyleBase')
	}

	test('can request a ShowStyleBase by id', async () => {
		const showStyle = await showStylesApi.showStyleBase({
			showStyleBaseId: showStyleBaseIds[0],
		})
		expect(showStyle.success).toBe(200)
		expect(showStyle).toHaveProperty('result')
		expect(showStyle.result).toHaveProperty('name')
		expect(showStyle.result).toHaveProperty('blueprintId')
		expect(showStyle.result).toHaveProperty('outputLayers')
		expect(showStyle.result).toHaveProperty('sourceLayers')
		expect(showStyle.result).toHaveProperty('config')
	})

	if (testServer) {
		test('can update a ShowStyleBase', async () => {
			const showStyle = await showStylesApi.addOrUpdateShowStyleBase({
				showStyleBaseId: 'SSB0',
				addShowStyleBaseRequest: {
					showStyleBase: {
						name: 'SSB',
						blueprintId: 'SSB0',
						outputLayers: [],
						sourceLayers: [],
						config: {},
					},
				},
			})
			expect(showStyle.success).toBe(200)
		})

		test('can remove a ShowStyleBase', async () => {
			const showStyle = await showStylesApi.deleteShowStyleBase({
				showStyleBaseId: 'SSB0',
			})
			expect(showStyle.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for ShowStyles')
	}

	const showStyleVariantIds: string[] = []
	test('can request all ShowStyleVariants', async () => {
		const showStyleVariants = await showStylesApi.getShowStyleVariants({
			showStyleBaseId: showStyleBaseIds[0],
		})
		expect(showStyleVariants.success).toBe(200)
		expect(showStyleVariants).toHaveProperty('result')
		expect(showStyleVariants.result.length).toBeGreaterThanOrEqual(1)
		showStyleVariants.result.forEach((id) => showStyleVariantIds.push(id))
	})

	if (testServer) {
		test('can add a ShowStyleVariant', async () => {
			const showStyleVariant = await showStylesApi.addShowStyleVariant({
				showStyleBaseId: showStyleBaseIds[0],
				addShowStyleVariantRequest: {
					showStyleVariant: {
						name: 'SSV',
						showStyleBaseId: 'SSB0',
						config: {},
					},
				},
			})
			expect(showStyleVariant.success).toBe(200)
		})
	} else {
		test.todo('todo - can add a ShowStyleVariant')
	}

	test('can request a ShowStyleVariant by id', async () => {
		const showStyleVariant = await showStylesApi.showStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariantId: showStyleVariantIds[0],
		})
		expect(showStyleVariant.success).toBe(200)
		expect(showStyleVariant).toHaveProperty('result')
		expect(showStyleVariant.result).toHaveProperty('name')
		expect(showStyleVariant.result).toHaveProperty('showStyleBaseId')
		expect(showStyleVariant.result).toHaveProperty('config')
	})

	if (testServer) {
		test('can update a ShowStyleVariant', async () => {
			const showStyleVariant = await showStylesApi.addOrUpdateShowStyleVariant({
				showStyleBaseId: 'SSB0',
				showStyleVariantId: 'SSV',
				addShowStyleVariantRequest: {
					showStyleVariant: {
						name: 'SSB',
						showStyleBaseId: 'SSB0',
						config: {},
					},
				},
			})
			expect(showStyleVariant.success).toBe(200)
		})

		test('can remove a ShowStyleVariant', async () => {
			const showStyle = await showStylesApi.deleteShowStyleVariant({
				showStyleBaseId: 'SSB0',
				showStyleVariantId: 'SSV',
			})
			expect(showStyle.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for ShowStyleVariants')
	}
})
