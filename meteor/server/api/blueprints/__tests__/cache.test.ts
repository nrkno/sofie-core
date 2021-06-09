import * as _ from 'underscore'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { Rundown, DBRundown } from '../../../../lib/collections/Rundowns'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { literal, protectString } from '../../../../lib/lib'
import {
	loadSystemBlueprints,
	loadStudioBlueprint,
	loadShowStyleBlueprint,
	WrappedStudioBlueprint,
	BLUEPRINT_CACHE_CONTROL,
} from '../cache'
import { getCoreSystem, ICoreSystem } from '../../../../lib/collections/CoreSystem'
import { Blueprints } from '../../../../lib/collections/Blueprints'
import {
	BlueprintManifestType,
	BlueprintResultRundown,
	BlueprintResultSegment,
} from '@sofie-automation/blueprints-integration'
import { Studios, Studio } from '../../../../lib/collections/Studios'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { generateFakeBlueprint } from './lib'

describe('Test blueprint cache', () => {
	beforeAll(() => {
		setupDefaultStudioEnvironment()
	})
	beforeEach(() => {
		BLUEPRINT_CACHE_CONTROL.disable = true
	})
	afterEach(() => {
		BLUEPRINT_CACHE_CONTROL.disable = false
	})

	describe('loadSystemBlueprints', () => {
		function getCore(): ICoreSystem {
			const core = getCoreSystem() as ICoreSystem
			expect(core).toBeTruthy()
			return core
		}
		testInFiber('Blueprint not specified', () => {
			const core = getCore()
			expect(core.blueprintId).toBeFalsy()

			const blueprint = loadSystemBlueprints(core)
			expect(blueprint).toBeFalsy()
		})
		testInFiber('Blueprint does not exist', () => {
			const core = getCore()
			core.blueprintId = protectString('fake_id')
			expect(core.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))

			try {
				loadSystemBlueprints(core)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(`[404] Blueprint "${core.blueprintId}" not found! (referenced by CoreSystem)`)
			}
		})
		testInFiber('Blueprint no type', () => {
			const core = getCore()
			core.blueprintId = protectString('fake_id')
			expect(core.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id'))

			try {
				loadSystemBlueprints(core)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem (undefined)!`
				)
			}
		})

		testInFiber('Blueprint wrong type', () => {
			const core = getCore()
			core.blueprintId = protectString('fake_id')
			expect(core.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			const bp = generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE)
			Blueprints.insert(bp)

			expect(BLUEPRINT_CACHE_CONTROL.disable).toBeTruthy()
			try {
				loadSystemBlueprints(core)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem (showstyle)!`
				)
			}
		})

		testInFiber('Blueprint wrong internal type', () => {
			const core = getCore()
			core.blueprintId = protectString('fake_id')
			expect(core.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'studio' as BlueprintManifestType.STUDIO,
				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',

				studioConfigManifest: [],
				studioMigrations: [],
				getBaseline: () => {
					return {
						timelineObjects: [],
					}
				},
				getShowStyleId: () => null,
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest))

			try {
				loadSystemBlueprints(core)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Evaluated Blueprint-manifest and document does not have the same blueprintType ("studio", "system")!`
				)
			}
		})
		testInFiber('Blueprint correct type', () => {
			const core = getCore()
			core.blueprintId = protectString('fake_id')
			expect(core.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'system' as BlueprintManifestType.SYSTEM,

				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest))

			const blueprint = loadSystemBlueprints(core)
			expect(blueprint).toBeTruthy()
		})
	})

	describe('loadStudioBlueprints', () => {
		function getStudio(): Studio {
			const studio = Studios.findOne() as Studio
			expect(studio).toBeTruthy()
			return studio
		}

		testInFiber('Blueprint not specified', () => {
			const studio = getStudio()
			studio.blueprintId = undefined
			expect(studio.blueprintId).toBeFalsy()

			const blueprint = loadStudioBlueprint(studio)
			expect(blueprint).toBeFalsy()
		})
		testInFiber('Blueprint does not exist', () => {
			const studio = getStudio()
			studio.blueprintId = protectString('fake_id')
			expect(studio.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))

			try {
				loadStudioBlueprint(studio)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[404] Blueprint "${studio.blueprintId}" not found! (referenced by Studio \"${studio._id}\")`
				)
			}
		})
		testInFiber('Blueprint no type', () => {
			const studio = getStudio()
			studio.blueprintId = protectString('fake_id')
			expect(studio.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id'))

			try {
				loadStudioBlueprint(studio)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\" (undefined)!`
				)
			}
		})
		testInFiber('Blueprint wrong type', () => {
			const studio = getStudio()
			studio.blueprintId = protectString('fake_id')
			expect(studio.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE))

			try {
				loadStudioBlueprint(studio)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\" (showstyle)!`
				)
			}
		})
		testInFiber('Blueprint wrong internal type', () => {
			const studio = getStudio()
			studio.blueprintId = protectString('fake_id')
			expect(studio.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'system' as BlueprintManifestType.SYSTEM,

				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.STUDIO, manifest))

			try {
				loadStudioBlueprint(studio)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Evaluated Blueprint-manifest and document does not have the same blueprintType ("system", "studio")!`
				)
			}
		})
		testInFiber('Blueprint correct type', () => {
			const studio = getStudio()
			studio.blueprintId = protectString('fake_id')
			expect(studio.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'studio' as BlueprintManifestType.STUDIO,
				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',

				studioConfigManifest: [],
				studioMigrations: [],
				getBaseline: () => {
					return {
						timelineObjects: [],
					}
				},
				getShowStyleId: () => null,
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.STUDIO, manifest))

			const blueprint = loadStudioBlueprint(studio) as WrappedStudioBlueprint
			expect(blueprint).toBeTruthy()

			expect(blueprint.blueprint.blueprintType).toEqual('studio')
		})
	})

	describe('loadShowStyleBlueprints', () => {
		function getShowStyle(): ShowStyleBase {
			const showStyle = ShowStyleBases.findOne() as ShowStyleBase
			expect(showStyle).toBeTruthy()
			return showStyle
		}

		testInFiber('Blueprint not specified', () => {
			const showStyle = getShowStyle()
			;(showStyle as any).blueprintId = undefined
			expect(showStyle.blueprintId).toBeFalsy()

			try {
				loadShowStyleBlueprint(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(`[500] ShowStyleBase "${showStyle._id}" has no defined blueprint!`)
			}
		})
		testInFiber('Blueprint does not exist', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = protectString('fake_id')
			expect(showStyle.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))

			try {
				loadShowStyleBlueprint(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[404] Blueprint "${showStyle.blueprintId}" not found! (referenced by ShowStyleBase \"${showStyle._id}\")`
				)
			}
		})
		testInFiber('Blueprint no type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = protectString('fake_id')
			expect(showStyle.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id'))

			try {
				loadShowStyleBlueprint(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\" (undefined)!`
				)
			}
		})
		testInFiber('Blueprint wrong type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = protectString('fake_id')
			expect(showStyle.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM))

			try {
				loadShowStyleBlueprint(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\" (system)!`
				)
			}
		})
		testInFiber('Blueprint wrong internal type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = protectString('fake_id')
			expect(showStyle.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'system' as BlueprintManifestType.SYSTEM,

				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE, manifest))

			try {
				loadShowStyleBlueprint(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Evaluated Blueprint-manifest and document does not have the same blueprintType ("system", "showstyle")!`
				)
			}
		})
		testInFiber('Blueprint correct type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = protectString('fake_id')
			expect(showStyle.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'showstyle' as BlueprintManifestType.SHOWSTYLE,

				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',

				showStyleConfigManifest: [],
				showStyleMigrations: [],
				getShowStyleVariantId: () => null,
				getRundown: () => null as any as BlueprintResultRundown,
				getSegment: () => null as any as BlueprintResultSegment,
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE, manifest))

			const blueprint = loadShowStyleBlueprint(showStyle)
			expect(blueprint).toBeTruthy()
		})
	})

	describe('getBlueprintOfRundown', () => {
		function getRundown() {
			return new Rundown(
				literal<DBRundown>({
					_id: protectString('ro1'),
					playlistId: protectString('pls0'),
					_rank: 1,
					externalId: 'ro1',
					studioId: protectString('studio0'),
					showStyleBaseId: protectString(''),
					showStyleVariantId: protectString('variant0'),
					peripheralDeviceId: protectString(''),
					created: 0,
					modified: 0,
					importVersions: {} as any,
					name: 'test',
					externalNRCSName: 'mockNRCS',
					organizationId: protectString(''),
				})
			)
		}
		testInFiber('Valid showStyleBase', () => {
			const showStyle = ShowStyleBases.findOne() as ShowStyleBase
			expect(showStyle).toBeTruthy()

			const rundown = getRundown()
			rundown.showStyleBaseId = showStyle._id

			const blueprint = loadShowStyleBlueprint(showStyle)
			expect(blueprint).toBeTruthy()
		})
	})
})
