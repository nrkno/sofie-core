import '../../../../__mocks__/_extendJest'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { getUpgradeStatus } from '../checkStatus'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { GetUpgradeStatusResult } from '../../../../lib/api/migration'
import {
	setupMockShowStyleBase,
	setupMockShowStyleBlueprint,
	setupMockStudio,
	setupMockStudioBlueprint,
} from '../../../../__mocks__/helpers/database'
import { generateTranslation } from '../../../../lib/lib'
import { Studios } from '../../../../lib/collections/Studios'
import { ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

describe('getUpgradeStatus', () => {
	afterEach(() => {
		Studios.remove({})
		ShowStyleBases.remove({})
	})

	testInFiber('no studios or showstyles', async () => {
		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [],
				studios: [],
			})
		)
	})

	testInFiber('Studios and showStyles missing blueprints', async () => {
		const studio0 = setupMockStudio()
		const studio1 = setupMockStudio()
		const showStyle0 = setupMockShowStyleBase(protectString(''))
		const showStyle1 = setupMockShowStyleBase(protectString(''))

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [],
						invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
							blueprintId: showStyle0.blueprintId,
						}),
					},
					{
						showStyleBaseId: showStyle1._id,
						name: showStyle1.name,
						changes: [],
						invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
							blueprintId: showStyle1.blueprintId,
						}),
					},
				],
				studios: [
					{
						studioId: studio0._id,
						name: studio0.name,
						changes: [],
						invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
							blueprintId: studio0.blueprintId,
						}),
					},
					{
						studioId: studio1._id,
						name: studio1.name,
						changes: [],
						invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
							blueprintId: studio1.blueprintId,
						}),
					},
				],
			})
		)
	})

	testInFiber('Invalid config preset', async () => {
		const showStyleBlueprint = await setupMockShowStyleBlueprint(protectString(''))
		const showStyle0 = setupMockShowStyleBase(showStyleBlueprint._id)

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [],
						invalidReason: generateTranslation(
							'Invalid config preset for blueprint: "{{configPresetId}}" ({{blueprintId}})',
							{
								configPresetId: showStyle0.blueprintConfigPresetId ?? '',
								blueprintId: showStyle0.blueprintId,
							}
						),
					},
				],
				studios: [],
			})
		)
	})

	testInFiber('Not run before', async () => {
		const showStyleBlueprint = await setupMockShowStyleBlueprint(protectString(''))
		const showStyle0 = setupMockShowStyleBase(showStyleBlueprint._id, { blueprintConfigPresetId: 'main' })

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [generateTranslation('Config has not been applied before')],
					},
				],
				studios: [],
			})
		)
	})

	testInFiber('Blueprint id has changed', async () => {
		const showStyleBlueprint = await setupMockShowStyleBlueprint(protectString(''))
		const showStyle0 = setupMockShowStyleBase(showStyleBlueprint._id, {
			blueprintConfigPresetId: 'main',
			lastBlueprintConfig: {
				blueprintHash: showStyleBlueprint.blueprintHash,
				blueprintId: protectString('old-blueprint'),
				blueprintConfigPresetId: 'main',
				config: {},
			},
		})

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [
							generateTranslation(
								'Blueprint has been changed. From "{{ oldValue }}", to "{{ newValue }}"',
								{
									oldValue: protectString('old-blueprint'),
									newValue: showStyle0.blueprintId || '',
								}
							),
						],
					},
				],
				studios: [],
			})
		)
	})

	testInFiber('Config preset has changed', async () => {
		const showStyleBlueprint = await setupMockShowStyleBlueprint(protectString(''))
		const showStyle0 = setupMockShowStyleBase(showStyleBlueprint._id, {
			blueprintConfigPresetId: 'main',
			lastBlueprintConfig: {
				blueprintHash: showStyleBlueprint.blueprintHash,
				blueprintId: showStyleBlueprint._id,
				blueprintConfigPresetId: 'old',
				config: {},
			},
		})

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [
							generateTranslation(
								'Blueprint config preset has been changed. From "{{ oldValue }}", to "{{ newValue }}"',
								{
									oldValue: 'old',
									newValue: showStyle0.blueprintConfigPresetId || '',
								}
							),
						],
					},
				],
				studios: [],
			})
		)
	})

	testInFiber('Blueprint hash has changed', async () => {
		const showStyleBlueprint = await setupMockShowStyleBlueprint(protectString(''))
		const showStyle0 = setupMockShowStyleBase(showStyleBlueprint._id, {
			blueprintConfigPresetId: 'main',
			lastBlueprintConfig: {
				blueprintHash: protectString('old-hash'),
				blueprintId: showStyleBlueprint._id,
				blueprintConfigPresetId: 'main',
				config: {},
			},
		})

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [generateTranslation('Blueprint has a new version')],
					},
				],
				studios: [],
			})
		)
	})

	testInFiber('Conifg has changed', async () => {
		const showStyleBlueprint = await setupMockShowStyleBlueprint(protectString(''))
		const showStyle0 = setupMockShowStyleBase(showStyleBlueprint._id, {
			blueprintConfigPresetId: 'main',
			blueprintConfigWithOverrides: wrapDefaultObject({
				prop1: 'new-value',
				some: {
					deep: {
						property: 2,
					},
				},
				prop3: false,
			}),
			lastBlueprintConfig: {
				blueprintHash: showStyleBlueprint.blueprintHash,
				blueprintId: showStyleBlueprint._id,
				blueprintConfigPresetId: 'main',
				config: {
					prop1: 'old-value',
					some: {
						deep: {
							property: 1,
						},
					},
					prop2: true,
				},
			},
		})

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [generateTranslation('Blueprint config has changed')],
					},
				],
				studios: [],
			})
		)
	})

	testInFiber('Good studios and showstyles', async () => {
		const showStyleBlueprint = await setupMockShowStyleBlueprint(protectString(''))
		const studioBlueprint = await setupMockStudioBlueprint(protectString(''))

		const studio0 = setupMockStudio({
			blueprintId: studioBlueprint._id,
			blueprintConfigPresetId: 'main',
			lastBlueprintConfig: {
				blueprintHash: studioBlueprint.blueprintHash,
				blueprintId: studioBlueprint._id,
				blueprintConfigPresetId: 'main',
				config: {},
			},
		})
		const studio1 = setupMockStudio({
			blueprintId: studioBlueprint._id,
			blueprintConfigPresetId: 'main',
			lastBlueprintConfig: {
				blueprintHash: studioBlueprint.blueprintHash,
				blueprintId: studioBlueprint._id,
				blueprintConfigPresetId: 'main',
				config: {},
			},
		})
		const showStyle0 = setupMockShowStyleBase(showStyleBlueprint._id, {
			blueprintConfigPresetId: 'main',
			lastBlueprintConfig: {
				blueprintHash: showStyleBlueprint.blueprintHash,
				blueprintId: showStyleBlueprint._id,
				blueprintConfigPresetId: 'main',
				config: {},
			},
		})
		const showStyle1 = setupMockShowStyleBase(showStyleBlueprint._id, {
			blueprintConfigPresetId: 'main',
			lastBlueprintConfig: {
				blueprintHash: showStyleBlueprint.blueprintHash,
				blueprintId: showStyleBlueprint._id,
				blueprintConfigPresetId: 'main',
				config: {},
			},
		})

		const result = await getUpgradeStatus()
		expect(result).toEqual(
			literal<GetUpgradeStatusResult>({
				showStyleBases: [
					{
						showStyleBaseId: showStyle0._id,
						name: showStyle0.name,
						changes: [],
					},
					{
						showStyleBaseId: showStyle1._id,
						name: showStyle1.name,
						changes: [],
					},
				],
				studios: [
					{
						studioId: studio0._id,
						name: studio0.name,
						changes: [],
					},
					{
						studioId: studio1._id,
						name: studio1.name,
						changes: [],
					},
				],
			})
		)
	})
})
