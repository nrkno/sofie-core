import * as _ from 'underscore'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { Rundown, DBRundown } from '../../../../lib/collections/Rundowns'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { literal, protectString } from '../../../../lib/lib'
import {
	loadSystemBlueprints,
	loadStudioBlueprints,
	loadShowStyleBlueprints,
	getBlueprintOfRundown,
	WrappedStudioBlueprint,
} from '../cache'
import { getCoreSystem, ICoreSystem } from '../../../../lib/collections/CoreSystem'
import { Blueprints } from '../../../../lib/collections/Blueprints'
import {
	BlueprintManifestType,
	BlueprintResultRundown,
	BlueprintResultSegment,
} from 'tv-automation-sofie-blueprints-integration'
import { Studios, Studio } from '../../../../lib/collections/Studios'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { generateFakeBlueprint } from './lib'

describe('Test blueprint cache', () => {
	beforeAll(() => {
		setupDefaultStudioEnvironment()
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
				expect(e.message).toBe(`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem!`)
			}
		})
		testInFiber('Blueprint wrong type', () => {
			const core = getCore()
			core.blueprintId = protectString('fake_id')
			expect(core.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE))

			try {
				loadSystemBlueprints(core)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem!`)
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
				minimumCoreVersion: '0.0.0',

				studioConfigManifest: [],
				studioMigrations: [],
				getBaseline: () => [],
				getShowStyleId: () => null,
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest))

			try {
				loadSystemBlueprints(core)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem!`)
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
				minimumCoreVersion: '0.0.0',
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

			const blueprint = loadStudioBlueprints(studio)
			expect(blueprint).toBeFalsy()
		})
		testInFiber('Blueprint does not exist', () => {
			const studio = getStudio()
			studio.blueprintId = protectString('fake_id')
			expect(studio.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))

			try {
				loadStudioBlueprints(studio)
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
				loadStudioBlueprints(studio)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\"!`
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
				loadStudioBlueprints(studio)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\"!`
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
				minimumCoreVersion: '0.0.0',
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest))

			try {
				loadStudioBlueprints(studio)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\"!`
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
				minimumCoreVersion: '0.0.0',

				studioConfigManifest: [],
				studioMigrations: [],
				getBaseline: () => [],
				getShowStyleId: () => null,
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest))

			const blueprint = loadStudioBlueprints(studio) as WrappedStudioBlueprint
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
				loadShowStyleBlueprints(showStyle)
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
				loadShowStyleBlueprints(showStyle)
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
				loadShowStyleBlueprints(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\"!`
				)
			}
		})
		testInFiber('Blueprint wrong type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = protectString('fake_id')
			expect(showStyle.blueprintId).toBeTruthy()

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE))

			try {
				loadShowStyleBlueprints(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\"!`
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
				minimumCoreVersion: '0.0.0',
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest))

			try {
				loadShowStyleBlueprints(showStyle)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\"!`
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
				minimumCoreVersion: '0.0.0',

				showStyleConfigManifest: [],
				showStyleMigrations: [],
				getShowStyleVariantId: () => null,
				getRundown: () => (null as any) as BlueprintResultRundown,
				getSegment: () => (null as any) as BlueprintResultSegment,
			})

			Blueprints.remove(protectString('fake_id'))
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest))

			const blueprint = loadShowStyleBlueprints(showStyle)
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
					dataSource: '',
					created: 0,
					modified: 0,
					importVersions: {} as any,
					name: 'test',
					organizationId: protectString(''),
				})
			)
		}
		testInFiber('Missing showStyleBaseId', () => {
			const rundown = getRundown()
			expect(rundown.showStyleBaseId).toBeFalsy()

			try {
				getBlueprintOfRundown(undefined, rundown, true)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(`[400] Rundown "${rundown._id}" is missing showStyleBaseId!`)
			}
		})
		testInFiber('Missing showStyleBase', () => {
			const rundown = getRundown()
			rundown.showStyleBaseId = protectString('fake0')

			try {
				getBlueprintOfRundown(undefined, rundown, true)
				fail('expected to throw')
			} catch (e) {
				expect(e.message).toBe(
					`[404] ShowStyleBase "${rundown.showStyleBaseId}" not found! (referenced by Rundown "${rundown._id}")`
				)
			}
		})
		testInFiber('Valid showStyleBase', () => {
			const showStyle = ShowStyleBases.findOne() as ShowStyleBase
			expect(showStyle).toBeTruthy()

			const rundown = getRundown()
			rundown.showStyleBaseId = showStyle._id

			const blueprint = getBlueprintOfRundown(undefined, rundown, true)
			expect(blueprint).toBeTruthy()
		})
		testInFiber('Wrong showStyleBase', () => {
			const showStyle = ShowStyleBases.findOne() as ShowStyleBase
			expect(showStyle).toBeTruthy()

			const rundown = getRundown()
			rundown.showStyleBaseId = protectString(showStyle._id + '1')

			expect(() => getBlueprintOfRundown(showStyle, rundown, true)).toThrowError(
				`ShowStyleBase "${rundown.showStyleBaseId}" not found!`
			)
		})
		testInFiber('Test caching', () => {
			jest.useFakeTimers()

			try {
				const showStyle = ShowStyleBases.findOne() as ShowStyleBase
				expect(showStyle).toBeTruthy()

				const rundown = getRundown()
				rundown.showStyleBaseId = showStyle._id

				const blueprint1 = getBlueprintOfRundown(undefined, rundown)
				expect(blueprint1).toBeTruthy()

				jest.runTimersToTime(500)

				rundown.showStyleBaseId = protectString('abc') // Not real
				const blueprint2 = getBlueprintOfRundown(undefined, rundown)
				expect(blueprint2).toBeTruthy()

				// Should still be the same, as within cache window
				expect(blueprint2.blueprintId).toEqual(blueprint1.blueprintId)
			} finally {
				// Restore timers after run
				jest.useRealTimers()
			}
		})
		testInFiber('Test caching with fed showStyle', () => {
			jest.useFakeTimers()

			try {
				const showStyle = ShowStyleBases.findOne() as ShowStyleBase
				expect(showStyle).toBeTruthy()

				const rundown = getRundown()
				rundown.showStyleBaseId = showStyle._id

				const blueprint1 = getBlueprintOfRundown(showStyle, rundown)
				expect(blueprint1).toBeTruthy()

				jest.runTimersToTime(500)

				rundown.showStyleBaseId = protectString('abc') // Not real
				const blueprint2 = getBlueprintOfRundown(showStyle, rundown)
				expect(blueprint2).toBeTruthy()

				// Should still be the same, as within cache window
				expect(blueprint2.blueprintId).toEqual(blueprint1.blueprintId)
			} finally {
				// Restore timers after run
				jest.useRealTimers()
			}
		})
	})
})
