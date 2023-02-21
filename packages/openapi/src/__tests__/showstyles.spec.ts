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
	test('can request all ShowStyleBases', async () => {
		const showStyles = await showStylesApi.getShowStyleBases()
		expect(showStyles.success).toBe(200)
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

		test('can request a ShowStyleBase by id', async () => {
			const showStyle = await showStylesApi.showStyleBase({
				showStyleBaseId: 'SSB0',
			})
			expect(showStyle.success).toBe(200)
		})

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

	if (testServer) {
		test('can request all ShowStyleVariants', async () => {
			const showStyleVariants = await showStylesApi.getShowStyleVariants({
				showStyleBaseId: 'SSB0',
			})
			expect(showStyleVariants.success).toBe(200)
		})

		test('can add a ShowStyleVariant', async () => {
			const showStyleVariant = await showStylesApi.addShowStyleVariant({
				showStyleBaseId: 'SSB0',
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

		test('can request a ShowStyleVariant by id', async () => {
			const showStyleVariant = await showStylesApi.showStyleVariant({
				showStyleBaseId: 'SSB0',
				showStyleVariantId: 'SSV',
			})
			expect(showStyleVariant.success).toBe(200)
		})

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
