import { getRandomId } from '../../../lib/lib'
import { beforeEachInFiber, testInFiber } from '../../../__mocks__/helpers/jest'

import '../../collections' // include this in order to get all of the collection set up
import { cleanupOldDataInner } from '../cleanup'
import {
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupDefaultStudioEnvironment,
} from '../../../__mocks__/helpers/database'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	RundownPlaylists,
	Rundowns,
	Studios,
	ShowStyleBases,
	Blueprints,
	PeripheralDevices,
	Workers,
	TriggeredActions,
	PartInstances,
	PieceInstances,
	Segments,
	Parts,
	Pieces,
	AdLibActions,
	Buckets,
	BucketAdLibActions,
	BucketAdLibs,
	Evaluations,
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExpectedPlayoutItems,
	ExternalMessageQueue,
	IngestDataCache,
	PackageContainerPackageStatuses,
	PackageInfos,
	PeripheralDeviceCommands,
	RundownBaselineAdLibActions,
	RundownBaselineObjs,
	RundownLayouts,
	Snapshots,
	UserActionsLog,
	Timeline,
	TranslationsBundles,
	PackageContainerStatuses,
	TimelineDatastore,
} from '../../collections'
import { Collections } from '../../collections/lib'
import { generateTranslationBundleOriginId } from '../translationsBundles'

describe('Cleanup', () => {
	let env: DefaultEnvironment

	beforeEachInFiber(async () => {
		clearAllDBCollections()
		env = await setupDefaultStudioEnvironment()
	})

	testInFiber('Check that all collections are covered', async () => {
		expect(Collections.size).toBeGreaterThan(10)

		const result = await cleanupOldDataInner(false)
		expect(typeof result).not.toBe('string')

		for (const name of Collections.keys()) {
			// Check that the collection has been handled in the function cleanupOldDataInner:
			expect(result).toHaveProperty(name)
		}
	})

	testInFiber('No bad removals', async () => {
		// Check that cleanupOldDataInner() doesn't remove any data when the default data set is in the DB.

		setDefaultDatatoDB(env, Date.now())

		const results = await cleanupOldDataInner(true)

		expect(typeof results).not.toBe('string')
		if (typeof results === 'string') throw new Error(results)

		for (const result of Object.values(results)) {
			try {
				expect(result.docsToRemove).toBe(0)
			} catch (e) {
				throw new Error(`${result.collectionName} ${e}`)
			}
		}

		expect(RundownPlaylists.find().count()).toBe(1)
		expect(Rundowns.find().count()).toBe(1)
	})
	testInFiber('All dependants should be removed', async () => {
		// Check that cleanupOldDataInner() cleans up all data from the database.

		setDefaultDatatoDB(env, 0)

		// Pre-check, just to check that there is data in the DB:
		expect(RundownPlaylists.find().count()).toBeGreaterThanOrEqual(1)
		expect(Rundowns.find().count()).toBeGreaterThanOrEqual(1)

		// Remove top-level documents, so that dependants will be removed in cleanup:
		Studios.remove({})
		ShowStyleBases.remove({})
		Blueprints.remove({})
		PeripheralDevices.remove({})

		// Manually clean up things that aren't cleaned up in cleanupOldDataInner:
		await Workers.removeAsync({})
		TriggeredActions.remove({
			showStyleBaseId: null,
		})

		const results = await cleanupOldDataInner(true)

		expect(typeof results).not.toBe('string')
		if (typeof results === 'string') throw new Error(results)

		for (const [collectionName, collection] of Collections.entries()) {
			if (
				[
					// Ignore these:
					'coreSystem',
					'workers',
				].includes(collectionName)
			)
				continue

			try {
				expect(collection.find().count()).toBe(0)
			} catch (e) {
				throw new Error(`${collectionName} ${e}`)
			}
		}
	})
	testInFiber('PieceInstance should be removed when PartInstance is removed', async () => {
		// Check that cleanupOldDataInner() cleans up all data from the database.

		setDefaultDatatoDB(env, 0)

		// Pre-check, just to check that there is data in the DB:
		expect(PartInstances.find().count()).toBeGreaterThanOrEqual(1)
		expect(PieceInstances.find().count()).toBeGreaterThanOrEqual(1)

		// Remove PartInstances, so that dependants will be removed in cleanup:
		PartInstances.remove({})

		const results = await cleanupOldDataInner(true)

		expect(typeof results).not.toBe('string')
		if (typeof results === 'string') throw new Error(results)

		expect(PartInstances.find().count()).toBeGreaterThanOrEqual(0)
		expect(PieceInstances.find().count()).toBeGreaterThanOrEqual(0)
	})
})

/**
 * Add "one of each" document into the database
 */
function setDefaultDatatoDB(env: DefaultEnvironment, now: number) {
	const studioId = env.studio._id
	const showStyleBaseId = env.showStyleBaseId
	const showStyleVariantId = env.showStyleVariantId
	const deviceId = env.ingestDevice._id

	const { playlistId, rundownId } = setupDefaultRundownPlaylist(env)

	const segment = Segments.findOne({ rundownId })
	if (!segment) throw new Error('No Segment found')
	const segmentId = segment._id

	const part = Parts.findOne({ rundownId })
	if (!part) throw new Error('No Part found')
	const partId = part._id

	const piece: Piece = {
		_id: getRandomId(),
		content: {} as any,
		enable: {} as any,
		externalId: '',
		invalid: false,
		lifespan: {} as any,
		name: 'mock',
		outputLayerId: '',
		sourceLayerId: '',
		pieceType: '' as any,
		startPartId: partId,
		startRundownId: rundownId,
		startSegmentId: segmentId,
		status: '' as any,
		timelineObjectsString: '' as any,
	}
	const pieceId = Pieces.insert(piece)

	AdLibActions.insert({
		_id: getRandomId(),
		actionId: '',
		externalId: '',
		partId,
		rundownId,
		display: {} as any,
		userData: {} as any,
		userDataManifest: {} as any,
	})

	const bucketId = Buckets.insert({
		_id: getRandomId(),
		_rank: 0,
		buttonHeightScale: 0,
		buttonWidthScale: 0,
		name: 'mock',
		studioId,
	})
	BucketAdLibActions.insert({
		_id: getRandomId(),
		bucketId,
		externalId: '',
		studioId,
		showStyleBaseId: env.showStyleBaseId,
		actionId: '',
		display: {} as any,
		importVersions: {} as any,
		showStyleVariantId,
		userData: {} as any,
		userDataManifest: {} as any,
	})
	BucketAdLibs.insert({
		_id: getRandomId(),
		bucketId,
		externalId: '',
		studioId,
		showStyleBaseId: env.showStyleBaseId,
		importVersions: {} as any,
		showStyleVariantId,
		_rank: 0,
		content: {} as any,
		lifespan: {} as any,
		name: 'mock',
		outputLayerId: '',
		sourceLayerId: '',
		timelineObjectsString: '' as any,
	})
	Evaluations.insert({
		_id: getRandomId(),
		answers: {} as any,
		organizationId: null,
		playlistId,
		studioId,
		timestamp: now,
		userId: null,
	})
	const packageId = ExpectedPackages.insert({
		_id: getRandomId(),
		blueprintPackageId: '',
		bucketId,
		content: {} as any,
		contentVersionHash: '',
		created: 0,
		fromPieceType: '' as any,
		layers: [],
		pieceId,
		rundownId,
		segmentId,
		sideEffect: {} as any,
		studioId,
		sources: {} as any,
		type: '' as any,
		version: {} as any,
	})
	ExpectedPackageWorkStatuses.insert({
		_id: getRandomId(),
		deviceId,
		studioId,
		description: '',
		fromPackages: [],
		label: '',
		modified: 0,
		priority: 0,
		status: {} as any,
		statusChanged: 0,
		statusReason: {} as any,
	})
	ExpectedPlayoutItems.insert({
		_id: getRandomId(),
		content: {} as any,
		deviceSubType: {} as any,
		rundownId,
		studioId,
	})
	ExternalMessageQueue.insert({
		_id: getRandomId(),
		created: now,
		expires: now + 100000,
		message: '',
		receiver: {} as any,
		studioId,
		tryCount: 0,
		type: '' as any,
	})
	IngestDataCache.insert({
		_id: getRandomId(),
		data: {} as any,
		modified: 0,
		rundownId,
		type: '' as any,
	})
	PackageContainerPackageStatuses.insert({
		_id: getRandomId(),
		containerId: '',
		deviceId,
		modified: 0,
		packageId,
		status: '' as any,
		studioId,
	})
	PackageContainerStatuses.insert({
		_id: getRandomId(),
		containerId: '',
		deviceId,
		modified: now,
		status: {} as any,
		studioId,
	})
	PackageInfos.insert({
		_id: getRandomId(),
		actualContentVersionHash: '',
		deviceId,
		expectedContentVersionHash: '',
		packageId,
		payload: {} as any,
		studioId,
		type: '' as any,
	})

	const partInstanceId = PartInstances.insert({
		_id: getRandomId(),
		isTemporary: false,
		part: part,
		playlistActivationId: getRandomId(),
		rehearsal: false,
		rundownId,
		segmentId,
		segmentPlayoutId: getRandomId(),
		takeCount: 0,
	})
	PieceInstances.insert({
		_id: getRandomId(),
		partInstanceId,
		piece,
		playlistActivationId: getRandomId(),
		rundownId,
	})
	PeripheralDeviceCommands.insert({
		_id: getRandomId(),
		args: [],
		deviceId,
		functionName: '',
		hasReply: false,
		time: 0,
	})
	RundownBaselineAdLibActions.insert({
		_id: getRandomId(),
		actionId: '',
		display: {} as any,
		externalId: '',
		rundownId,
		userData: {} as any,
		userDataManifest: {} as any,
	})
	RundownBaselineObjs.insert({
		_id: getRandomId(),
		rundownId,
		timelineObjectsString: '' as any,
	})
	RundownLayouts.insert({
		_id: getRandomId(),
		icon: '',
		iconColor: '',
		isDefaultLayout: false,
		name: '',
		regionId: {} as any,
		showStyleBaseId,
		type: '' as any,
	})
	Snapshots.insert({
		_id: getRandomId(),
		comment: '',
		created: now,
		fileName: '',
		name: '',
		organizationId: null,
		type: '' as any,
		version: '',
	})
	Timeline.insert({
		_id: studioId,
		generated: now,
		generationVersions: {} as any,
		timelineBlob: '' as any,
		timelineHash: '' as any,
	})
	TimelineDatastore.insert({
		_id: getRandomId(),
		key: '',
		mode: '' as any,
		modified: now,
		studioId,
		value: 0,
	})
	UserActionsLog.insert({
		_id: getRandomId(),
		args: '',
		clientAddress: '',
		context: '',
		method: '',
		organizationId: null,
		timestamp: now,
		userId: null,
	})

	TranslationsBundles.insert({
		_id: getRandomId(),
		data: [],
		hash: '',
		language: '',
		originId: generateTranslationBundleOriginId(env.studioBlueprint._id, 'blueprints'),
		type: '' as any,
	})
	TranslationsBundles.insert({
		_id: getRandomId(),
		data: [],
		hash: '',
		language: '',
		originId: generateTranslationBundleOriginId(deviceId, 'peripheralDevice'),
		type: '' as any,
	})

	// Ensure that we have added one of everything:
	for (const [collectionName, collection] of Collections.entries()) {
		if (
			[
				// Ignore these:
				'organizations',
				'Users',
				// Deprecated:
				'expectedMediaItems',
				'mediaObjects',
				'mediaWorkFlows',
				'mediaWorkFlowSteps',
			].includes(collectionName)
		)
			continue

		try {
			if (!collection.find().count()) console.log(collectionName)
			expect(collection.find().count()).toBeGreaterThanOrEqual(1)
		} catch (e) {
			throw new Error(`${collectionName} ${e}`)
		}
	}
}

function clearAllDBCollections() {
	for (const collection of Collections.values()) {
		collection.remove({})
	}
}
