import * as _ from 'underscore'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { Rundown, DBRundown } from '../../../../lib/collections/Rundowns'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { literal } from '../../../../lib/lib'
import { loadSystemBlueprints, loadStudioBlueprints, loadShowStyleBlueprints, getBlueprintOfRundown } from '../cache'
import { getCoreSystem, ICoreSystem } from '../../../../lib/collections/CoreSystem'
import { Blueprints, Blueprint } from '../../../../lib/collections/Blueprints'
import { BlueprintManifestType } from 'tv-automation-sofie-blueprints-integration'
import { Studios, Studio } from '../../../../lib/collections/Studios'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'

// require('../api.ts') // include in order to create the Meteor methods needed

describe('Test blueprint cache', () => {

	beforeAll(() => {
		setupDefaultStudioEnvironment()
	})

	function generateFakeBlueprint (id: string, type?: BlueprintManifestType, code?: string) {
		return literal<Blueprint>({
			_id: id,
			name: 'Fake blueprint',
			code: `{default: (${code || '() => 5'})()}`,
			created: 0,
			modified: 0,

			blueprintType: type,

			studioConfigManifest: [],
			showStyleConfigManifest: [],

			databaseVersion: {
				showStyle: {},
				studio: {},
			},

			blueprintVersion: '',
			integrationVersion: '',
			TSRVersion: '',
			minimumCoreVersion: '',
		})
	}

	describe('loadSystemBlueprints', () => {
		function getCore (): ICoreSystem {
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
			core.blueprintId = 'fake_id'
			expect(core.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')

			try {
				loadSystemBlueprints(core)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[404] Blueprint "${core.blueprintId}" not found! (referenced by CoreSystem)`)
			}
		})
		testInFiber('Blueprint no type', () => {
			const core = getCore()
			core.blueprintId = 'fake_id'
			expect(core.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id'))

			try {
				loadSystemBlueprints(core)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem!`)
			}
		})
		testInFiber('Blueprint wrong type', () => {
			const core = getCore()
			core.blueprintId = 'fake_id'
			expect(core.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE))

			try {
				loadSystemBlueprints(core)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem!`)
			}
		})
		testInFiber('Blueprint wrong internal type', () => {
			const core = getCore()
			core.blueprintId = 'fake_id'
			expect(core.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'studio'
			})

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest.toString()))

			try {
				loadSystemBlueprints(core)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${core.blueprintId}" is not valid for a CoreSystem!`)
			}
		})
		testInFiber('Blueprint correct type', () => {
			const core = getCore()
			core.blueprintId = 'fake_id'
			expect(core.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'system'
			})

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest.toString()))

			const blueprint = loadSystemBlueprints(core)
			expect(blueprint).toBeTruthy()
		})
	})

	describe('loadStudioBlueprints', () => {
		function getStudio (): Studio {
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
			studio.blueprintId = 'fake_id'
			expect(studio.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')

			try {
				loadStudioBlueprints(studio)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[404] Blueprint "${studio.blueprintId}" not found! (referenced by Studio \"${studio._id}\")`)
			}
		})
		testInFiber('Blueprint no type', () => {
			const studio = getStudio()
			studio.blueprintId = 'fake_id'
			expect(studio.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id'))

			try {
				loadStudioBlueprints(studio)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\"!`)
			}
		})
		testInFiber('Blueprint wrong type', () => {
			const studio = getStudio()
			studio.blueprintId = 'fake_id'
			expect(studio.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE))

			try {
				loadStudioBlueprints(studio)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\"!`)
			}
		})
		testInFiber('Blueprint wrong internal type', () => {
			const studio = getStudio()
			studio.blueprintId = 'fake_id'
			expect(studio.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'system'
			})

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest.toString()))

			try {
				loadStudioBlueprints(studio)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${studio.blueprintId}" is not valid for a Studio \"${studio._id}\"!`)
			}
		})
		testInFiber('Blueprint correct type', () => {
			const studio = getStudio()
			studio.blueprintId = 'fake_id'
			expect(studio.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'studio'
			})

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest.toString()))

			const blueprint = loadStudioBlueprints(studio)
			expect(blueprint).toBeTruthy()
		})
	})

	describe('loadShowStyleBlueprints', () => {
		function getShowStyle (): ShowStyleBase {
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
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] ShowStyleBase "${showStyle._id}" has no defined blueprint!`)
			}
		})
		testInFiber('Blueprint does not exist', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = 'fake_id'
			expect(showStyle.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')

			try {
				loadShowStyleBlueprints(showStyle)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[404] Blueprint "${showStyle.blueprintId}" not found! (referenced by ShowStyleBase \"${showStyle._id}\")`)
			}
		})
		testInFiber('Blueprint no type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = 'fake_id'
			expect(showStyle.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id'))

			try {
				loadShowStyleBlueprints(showStyle)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\"!`)
			}
		})
		testInFiber('Blueprint wrong type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = 'fake_id'
			expect(showStyle.blueprintId).toBeTruthy()

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SHOWSTYLE))

			try {
				loadShowStyleBlueprints(showStyle)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\"!`)
			}
		})
		testInFiber('Blueprint wrong internal type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = 'fake_id'
			expect(showStyle.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'system'
			})

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest.toString()))

			try {
				loadShowStyleBlueprints(showStyle)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[500] Blueprint "${showStyle.blueprintId}" is not valid for a ShowStyle \"${showStyle._id}\"!`)
			}
		})
		testInFiber('Blueprint correct type', () => {
			const showStyle = getShowStyle()
			showStyle.blueprintId = 'fake_id'
			expect(showStyle.blueprintId).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'showstyle'
			})

			Blueprints.remove('fake_id')
			Blueprints.insert(generateFakeBlueprint('fake_id', BlueprintManifestType.SYSTEM, manifest.toString()))

			const blueprint = loadShowStyleBlueprints(showStyle)
			expect(blueprint).toBeTruthy()
		})
	})

	describe('getBlueprintOfRundown', () => {
		function getRundown () {
			return new Rundown(literal<DBRundown>({
				_id: 'ro1',
				externalId: 'ro1',
				studioId: 'studio0',
				showStyleBaseId: '',
				showStyleVariantId: 'variant0',
				peripheralDeviceId: '',
				dataSource: '',
				created: 0,
				modified: 0,
				importVersions: {} as any,
				name: 'test',

				previousPartId: null,
				currentPartId: null,
				nextPartId: null
			}))
		}
		testInFiber('Missing showStyleBaseId', () => {
			const rundown = getRundown()
			expect(rundown.showStyleBaseId).toBeFalsy()

			try {
				getBlueprintOfRundown(rundown, true)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[400] Rundown "${rundown._id}" is missing showStyleBaseId!`)
			}
		})
		testInFiber('Missing showStyleBase', () => {
			const rundown = getRundown()
			rundown.showStyleBaseId = 'fake0'

			try {
				getBlueprintOfRundown(rundown, true)
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[404] ShowStyleBase "${rundown.showStyleBaseId}" not found! (referenced by Rundown "${rundown._id}")`)
			}
		})
		testInFiber('Valid showStyleBase', () => {
			const showStyle = ShowStyleBases.findOne() as ShowStyleBase
			expect(showStyle).toBeTruthy()

			const rundown = getRundown()
			rundown.showStyleBaseId = showStyle._id

			const blueprint = getBlueprintOfRundown(rundown, true)
			expect(blueprint).toBeTruthy()
		})
		testInFiber('Test caching', () => {
			jest.useFakeTimers()

			try {
				const showStyle = ShowStyleBases.findOne() as ShowStyleBase
				expect(showStyle).toBeTruthy()

				const rundown = getRundown()
				rundown.showStyleBaseId = showStyle._id

				const blueprint1 = getBlueprintOfRundown(rundown)
				expect(blueprint1).toBeTruthy()

				jest.runTimersToTime(500)

				rundown.showStyleBaseId = 'abc' // Not real
				const blueprint2 = getBlueprintOfRundown(rundown)
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
