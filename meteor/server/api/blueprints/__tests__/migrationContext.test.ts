import * as _ from 'underscore'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '../../../../lib/collections/PeripheralDevices'
import { literal, getRandomId, protectString, unprotectString } from '../../../../lib/lib'
import {
	LookaheadMode,
	BlueprintMapping,
	ISourceLayer,
	SourceLayerType,
	IOutputLayer,
	TSR,
	IBlueprintShowStyleVariant,
	IBlueprintConfig,
	TriggerType,
	ClientActions,
	PlayoutActions,
	IBlueprintTriggeredActions,
} from '@sofie-automation/blueprints-integration'
import { Studio, MappingExt } from '../../../../lib/collections/Studios'
import { MigrationContextStudio, MigrationContextShowStyle, MigrationContextSystem } from '../migrationContext'
import { ShowStyleBase, SourceLayers } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../../lib/collections/ShowStyleVariants'
import {
	applyAndValidateOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	CoreSystem,
	PeripheralDevices,
	ShowStyleBases,
	ShowStyleVariants,
	Studios,
	TriggeredActions,
} from '../../../collections'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

describe('Test blueprint migrationContext', () => {
	beforeAll(async () => {
		await setupDefaultStudioEnvironment()
	})

	describe('MigrationContextStudio', () => {
		async function getContext() {
			const studio = (await Studios.findOneAsync({})) as Studio
			expect(studio).toBeTruthy()
			return new MigrationContextStudio(studio)
		}
		function getStudio(context: MigrationContextStudio): Studio {
			const studio = (context as any).studio
			expect(studio).toBeTruthy()
			return studio
		}
		describe('mappings', () => {
			async function getMappingFromDb(studio: Studio, mappingId: string): Promise<MappingExt | undefined> {
				const studio2 = (await Studios.findOneAsync(studio._id)) as Studio
				expect(studio2).toBeTruthy()
				return studio2.mappingsWithOverrides.defaults[mappingId]
			}

			testInFiber('getMapping: no id', async () => {
				const ctx = await getContext()
				const mapping = ctx.getMapping('')
				expect(mapping).toBeFalsy()
			})
			testInFiber('getMapping: missing', async () => {
				const ctx = await getContext()
				const mapping = ctx.getMapping('fake_mapping')
				expect(mapping).toBeFalsy()
			})
			testInFiber('getMapping: good', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const rawMapping: MappingExt<TSR.SomeMappingAbstract> = {
					device: TSR.DeviceType.ABSTRACT,
					deviceId: protectString('dev1'),
					lookahead: LookaheadMode.NONE,
					options: {},
				}
				studio.mappingsWithOverrides.defaults['mapping1'] = rawMapping

				const mapping = ctx.getMapping('mapping1') as BlueprintMapping
				expect(mapping).toEqual(rawMapping)

				// Ensure it is a copy
				mapping.deviceId = 'changed'
				expect(mapping).not.toEqual(studio.mappingsWithOverrides.defaults['mapping1'])
			})

			testInFiber('insertMapping: good', async () => {
				const ctx = await getContext()

				const rawMapping: BlueprintMapping<TSR.SomeMappingAbstract> = {
					device: TSR.DeviceType.ABSTRACT,
					deviceId: 'dev1',
					lookahead: LookaheadMode.NONE,
					options: {},
				}

				const mappingId = ctx.insertMapping('mapping2', rawMapping)
				expect(mappingId).toEqual('mapping2')

				// get should return the same
				const mapping = ctx.getMapping('mapping2')
				expect(mapping).toEqual(rawMapping)

				// check db is the same
				const dbMapping = await getMappingFromDb(getStudio(ctx), 'mapping2')
				expect(dbMapping).toEqual(rawMapping)
			})
			testInFiber('insertMapping: no id', async () => {
				const ctx = await getContext()

				const rawMapping: BlueprintMapping<TSR.SomeMappingAbstract> = {
					device: TSR.DeviceType.ABSTRACT,
					deviceId: 'dev1',
					lookahead: LookaheadMode.NONE,
					options: {},
				}

				expect(() => ctx.insertMapping('', rawMapping)).toThrow(`[500] Mapping id "" is invalid`)

				// get should return the same
				const mapping = ctx.getMapping('')
				expect(mapping).toBeFalsy()

				// check db is the same
				const dbMapping = await getMappingFromDb(getStudio(ctx), '')
				expect(dbMapping).toBeFalsy()
			})
			testInFiber('insertMapping: existing', async () => {
				const ctx = await getContext()
				const existingMapping = ctx.getMapping('mapping2')
				expect(existingMapping).toBeTruthy()

				const rawMapping: BlueprintMapping<TSR.SomeMappingAbstract> = {
					device: TSR.DeviceType.ATEM,
					deviceId: 'dev2',
					lookahead: LookaheadMode.PRELOAD,
					options: {},
				}
				expect(rawMapping).not.toEqual(existingMapping)

				expect(() => ctx.insertMapping('mapping2', rawMapping)).toThrow(
					`[404] Mapping "mapping2" cannot be inserted as it already exists`
				)

				// get should return the same
				const mapping = ctx.getMapping('mapping2')
				expect(mapping).toEqual(existingMapping)

				// check db is the same
				const dbMapping = await getMappingFromDb(getStudio(ctx), 'mapping2')
				expect(dbMapping).toEqual(existingMapping)
			})

			testInFiber('updateMapping: good', async () => {
				const ctx = await getContext()
				const existingMapping = ctx.getMapping('mapping2') as BlueprintMapping
				expect(existingMapping).toBeTruthy()

				const rawMapping = {
					device: TSR.DeviceType.HYPERDECK,
					deviceId: 'hyper0',
				}
				ctx.updateMapping('mapping2', rawMapping)

				const expectedMapping = {
					...existingMapping,
					...rawMapping,
				}

				// get should return the same
				const mapping = ctx.getMapping('mapping2')
				expect(mapping).toEqual(expectedMapping)

				// check db is the same
				const dbMapping = await getMappingFromDb(getStudio(ctx), 'mapping2')
				expect(dbMapping).toEqual(expectedMapping)
			})
			testInFiber('updateMapping: no props', async () => {
				const ctx = await getContext()
				const existingMapping = ctx.getMapping('mapping2') as BlueprintMapping
				expect(existingMapping).toBeTruthy()

				// Should not error
				ctx.updateMapping('mapping2', {})
			})
			testInFiber('updateMapping: no id', async () => {
				const ctx = await getContext()
				const existingMapping = ctx.getMapping('') as BlueprintMapping
				expect(existingMapping).toBeFalsy()

				expect(() => ctx.updateMapping('', { device: TSR.DeviceType.HYPERDECK })).toThrow(
					`[404] Mapping "" cannot be updated as it does not exist`
				)
			})
			testInFiber('updateMapping: missing', async () => {
				const ctx = await getContext()
				expect(ctx.getMapping('mapping1')).toBeFalsy()

				const rawMapping = {
					device: TSR.DeviceType.HYPERDECK,
					deviceId: 'hyper0',
				}

				expect(() => ctx.updateMapping('mapping1', rawMapping)).toThrow(
					`[404] Mapping "mapping1" cannot be updated as it does not exist`
				)

				// get should return the same
				const mapping = ctx.getMapping('mapping1')
				expect(mapping).toBeFalsy()

				// check db is the same
				const dbMapping = await getMappingFromDb(getStudio(ctx), 'mapping1')
				expect(dbMapping).toBeFalsy()
			})

			testInFiber('removeMapping: missing', async () => {
				const ctx = await getContext()
				expect(ctx.getMapping('mapping1')).toBeFalsy()

				// Should not error
				ctx.removeMapping('mapping1')
			})
			testInFiber('removeMapping: no id', async () => {
				const ctx = await getContext()
				expect(ctx.getMapping('')).toBeFalsy()
				expect(ctx.getMapping('mapping2')).toBeTruthy()

				// Should not error
				ctx.removeMapping('')

				// ensure other mappings still exist
				expect(await getMappingFromDb(getStudio(ctx), 'mapping2')).toBeTruthy()
			})
			testInFiber('removeMapping: good', async () => {
				const ctx = await getContext()
				expect(ctx.getMapping('mapping2')).toBeTruthy()

				ctx.removeMapping('mapping2')

				// check was removed
				expect(ctx.getMapping('mapping2')).toBeFalsy()
				expect(await getMappingFromDb(getStudio(ctx), 'mapping2')).toBeFalsy()
			})
		})

		describe('config', () => {
			async function getAllConfigFromDb(studio: Studio): Promise<IBlueprintConfig> {
				const studio2 = (await Studios.findOneAsync(studio._id)) as Studio
				expect(studio2).toBeTruthy()
				return studio2.blueprintConfigWithOverrides.defaults
			}

			testInFiber('getConfig: no id', async () => {
				const ctx = await getContext()

				expect(ctx.getConfig('')).toBeFalsy()
			})
			testInFiber('getConfig: missing', async () => {
				const ctx = await getContext()

				expect(ctx.getConfig('conf1')).toBeFalsy()
			})
			testInFiber('getConfig: good', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)

				studio.blueprintConfigWithOverrides.defaults['conf1'] = 5
				expect(ctx.getConfig('conf1')).toEqual(5)

				studio.blueprintConfigWithOverrides.defaults['conf2'] = '   af '
				expect(ctx.getConfig('conf2')).toEqual('af')
			})

			testInFiber('setConfig: no id', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)

				expect(() => ctx.setConfig('', 34)).toThrow(`[500] Config id "" is invalid`)

				// Config should not have changed
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})
			testInFiber('setConfig: insert', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)
				expect(ctx.getConfig('conf1')).toBeFalsy()

				ctx.setConfig('conf1', 34)

				const expectedItem = {
					_id: 'conf1',
					value: 34,
				}
				expect(ctx.getConfig('conf1')).toEqual(expectedItem.value)

				// Config should have changed
				initialConfig[expectedItem._id] = expectedItem.value
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})
			testInFiber('setConfig: insert undefined', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)
				expect(ctx.getConfig('confUndef')).toBeFalsy()

				ctx.setConfig('confUndef', undefined as any)

				const expectedItem = {
					_id: 'confUndef',
					value: undefined as any,
				}
				expect(ctx.getConfig('confUndef')).toEqual(expectedItem.value)

				// Config should have changed
				initialConfig[expectedItem._id] = expectedItem.value
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})

			testInFiber('setConfig: update', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)
				expect(ctx.getConfig('conf1')).toBeTruthy()

				ctx.setConfig('conf1', 'hello')

				const expectedItem = {
					_id: 'conf1',
					value: 'hello',
				}
				expect(ctx.getConfig('conf1')).toEqual(expectedItem.value)

				// Config should have changed
				initialConfig[expectedItem._id] = expectedItem.value
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})
			testInFiber('setConfig: update undefined', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)
				expect(ctx.getConfig('conf1')).toBeTruthy()

				ctx.setConfig('conf1', undefined as any)

				const expectedItem = {
					_id: 'conf1',
					value: undefined as any,
				}
				expect(ctx.getConfig('conf1')).toEqual(expectedItem.value)

				// Config should have changed
				initialConfig[expectedItem._id] = expectedItem.value
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})

			testInFiber('removeConfig: no id', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				ctx.setConfig('conf1', true)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)
				expect(ctx.getConfig('conf1')).toBeTruthy()

				// Should not error
				ctx.removeConfig('')

				// Config should not have changed
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})
			testInFiber('removeConfig: missing', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)
				expect(ctx.getConfig('conf1')).toBeTruthy()
				expect(ctx.getConfig('fake_conf')).toBeFalsy()

				// Should not error
				ctx.removeConfig('fake_conf')

				// Config should not have changed
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})
			testInFiber('removeConfig: good', async () => {
				const ctx = await getContext()
				const studio = getStudio(ctx)
				const initialConfig = _.clone(studio.blueprintConfigWithOverrides.defaults)
				expect(ctx.getConfig('conf1')).toBeTruthy()

				// Should not error
				ctx.removeConfig('conf1')

				// Config should have changed
				delete initialConfig['conf1']
				expect(studio.blueprintConfigWithOverrides.defaults).toEqual(initialConfig)
				expect(await getAllConfigFromDb(studio)).toEqual(initialConfig)
			})
		})

		describe('devices', () => {
			async function getStudio(context: MigrationContextStudio): Promise<Studio> {
				const studioId = (context as any).studio._id
				const studio = (await Studios.findOneAsync(studioId)) as Studio
				expect(studio).toBeTruthy()
				return studio
			}
			async function createPlayoutDevice(studio: Studio) {
				const peripheralDeviceId = getRandomId()
				studio.peripheralDeviceSettings.playoutDevices.defaults = {
					device01: {
						peripheralDeviceId: peripheralDeviceId,
						options: {
							type: TSR.DeviceType.ABSTRACT,
							options: {},
						},
					},
				}

				await Studios.updateAsync(studio._id, studio)
				return PeripheralDevices.insertAsync({
					_id: peripheralDeviceId,
					name: 'Fake parent device',
					organizationId: null,
					type: PeripheralDeviceType.PLAYOUT,
					category: PeripheralDeviceCategory.PLAYOUT,
					subType: PERIPHERAL_SUBTYPE_PROCESS,
					deviceName: 'Playout Gateway',
					studioId: studio._id,
					created: 0,
					lastConnected: 0,
					lastSeen: 0,
					status: {
						statusCode: 0,
					},
					connected: false,
					connectionId: null,
					token: '',
					settings: {},
					configManifest: {
						deviceConfigSchema: JSONBlobStringify({}), // can be empty as it's only useful for UI.
						subdeviceManifest: {},
					},
				})
			}
			async function getPlayoutDevice(studio: Studio): Promise<PeripheralDevice> {
				const device = await PeripheralDevices.findOneAsync({
					studioId: studio._id,
					type: PeripheralDeviceType.PLAYOUT,
					category: PeripheralDeviceCategory.PLAYOUT,
					subType: PERIPHERAL_SUBTYPE_PROCESS,
				})
				expect(device).toBeTruthy()
				return device as PeripheralDevice
			}

			testInFiber('getDevice: no id', async () => {
				const ctx = await getContext()
				const device = ctx.getDevice('')
				expect(device).toBeFalsy()
			})
			testInFiber('getDevice: missing', async () => {
				const ctx = await getContext()
				const device = ctx.getDevice('fake_device')
				expect(device).toBeFalsy()
			})
			testInFiber('getDevice: missing with parent', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const playoutId = await createPlayoutDevice(studio)
				expect(playoutId).toBeTruthy()

				const device = ctx.getDevice('fake_device')
				expect(device).toBeFalsy()
			})
			testInFiber('getDevice: good', async () => {
				const ctx = await getContext()
				const peripheral = getPlayoutDevice(await getStudio(ctx))
				expect(peripheral).toBeTruthy()

				const device = ctx.getDevice('device01')
				expect(device).toBeTruthy()

				// Ensure bad id doesnt match it
				const device2 = ctx.getDevice('fake_device')
				expect(device2).toBeFalsy()
			})

			testInFiber('insertDevice: no id', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('')).toBeFalsy()

				expect(() => ctx.insertDevice('', { type: TSR.DeviceType.ABSTRACT } as any)).toThrow(
					`[500] Device id "" is invalid`
				)

				expect(ctx.getDevice('')).toBeFalsy()
				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})
			// testInFiber('insertDevice: no parent', () => { TODO
			// 	const ctx = await getContext()
			// 	const studio = getStudio(ctx)
			// 	const initialSettings = studio.peripheralDeviceSettings.playoutDevices

			// 	try {
			// 		ctx.insertDevice('', { type: TSR.DeviceType.ABSTRACT })
			// 		fail('expected to throw')
			// 	} catch (e) {
			// 		expect(e.message).toBe(`[500] Device id "" is invalid`)
			// 	}

			// 	expect(ctx.getDevice('')).toBeFalsy()
			// 	expect(getStudio(ctx).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			// })
			testInFiber('insertDevice: already exists', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('device01')).toBeTruthy()

				expect(() => ctx.insertDevice('device01', { type: TSR.DeviceType.CASPARCG } as any)).toThrow(
					`[404] Device "device01" cannot be inserted as it already exists`
				)

				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})
			testInFiber('insertDevice: ok', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('device11')).toBeFalsy()

				const rawDevice: any = { type: TSR.DeviceType.CASPARCG }

				const deviceId = ctx.insertDevice('device11', rawDevice)
				expect(deviceId).toEqual('device11')
				initialSettings.defaults[deviceId] = {
					peripheralDeviceId: (await getPlayoutDevice(studio))._id,
					options: rawDevice,
				}
				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)

				const device = ctx.getDevice(deviceId)
				expect(device).toEqual(rawDevice)
			})

			testInFiber('updateDevice: no id', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('')).toBeFalsy()

				expect(() => ctx.updateDevice('', { type: TSR.DeviceType.ABSTRACT })).toThrow(
					`[500] Device id "" is invalid`
				)

				expect(ctx.getDevice('')).toBeFalsy()
				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})
			// testInFiber('updateDevice: no parent', () => { TODO
			// 	const ctx = await getContext()
			// 	const studio = getStudio(ctx)
			// 	const initialSettings = studio.peripheralDeviceSettings.playoutDevices

			// 	try {
			// 		ctx.updateDevice('', { type: TSR.DeviceType.ABSTRACT })
			// 		fail('expected to throw')
			// 	} catch (e) {
			// 		expect(e.message).toBe(`[500] Device id "" is invalid`)
			// 	}

			// 	expect(ctx.getDevice('')).toBeFalsy()
			// 	expect(getStudio(ctx).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			// })
			testInFiber('updateDevice: missing', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('device22')).toBeFalsy()

				expect(() => ctx.updateDevice('device22', { type: TSR.DeviceType.ATEM })).toThrow(
					`[404] Device "device22" cannot be updated as it does not exist`
				)

				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})
			testInFiber('Device: good', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('device01')).toBeTruthy()

				const rawDevice: any = {
					type: TSR.DeviceType.HYPERDECK,
				}
				const expectedDevice = {
					...initialSettings.defaults['device01'].options,
					...rawDevice,
				}

				ctx.updateDevice('device01', rawDevice)

				expect(ctx.getDevice('device01')).toEqual(expectedDevice)

				initialSettings.defaults['device01'].options = expectedDevice
				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})

			testInFiber('removeDevice: no id', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('')).toBeFalsy()

				expect(() => ctx.removeDevice('')).toThrow(`[500] Device id "" is invalid`)

				expect(ctx.getDevice('')).toBeFalsy()
				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})
			// testInFiber('removeDevice: no parent', () => { TODO
			// 	const ctx = await getContext()
			// 	const studio = getStudio(ctx)
			// 	const initialSettings = studio.peripheralDeviceSettings.playoutDevices

			// 	try {
			// 		ctx.removeDevice('', { type: TSR.DeviceType.ABSTRACT })
			// 		fail('expected to throw')
			// 	} catch (e) {
			// 		expect(e.message).toBe(`[500] Device id "" is invalid`)
			// 	}

			// 	expect(ctx.getDevice('')).toBeFalsy()
			// 	expect(getStudio(ctx).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			// })
			testInFiber('removeDevice: missing', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('device22')).toBeFalsy()

				// Should not error
				ctx.removeDevice('device22')

				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})
			testInFiber('removeDevice: good', async () => {
				const ctx = await getContext()
				const studio = await getStudio(ctx)
				const initialSettings = studio.peripheralDeviceSettings.playoutDevices
				expect(ctx.getDevice('device01')).toBeTruthy()

				// Should not error
				ctx.removeDevice('device01')

				expect(ctx.getDevice('device01')).toBeFalsy()
				delete initialSettings.defaults['device01']
				expect((await getStudio(ctx)).peripheralDeviceSettings.playoutDevices).toEqual(initialSettings)
			})
		})
	})

	describe('MigrationContextShowStyle', () => {
		async function getContext() {
			const showStyle = (await ShowStyleBases.findOneAsync({})) as ShowStyleBase
			expect(showStyle).toBeTruthy()
			return new MigrationContextShowStyle(showStyle)
		}
		function getShowStyle(context: MigrationContextShowStyle): ShowStyleBase {
			const showStyleBase = (context as any).showStyleBase
			expect(showStyleBase).toBeTruthy()
			return showStyleBase
		}
		async function createVariant(ctx: MigrationContextShowStyle, id: string, config?: IBlueprintConfig) {
			const showStyle = getShowStyle(ctx)

			const rawVariant = literal<ShowStyleVariant>({
				_id: protectString(ctx.getVariantId(id)),
				name: 'test',
				showStyleBaseId: showStyle._id,
				blueprintConfigWithOverrides: wrapDefaultObject(config || {}),
				_rundownVersionHash: '',
				_rank: 0,
			})
			await ShowStyleVariants.insertAsync(rawVariant)

			return rawVariant
		}

		describe('variants', () => {
			testInFiber('getAllVariants: good', async () => {
				const ctx = await getContext()
				const variants = ctx.getAllVariants()
				expect(variants).toHaveLength(1)
			})
			testInFiber('getAllVariants: missing base', () => {
				const ctx = new MigrationContextShowStyle({ _id: 'fakeStyle' } as any)
				const variants = ctx.getAllVariants()
				expect(variants).toHaveLength(0)
			})

			testInFiber('getVariantId: consistent', async () => {
				const ctx = await getContext()

				const id1 = ctx.getVariantId('variant1')
				const id2 = ctx.getVariantId('variant1')
				expect(id2).toEqual(id1)

				const id3 = ctx.getVariantId('variant2')
				expect(id3).not.toEqual(id1)
			})
			testInFiber('getVariantId: different base', async () => {
				const ctx = await getContext()
				const ctx2 = new MigrationContextShowStyle({ _id: 'fakeStyle' } as any)

				const id1 = ctx.getVariantId('variant1')
				const id2 = ctx2.getVariantId('variant1')
				expect(id2).not.toEqual(id1)
			})

			testInFiber('getVariant: good', async () => {
				const ctx = await getContext()
				const rawVariant = await createVariant(ctx, 'variant1')

				const variant = ctx.getVariant('variant1')
				expect(variant).toBeTruthy()
				expect(variant).toEqual(rawVariant)
			})
			testInFiber('getVariant: no id', async () => {
				const ctx = await getContext()

				expect(() => ctx.getVariant('')).toThrow(`[500] Variant id "" is invalid`)
			})
			testInFiber('getVariant: missing', async () => {
				const ctx = await getContext()

				const variant = ctx.getVariant('fake_variant')
				expect(variant).toBeFalsy()
			})

			testInFiber('insertVariant: no id', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())

				expect(() =>
					ctx.insertVariant('', {
						name: 'test2',
					})
				).toThrow(`[500] Variant id "" is invalid`)

				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})
			testInFiber('insertVariant: already exists', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())
				expect(ctx.getVariant('variant1')).toBeTruthy()

				expect(() =>
					ctx.insertVariant('variant1', {
						name: 'test2',
					})
				).toThrow(/*`[500] Variant id "variant1" already exists`*/)

				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})
			testInFiber('insertVariant: good', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())
				expect(ctx.getVariant('variant2')).toBeFalsy()

				const variantId = ctx.insertVariant('variant2', {
					name: 'test2',
				})
				expect(variantId).toBeTruthy()
				expect(variantId).toEqual(ctx.getVariantId('variant2'))

				initialVariants.push(
					literal<ShowStyleVariant>({
						_id: protectString(variantId),
						showStyleBaseId: getShowStyle(ctx)._id,
						name: 'test2',
						blueprintConfigWithOverrides: wrapDefaultObject({}),
						_rundownVersionHash: '',
						_rank: 0,
					}) as any as IBlueprintShowStyleVariant
				)
				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})

			testInFiber('updateVariant: no id', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())

				expect(() =>
					ctx.updateVariant('', {
						name: 'test12',
					})
				).toThrow(`[500] Variant id "" is invalid`)

				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})
			testInFiber('updateVariant: missing', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())
				expect(ctx.getVariant('variant11')).toBeFalsy()

				expect(() =>
					ctx.updateVariant('variant11', {
						name: 'test2',
					})
				).toThrow(/*`[404] Variant id "variant1" does not exist`*/)
				// TODO - tidy up the error type

				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})
			testInFiber('updateVariant: good', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())
				expect(ctx.getVariant('variant1')).toBeTruthy()

				ctx.updateVariant('variant1', {
					name: 'newname',
				})

				_.each(initialVariants, (variant) => {
					if (variant._id === ctx.getVariantId('variant1')) {
						variant.name = 'newname'
					}
				})
				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})

			testInFiber('removeVariant: no id', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())

				expect(() => ctx.removeVariant('')).toThrow(`[500] Variant id "" is invalid`)

				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})
			testInFiber('removeVariant: missing', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())
				expect(ctx.getVariant('variant11')).toBeFalsy()

				// Should not error
				ctx.removeVariant('variant11')

				expect(ctx.getAllVariants()).toEqual(initialVariants)
			})
			testInFiber('removeVariant: good', async () => {
				const ctx = await getContext()
				const initialVariants = _.clone(ctx.getAllVariants())
				expect(ctx.getVariant('variant1')).toBeTruthy()

				// Should not error
				ctx.removeVariant('variant1')

				const expectedVariants = _.filter(
					initialVariants,
					(variant) => variant._id !== ctx.getVariantId('variant1')
				)
				expect(ctx.getAllVariants()).toEqual(expectedVariants)
			})
		})

		describe('sourcelayer', () => {
			async function getAllSourceLayersFromDb(showStyle: ShowStyleBase): Promise<SourceLayers> {
				const showStyle2 = (await ShowStyleBases.findOneAsync(showStyle._id)) as ShowStyleBase
				expect(showStyle2).toBeTruthy()
				return showStyle2.sourceLayersWithOverrides.defaults
			}

			testInFiber('getSourceLayer: no id', async () => {
				const ctx = await getContext()

				expect(() => ctx.getSourceLayer('')).toThrow(`[500] SourceLayer id "" is invalid`)
			})
			testInFiber('getSourceLayer: missing', async () => {
				const ctx = await getContext()

				const layer = ctx.getSourceLayer('fake_source_layer')
				expect(layer).toBeFalsy()
			})
			testInFiber('getSourceLayer: good', async () => {
				const ctx = await getContext()

				const layer = ctx.getSourceLayer('cam0') as ISourceLayer
				expect(layer).toBeTruthy()
				expect(layer._id).toEqual('cam0')

				const layer2 = ctx.getSourceLayer('vt0') as ISourceLayer
				expect(layer2).toBeTruthy()
				expect(layer2._id).toEqual('vt0')
			})

			testInFiber('insertSourceLayer: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)

				expect(() =>
					ctx.insertSourceLayer('', {
						name: 'test',
						_rank: 10,
						type: SourceLayerType.UNKNOWN,
					})
				).toThrow(`[500] SourceLayer id "" is invalid`)

				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})
			testInFiber('insertSourceLayer: existing', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)

				expect(() =>
					ctx.insertSourceLayer('vt0', {
						name: 'test',
						_rank: 10,
						type: SourceLayerType.UNKNOWN,
					})
				).toThrow(`[500] SourceLayer "vt0" already exists`)

				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})
			testInFiber('insertSourceLayer: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)

				const rawLayer = {
					name: 'test',
					_rank: 10,
					type: SourceLayerType.UNKNOWN,
				}

				ctx.insertSourceLayer('lay1', rawLayer)

				initialSourceLayers['lay1'] = {
					...rawLayer,
					_id: 'lay1',
				}
				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})

			testInFiber('updateSourceLayer: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)

				expect(() =>
					ctx.updateSourceLayer('', {
						name: 'test',
						_rank: 10,
						type: SourceLayerType.UNKNOWN,
					})
				).toThrow(`[500] SourceLayer id "" is invalid`)

				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})
			testInFiber('updateSourceLayer: missing', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)

				expect(() =>
					ctx.updateSourceLayer('fake99', {
						name: 'test',
						_rank: 10,
						type: SourceLayerType.UNKNOWN,
					})
				).toThrow(`[404] SourceLayer "fake99" cannot be updated as it does not exist`)

				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})
			testInFiber('updateSourceLayer: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)
				expect(ctx.getSourceLayer('lay1')).toBeTruthy()

				const rawLayer = {
					name: 'test98',
					type: SourceLayerType.VT,
				}

				ctx.updateSourceLayer('lay1', rawLayer)

				initialSourceLayers['lay1'] = {
					...initialSourceLayers['lay1']!,
					...rawLayer,
				}
				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})

			testInFiber('removeSourceLayer: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)

				expect(() => ctx.removeSourceLayer('')).toThrow(`[500] SourceLayer id "" is invalid`)

				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})
			testInFiber('removeSourceLayer: missing', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)
				expect(ctx.getSourceLayer('fake99')).toBeFalsy()

				// Should not error
				ctx.removeSourceLayer('fake99')

				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})
			testInFiber('removeSourceLayer: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialSourceLayers = _.clone(showStyle.sourceLayersWithOverrides.defaults)
				expect(ctx.getSourceLayer('lay1')).toBeTruthy()

				// Should not error
				ctx.removeSourceLayer('lay1')

				delete initialSourceLayers['lay1']
				expect(getShowStyle(ctx).sourceLayersWithOverrides.defaults).toEqual(initialSourceLayers)
				expect(await getAllSourceLayersFromDb(showStyle)).toEqual(initialSourceLayers)
			})
		})

		describe('outputlayer', () => {
			async function getAllOutputLayersFromDb(
				showStyle: ShowStyleBase
			): Promise<Record<string, IOutputLayer | undefined>> {
				const showStyle2 = (await ShowStyleBases.findOneAsync(showStyle._id)) as ShowStyleBase
				expect(showStyle2).toBeTruthy()
				return showStyle2.outputLayersWithOverrides.defaults
			}

			testInFiber('getOutputLayer: no id', async () => {
				const ctx = await getContext()

				expect(() => ctx.getOutputLayer('')).toThrow(`[500] OutputLayer id "" is invalid`)
			})
			testInFiber('getOutputLayer: missing', async () => {
				const ctx = await getContext()

				const layer = ctx.getOutputLayer('fake_source_layer')
				expect(layer).toBeFalsy()
			})
			testInFiber('getOutputLayer: good', async () => {
				const ctx = await getContext()

				const layer = ctx.getOutputLayer('pgm') as IOutputLayer
				expect(layer).toBeTruthy()
				expect(layer._id).toEqual('pgm')
			})

			testInFiber('insertOutputLayer: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)

				expect(() =>
					ctx.insertOutputLayer('', {
						name: 'test',
						_rank: 10,
						isPGM: true,
					})
				).toThrow(`[500] OutputLayer id "" is invalid`)

				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})
			testInFiber('insertOutputLayer: existing', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)

				expect(() =>
					ctx.insertOutputLayer('pgm', {
						name: 'test',
						_rank: 10,
						isPGM: true,
					})
				).toThrow(`[500] OutputLayer "pgm" already exists`)

				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})
			testInFiber('insertOutputLayer: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)

				const rawLayer = {
					name: 'test',
					_rank: 10,
					isPGM: true,
				}

				ctx.insertOutputLayer('lay1', rawLayer)

				initialOutputLayers['lay1'] = {
					...rawLayer,
					_id: 'lay1',
				}
				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})

			testInFiber('updateOutputLayer: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)

				expect(() =>
					ctx.updateOutputLayer('', {
						name: 'test',
						_rank: 10,
						isPGM: true,
					})
				).toThrow(`[500] OutputLayer id "" is invalid`)

				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})
			testInFiber('updateOutputLayer: missing', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)

				expect(() =>
					ctx.updateOutputLayer('fake99', {
						name: 'test',
						_rank: 10,
						isPGM: true,
					})
				).toThrow(`[404] OutputLayer "fake99" cannot be updated as it does not exist`)

				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})
			testInFiber('updateOutputLayer: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)
				expect(ctx.getOutputLayer('lay1')).toBeTruthy()

				const rawLayer = {
					name: 'test98',
				}

				ctx.updateOutputLayer('lay1', rawLayer)

				initialOutputLayers['lay1'] = {
					...initialOutputLayers['lay1']!,
					...rawLayer,
				}

				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})

			testInFiber('removeOutputLayer: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)

				expect(() => ctx.removeOutputLayer('')).toThrow(`[500] OutputLayer id "" is invalid`)

				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})
			testInFiber('removeOutputLayer: missing', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)
				expect(ctx.getOutputLayer('fake99')).toBeFalsy()

				// Should not error
				ctx.removeOutputLayer('fake99')

				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})
			testInFiber('removeOutputLayer: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialOutputLayers = _.clone(showStyle.outputLayersWithOverrides.defaults)
				expect(ctx.getOutputLayer('lay1')).toBeTruthy()

				// Should not error
				ctx.removeOutputLayer('lay1')

				delete initialOutputLayers['lay1']
				expect(getShowStyle(ctx).outputLayersWithOverrides.defaults).toEqual(initialOutputLayers)
				expect(await getAllOutputLayersFromDb(showStyle)).toEqual(initialOutputLayers)
			})
		})

		describe('base-config', () => {
			async function getAllBaseConfigFromDb(showStyle: ShowStyleBase): Promise<IBlueprintConfig> {
				const showStyle2 = (await ShowStyleBases.findOneAsync(showStyle._id)) as ShowStyleBase
				expect(showStyle2).toBeTruthy()
				return showStyle2.blueprintConfigWithOverrides.defaults
			}

			testInFiber('getBaseConfig: no id', async () => {
				const ctx = await getContext()

				expect(ctx.getBaseConfig('')).toBeFalsy()
			})
			testInFiber('getBaseConfig: missing', async () => {
				const ctx = await getContext()

				expect(ctx.getBaseConfig('conf1')).toBeFalsy()
			})
			testInFiber('getBaseConfig: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)

				showStyle.blueprintConfigWithOverrides.defaults['conf1'] = 5
				expect(ctx.getBaseConfig('conf1')).toEqual(5)

				showStyle.blueprintConfigWithOverrides.defaults['conf2'] = '   af '
				expect(ctx.getBaseConfig('conf2')).toEqual('af')
			})

			testInFiber('setBaseConfig: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)

				expect(() => ctx.setBaseConfig('', 34)).toThrow(`[500] Config id "" is invalid`)

				// BaseConfig should not have changed
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})
			testInFiber('setBaseConfig: insert', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)
				expect(ctx.getBaseConfig('conf1')).toBeFalsy()

				ctx.setBaseConfig('conf1', 34)

				const expectedItem = {
					_id: 'conf1',
					value: 34,
				}
				expect(ctx.getBaseConfig('conf1')).toEqual(expectedItem.value)

				// BaseConfig should have changed
				initialBaseConfig[expectedItem._id] = expectedItem.value
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})
			testInFiber('setBaseConfig: insert undefined', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)
				expect(ctx.getBaseConfig('confUndef')).toBeFalsy()

				expect(() => ctx.setBaseConfig('confUndef', undefined as any)).toThrow(
					`[400] setBaseConfig \"confUndef\": value is undefined`
				)

				// BaseConfig should not have changed
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})

			testInFiber('setBaseConfig: update', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)
				expect(ctx.getBaseConfig('conf1')).toBeTruthy()

				ctx.setBaseConfig('conf1', 'hello')

				const expectedItem = {
					_id: 'conf1',
					value: 'hello',
				}
				expect(ctx.getBaseConfig('conf1')).toEqual(expectedItem.value)

				// BaseConfig should have changed
				initialBaseConfig[expectedItem._id] = expectedItem.value
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})
			testInFiber('setBaseConfig: update undefined', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)
				expect(ctx.getBaseConfig('conf1')).toBeTruthy()

				expect(() => ctx.setBaseConfig('conf1', undefined as any)).toThrow(
					`[400] setBaseConfig \"conf1\": value is undefined`
				)

				// BaseConfig should not have changed
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})

			testInFiber('removeBaseConfig: no id', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				ctx.setBaseConfig('conf1', true)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)
				expect(ctx.getBaseConfig('conf1')).toBeTruthy()

				// Should not error
				ctx.removeBaseConfig('')

				// BaseConfig should not have changed
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})
			testInFiber('removeBaseConfig: missing', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)
				expect(ctx.getBaseConfig('conf1')).toBeTruthy()
				expect(ctx.getBaseConfig('fake_conf')).toBeFalsy()

				// Should not error
				ctx.removeBaseConfig('fake_conf')

				// BaseConfig should not have changed
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})
			testInFiber('removeBaseConfig: good', async () => {
				const ctx = await getContext()
				const showStyle = getShowStyle(ctx)
				const initialBaseConfig = _.clone(showStyle.blueprintConfigWithOverrides.defaults)
				expect(ctx.getBaseConfig('conf1')).toBeTruthy()

				// Should not error
				ctx.removeBaseConfig('conf1')

				// BaseConfig should have changed
				delete initialBaseConfig['conf1']
				expect(showStyle.blueprintConfigWithOverrides.defaults).toEqual(initialBaseConfig)
				expect(await getAllBaseConfigFromDb(showStyle)).toEqual(initialBaseConfig)
			})
		})
		describe('variant-config', () => {
			async function getAllVariantConfigFromDb(
				ctx: MigrationContextShowStyle,
				variantId: string
			): Promise<IBlueprintConfig> {
				const variant = (await ShowStyleVariants.findOneAsync(
					protectString(ctx.getVariantId(variantId))
				)) as ShowStyleVariant
				expect(variant).toBeTruthy()
				return variant.blueprintConfigWithOverrides.defaults
			}

			testInFiber('getVariantConfig: no variant id', async () => {
				const ctx = await getContext()

				expect(() => ctx.getVariantConfig('', 'conf1')).toThrow(`[404] ShowStyleVariant \"\" not found`)
			})
			testInFiber('getVariantConfig: missing variant', async () => {
				const ctx = await getContext()

				expect(() => ctx.getVariantConfig('fake_variant', 'conf1')).toThrow(
					`[404] ShowStyleVariant \"fake_variant\" not found`
				)
			})
			testInFiber('getVariantConfig: missing', async () => {
				const ctx = await getContext()
				await createVariant(ctx, 'configVariant', { conf1: 5, conf2: '   af ' })

				expect(ctx.getVariantConfig('configVariant', 'conf11')).toBeFalsy()
			})
			testInFiber('getVariantConfig: good', async () => {
				const ctx = await getContext()
				expect(ctx.getVariant('configVariant')).toBeTruthy()

				expect(ctx.getVariantConfig('configVariant', 'conf1')).toEqual(5)
				expect(ctx.getVariantConfig('configVariant', 'conf2')).toEqual('af')
			})

			testInFiber('setVariantConfig: no variant id', async () => {
				const ctx = await getContext()

				expect(() => ctx.setVariantConfig('', 'conf1', 5)).toThrow(`[404] ShowStyleVariant \"\" not found`)
			})
			testInFiber('setVariantConfig: missing variant', async () => {
				const ctx = await getContext()

				expect(() => ctx.setVariantConfig('fake_variant', 'conf1', 5)).toThrow(
					`[404] ShowStyleVariant \"fake_variant\" not found`
				)
			})
			testInFiber('setVariantConfig: no id', async () => {
				const ctx = await getContext()
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariant('configVariant')).toBeTruthy()

				expect(() => ctx.setVariantConfig('configVariant', '', 34)).toThrow(`[500] Config id "" is invalid`)

				// VariantConfig should not have changed
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})
			testInFiber('setVariantConfig: insert', async () => {
				const ctx = await getContext()
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariantConfig('configVariant', 'conf19')).toBeFalsy()

				ctx.setVariantConfig('configVariant', 'conf19', 34)

				const expectedItem = {
					_id: 'conf19',
					value: 34,
				}
				expect(ctx.getVariantConfig('configVariant', 'conf19')).toEqual(expectedItem.value)

				// VariantConfig should have changed
				initialVariantConfig[expectedItem._id] = expectedItem.value
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})
			testInFiber('setVariantConfig: insert undefined', async () => {
				const ctx = await getContext()
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariantConfig('configVariant', 'confUndef')).toBeFalsy()

				expect(() => ctx.setVariantConfig('configVariant', 'confUndef', undefined as any)).toThrow(
					`[400] setVariantConfig \"configVariant\", \"confUndef\": value is undefined`
				)

				// VariantConfig should not have changed
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})

			testInFiber('setVariantConfig: update', async () => {
				const ctx = await getContext()
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariantConfig('configVariant', 'conf1')).toBeTruthy()

				ctx.setVariantConfig('configVariant', 'conf1', 'hello')

				const expectedItem = {
					_id: 'conf1',
					value: 'hello',
				}
				expect(ctx.getVariantConfig('configVariant', 'conf1')).toEqual(expectedItem.value)

				// VariantConfig should have changed
				initialVariantConfig[expectedItem._id] = expectedItem.value
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})
			testInFiber('setVariantConfig: update undefined', async () => {
				const ctx = await getContext()
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariantConfig('configVariant', 'conf1')).toBeTruthy()

				expect(() => ctx.setVariantConfig('configVariant', 'conf1', undefined as any)).toThrow(
					`[400] setVariantConfig \"configVariant\", \"conf1\": value is undefined`
				)

				// VariantConfig should not have changed
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})

			testInFiber('removeVariantConfig: no variant id', async () => {
				const ctx = await getContext()

				expect(() => ctx.removeVariantConfig('', 'conf1')).toThrow(`[404] ShowStyleVariant \"\" not found`)
			})
			testInFiber('removeVariantConfig: missing variant', async () => {
				const ctx = await getContext()

				expect(() => ctx.removeVariantConfig('fake_variant', 'conf1')).toThrow(
					`[404] ShowStyleVariant \"fake_variant\" not found`
				)
			})
			testInFiber('removeVariantConfig: no id', async () => {
				const ctx = await getContext()
				ctx.setVariantConfig('configVariant', 'conf1', true)
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariantConfig('configVariant', 'conf1')).toBeTruthy()

				// Should not error
				ctx.removeVariantConfig('configVariant', '')

				// VariantConfig should not have changed
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})
			testInFiber('removeVariantConfig: missing', async () => {
				const ctx = await getContext()
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariantConfig('configVariant', 'conf1')).toBeTruthy()
				expect(ctx.getVariantConfig('configVariant', 'fake_conf')).toBeFalsy()

				// Should not error
				ctx.removeVariantConfig('configVariant', 'fake_conf')

				// VariantConfig should not have changed
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})
			testInFiber('removeVariantConfig: good', async () => {
				const ctx = await getContext()
				const initialVariantConfig = _.clone(await getAllVariantConfigFromDb(ctx, 'configVariant'))
				expect(ctx.getVariantConfig('configVariant', 'conf1')).toBeTruthy()

				// Should not error
				ctx.removeVariantConfig('configVariant', 'conf1')

				// VariantConfig should have changed
				delete initialVariantConfig['conf1']
				expect(await getAllVariantConfigFromDb(ctx, 'configVariant')).toEqual(initialVariantConfig)
			})
		})
	})

	describe('MigrationContextSystem', () => {
		async function getContext() {
			const coreSystem = await CoreSystem.findOneAsync({})
			expect(coreSystem).toBeTruthy()
			return new MigrationContextSystem()
		}
		async function getSystemTriggeredActions(): Promise<IBlueprintTriggeredActions[]> {
			const systemTriggeredActions = await TriggeredActions.findFetchAsync({
				showStyleBaseId: null,
			})
			expect(systemTriggeredActions).toHaveLength(3)
			return systemTriggeredActions.map((doc) =>
				literal<IBlueprintTriggeredActions>({
					_id: unprotectString(doc._id),
					_rank: doc._rank,
					name: doc.name,
					triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,
					actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
				})
			)
		}
		describe('triggeredActions', () => {
			testInFiber('getAllTriggeredActions: return all triggeredActions', async () => {
				const ctx = await getContext()

				// default studio environment should have 3 core-level actions
				expect(ctx.getAllTriggeredActions()).toHaveLength(3)
			})
			testInFiber('getTriggeredAction: no id', async () => {
				const ctx = await getContext()

				expect(() => ctx.getTriggeredAction('')).toThrow('[500] Triggered actions Id "" is invalid')
			})
			testInFiber('getTriggeredAction: missing id', async () => {
				const ctx = await getContext()

				expect(ctx.getTriggeredAction('abc')).toBeFalsy()
			})
			testInFiber('getTriggeredAction: existing id', async () => {
				const ctx = await getContext()

				const existingTriggeredActions = (await getSystemTriggeredActions())[0]
				expect(existingTriggeredActions).toBeTruthy()
				expect(ctx.getTriggeredAction(existingTriggeredActions._id)).toMatchObject(existingTriggeredActions)
			})
			testInFiber('setTriggeredAction: set undefined', async () => {
				const ctx = await getContext()

				expect(() => ctx.setTriggeredAction(undefined as any)).toThrow(/Match error/)
			})
			testInFiber('setTriggeredAction: set without id', async () => {
				const ctx = await getContext()

				expect(() =>
					ctx.setTriggeredAction({
						_rank: 0,
						actions: [],
						triggers: [],
					} as any)
				).toThrow(/Match error/)
			})
			testInFiber('setTriggeredAction: set without actions', async () => {
				const ctx = await getContext()

				expect(() =>
					ctx.setTriggeredAction({
						_id: 'test1',
						_rank: 0,
						triggers: [],
					} as any)
				).toThrow(/Match error/)
			})
			testInFiber('setTriggeredAction: set with null as name', async () => {
				const ctx = await getContext()

				expect(() =>
					ctx.setTriggeredAction({
						_id: 'test1',
						_rank: 0,
						actions: [],
						triggers: [],
						name: null,
					} as any)
				).toThrow(/Match error/)
			})
			testInFiber('setTriggeredAction: set non-existing id', async () => {
				const ctx = await getContext()

				const blueprintLocalId = 'test0'

				ctx.setTriggeredAction({
					_id: blueprintLocalId,
					_rank: 1001,
					actions: {
						'0': {
							action: ClientActions.shelf,
							filterChain: [
								{
									object: 'view',
								},
							],
							state: 'toggle',
						},
					},
					triggers: {
						'0': {
							type: TriggerType.hotkey,
							keys: 'Digit1',
						},
					},
				})
				const insertedTriggeredAction = ctx.getTriggeredAction(blueprintLocalId)
				expect(insertedTriggeredAction).toBeTruthy()
				// the actual id in the database should not be the same as the one provided
				// in the setTriggeredAction method
				expect(insertedTriggeredAction?._id !== blueprintLocalId).toBe(true)
			})
			testInFiber('setTriggeredAction: set existing id', async () => {
				const ctx = await getContext()

				const oldCoreAction = ctx.getTriggeredAction('mockTriggeredAction_core0')
				expect(oldCoreAction).toBeTruthy()
				expect(oldCoreAction?.actions[0].action).toBe(PlayoutActions.adlib)

				ctx.setTriggeredAction({
					_id: 'mockTriggeredAction_core0',
					_rank: 0,
					actions: {
						'0': {
							action: PlayoutActions.activateRundownPlaylist,
							rehearsal: false,
							filterChain: [
								{
									object: 'view',
								},
							],
						},
					},
					triggers: {
						'0': {
							type: TriggerType.hotkey,
							keys: 'Control+Shift+Enter',
						},
					},
				})

				const newCoreAction = ctx.getTriggeredAction('mockTriggeredAction_core0')
				expect(newCoreAction).toBeTruthy()
				expect(newCoreAction?.actions[0].action).toBe(PlayoutActions.activateRundownPlaylist)
			})
			testInFiber('removeTriggeredAction: remove empty id', async () => {
				const ctx = await getContext()

				expect(() => ctx.removeTriggeredAction('')).toThrow('[500] Triggered actions Id "" is invalid')
			})
			testInFiber('removeTriggeredAction: remove existing id', async () => {
				const ctx = await getContext()

				const oldCoreAction = ctx.getTriggeredAction('mockTriggeredAction_core0')
				expect(oldCoreAction).toBeTruthy()

				ctx.removeTriggeredAction('mockTriggeredAction_core0')
				expect(ctx.getTriggeredAction('mockTriggeredAction_core0')).toBeFalsy()
			})
		})
	})
})
