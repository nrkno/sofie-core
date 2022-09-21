/* eslint-disable @typescript-eslint/unbound-method */
import {
	IBlueprintPiece,
	IngestPart,
	IngestRundown,
	IngestSegment,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { getRandomId, getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { sortPartsInSortedSegments, sortSegmentsInRundowns } from '@sofie-automation/corelib/dist/playout/playlist'
import { MongoQuery } from '../../db'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { setupMockPeripheralDevice, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import {
	handleRemovedPart,
	handleRemovedRundown,
	handleRemovedSegment,
	handleRemoveOrphanedSegemnts,
	handleUpdatedPart,
	handleUpdatedRundown,
	handleUpdatedRundownMetaData,
	handleUpdatedSegment,
	handleUpdatedSegmentRanks,
} from '../rundownInput'
import { activateRundownPlaylist, setMinimumTakeSpan, takeNextPart } from '../../playout/playout'
import { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getSelectedPartInstances } from '../../playout/__tests__/lib'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { runJobWithPlayoutCache } from '../../playout/lock'
import { getSelectedPartInstancesFromCache } from '../../playout/cache'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { innerStartQueuedAdLib } from '../../playout/adlib'
import { IngestJobs, RemoveOrphanedSegmentsProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { removeRundownPlaylistFromDb } from './lib'

require('../../peripheralDevice.ts') // include in order to create the Meteor methods needed

describe('Test ingest actions for rundowns and segments', () => {
	let context: MockJobContext

	let device: PeripheralDevice
	let device2: PeripheralDevice
	const externalId = 'abcde'
	const segExternalId = 'zyxwv'
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		const showStyleCompound = await setupMockShowStyleCompound(context)

		context.setStudio({
			...context.studio,
			supportedShowStyleBase: [showStyleCompound._id],
		})

		device = await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.INGEST,
			PeripheralDeviceType.MOS,
			PERIPHERAL_SUBTYPE_PROCESS
		)
		device2 = await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.INGEST,
			// @ts-ignore
			'mockDeviceType',
			PERIPHERAL_SUBTYPE_PROCESS
		)

		jest.clearAllMocks()

		setMinimumTakeSpan(0)
	})

	beforeEach(async () => {
		// Ensure the preserveUnsyncedPlayingSegmentContents setting is disabled
		context.setStudio({
			...context.studio,
			settings: {
				...context.studio.settings,
				preserveUnsyncedPlayingSegmentContents: false,
			},
		})

		context.queueIngestJob = jest.fn(() => {
			throw new Error('Not implemented')
		})
	})
	async function getRundownData(query?: MongoQuery<DBRundown>) {
		const rundown = (await context.directCollections.Rundowns.findOne(query)) as DBRundown
		expect(rundown).toBeTruthy()
		const rundownPlaylist = (await context.directCollections.RundownPlaylists.findOne(
			rundown.playlistId
		)) as DBRundownPlaylist
		expect(rundownPlaylist).toBeTruthy()

		const rawSegments = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
		const rawParts = await context.directCollections.Parts.findFetch({ rundownId: rundown._id })

		const segments = sortSegmentsInRundowns(rawSegments, { rundownIdsInOrder: [rundown._id] })
		const parts = sortPartsInSortedSegments(rawParts, segments)

		return {
			rundown,
			rundownPlaylist,
			segments,
			parts,
		}
	}

	test('dataRundownCreate', async () => {
		// setLogLevel(LogLevel.DEBUG)

		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
		})

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})

		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
			playlistId: savedRundownData.rundownPlaylist._id,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownUpdate change name', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundownRenamed',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
		})

		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.directCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
			name: rundownData.name,
		})

		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
			name: rundownData.name,
			playlistId: savedRundownData.rundownPlaylist._id,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownUpdate add a segment', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
		})

		await expect(context.directCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(3)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)

		const parts2 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[2]._id)
		expect(parts2).toHaveLength(1)
	})

	test('dataRundownUpdate add a part', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
						},
						{
							externalId: 'partZ',
							name: 'Part Z',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}
		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
		})

		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.directCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(3)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(2)
		expect(parts1.map((x) => x.title)).toEqual(['Part 2', 'Part Z'])

		const parts2 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[2]._id)
		expect(parts2).toHaveLength(1)
	})

	test('dataRundownUpdate remove a segment', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}
		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
		})

		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.directCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownUpdate remove a part', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
		})

		await expect(context.directCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(1)
		expect(parts0[0].externalId).toBe('part1')

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownMetaDataUpdate change name, does not remove segments', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		const rundownData: Omit<IngestRundown, 'segments'> = {
			externalId: externalId,
			name: 'MyMockRundownRenamed',
			type: 'mock',
		}

		await handleUpdatedRundownMetaData(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
		})

		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.directCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
			name: rundownData.name,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
			name: rundownData.name,
			playlistId: savedRundownData.rundownPlaylist._id,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(1)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownDelete', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()

		await handleRemovedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
		})

		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()
		await expect(context.directCollections.Segments.findFetch()).resolves.toHaveLength(0)
		await expect(context.directCollections.Parts.findFetch()).resolves.toHaveLength(0)
	})

	test('dataRundownDelete for a second time', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()

		await expect(
			handleRemovedRundown(context, {
				peripheralDeviceId: device._id,
				rundownExternalId: externalId,
			})
		).rejects.toThrow(/Rundown.*not found/i)
	})

	// Note: this test fails, due to a backwards-compatibility hack in #c579c8f0
	// eslint-disable-next-line jest/no-commented-out-tests
	// test('dataRundownDelete bad device', () => {
	// 	await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()
	// 	try {
	// 		Meteor.call(
	// 			PeripheralDeviceAPIMethods.dataRundownDelete,
	// 			unprotectString(device._id).slice(0, -1),
	// 			device.token,
	// 			externalId
	// 		)
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe('[404] PeripheralDevice "mockDevice" not found')
	// 	}
	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.dataRundownDelete, device._id, device.token.slice(0, -1), externalId)
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe('[401] Not allowed access to peripheralDevice')
	// 	}
	// })

	// Reject update when no preceeding create
	test('dataRundownUpdate when not yet created', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}

		await expect(
			handleUpdatedRundown(context, {
				peripheralDeviceId: device._id,
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: false,
			})
		).rejects.toThrow(/Rundown.*not found/)

		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()
	})

	test('dataRundownUpdate fail when rundown is orphaned', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()

		const rundownData0: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData0.externalId,
			ingestRundown: rundownData0,
			isCreateAction: true,
		})

		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		await context.directCollections.Rundowns.update({}, { $set: { orphaned: 'deleted' } })

		const rundown0 = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown0).toBeTruthy()
		expect(rundown0.orphaned).toEqual('deleted')
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown0._id })).resolves.toHaveLength(2)

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
			],
		}

		// Submit an update trying to remove a segment
		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
		})

		// Segment count should not have changed
		const rundown1 = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown1).toBeTruthy()
		expect(rundown1.orphaned).toEqual('deleted')
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown1._id })).resolves.toHaveLength(2)
	})

	test('dataRundownCreate replace orphaned rundown', async () => {
		await expect(context.directCollections.Rundowns.findFetch({ orphaned: 'deleted' })).resolves.toHaveLength(1)

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
		})

		await expect(context.directCollections.Rundowns.findFetch({ orphaned: 'deleted' })).resolves.toHaveLength(0)
	})

	test('dataSegmentCreate in deleted rundown', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		await context.directCollections.Rundowns.update({}, { $set: { orphaned: 'deleted' } })

		const rundown0 = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown0).toBeTruthy()
		expect(rundown0.orphaned).toEqual('deleted')
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown0._id })).resolves.toHaveLength(2)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			parts: [],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: true,
		})

		await expect(context.directCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeFalsy()

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown0._id })).resolves.toHaveLength(2)
	})

	test('dataSegmentCreate', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		await context.directCollections.Rundowns.update({}, { $unset: { orphaned: 1 } })

		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			parts: [],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: true,
		})

		const segment = await context.directCollections.Segments.findOne({ externalId: segExternalId })
		expect(segment).toBeTruthy()
		expect(segment).toMatchObject({
			externalId: ingestSegment.externalId,
			name: 'MyMockSegment',
		})

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)
	})

	test('dataSegmentCreate replace deleted segment', async () => {
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeTruthy()
		await context.directCollections.Rundowns.update({}, { $unset: { orphaned: 1 } })

		const segment0 = (await context.directCollections.Segments.findOne({ externalId: segExternalId })) as DBSegment
		expect(segment0).toBeTruthy()
		await context.directCollections.Segments.update(segment0._id, {
			$set: { orphaned: SegmentOrphanedReason.DELETED },
		})

		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment2',
			rank: 0,
			parts: [],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: true,
		})

		const segment = await context.directCollections.Segments.findOne({ externalId: segExternalId })
		expect(segment).toBeTruthy()
		expect(segment).toMatchObject({
			name: 'MyMockSegment2',
		})
	})

	test('dataSegmentUpdate add a part', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await context.directCollections.Segments.update({ rundownId: rundown._id }, { $unset: { orphaned: 1 } })
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			parts: [
				{
					externalId: 'part42',
					name: 'Part 42',
					rank: 0,
				},
			],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		const segments = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segments).toHaveLength(3)

		const parts3 = await context.directCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segments[2]._id,
		})
		expect(parts3).toHaveLength(1)
		expect(parts3[0]).toMatchObject({
			externalId: 'part42',
			title: 'Part 42',
		})
	})

	test('dataSegmentUpdate deleted segment', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)
		await context.directCollections.Segments.update(
			{ rundownId: rundown._id },
			{ $set: { orphaned: SegmentOrphanedReason.DELETED } }
		)

		const segmentBefore = (await context.directCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentBefore).toBeTruthy()

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment2',
			rank: 0,
			parts: [
				{
					externalId: 'part423',
					name: 'Part 423',
					rank: 0,
				},
			],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		// Ensure no changes
		const segmentAfter = (await context.directCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentAfter).toStrictEqual(segmentBefore)
	})

	test('dataSegmentUpdate deleted rundown', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await context.directCollections.Rundowns.update({}, { $set: { orphaned: 'deleted' } })
		await context.directCollections.Segments.update({ rundownId: rundown._id }, { $unset: { orphaned: 1 } })
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		const segmentBefore = (await context.directCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentBefore).toBeTruthy()

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment2',
			rank: 0,
			parts: [
				{
					externalId: 'part423',
					name: 'Part 423',
					rank: 0,
				},
			],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		// Ensure no changes
		const segmentAfter = (await context.directCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentAfter).toStrictEqual(segmentBefore)
	})

	test('dataSegmentUpdate non-existant rundown', async () => {
		const segExternalId2 = getRandomString()
		const ingestSegment: IngestSegment = {
			externalId: segExternalId2,
			name: 'MyMockSegment',
			rank: 0,
			parts: [],
		}

		await expect(context.directCollections.Segments.findOne({ externalId: segExternalId2 })).resolves.toBeFalsy()

		await expect(
			handleUpdatedSegment(context, {
				peripheralDeviceId: device._id,
				rundownExternalId: 'wibble',
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})
		).rejects.toThrow(/Rundown.*not found/)

		await expect(context.directCollections.Segments.findOne({ externalId: segExternalId2 })).resolves.toBeFalsy()
	})

	test('dataSegmentUpdate no change', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await context.directCollections.Rundowns.update({}, { $unset: { orphaned: 1 } })
		await context.directCollections.Segments.update({ rundownId: rundown._id }, { $unset: { orphaned: 1 } })
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			parts: [
				{
					externalId: 'part42',
					name: 'Part 42',
					rank: 0,
				},
			],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		const segments = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segments).toHaveLength(3)

		const parts3 = await context.directCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segments[2]._id,
		})
		expect(parts3).toHaveLength(1)
		expect(parts3[0]).toMatchObject({
			externalId: 'part42',
			title: 'Part 42',
		})
	})

	test('dataSegmentUpdate remove a part', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			parts: [],
		}

		await handleUpdatedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		const segments = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segments).toHaveLength(3)

		const parts3 = await context.directCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segments[2]._id,
		})
		expect(parts3).toHaveLength(0)
	})

	test('dataSegmentUpdate no external id', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		const ingestSegment: IngestSegment = {
			externalId: '',
			name: 'MyMockSegment',
			rank: 0,
			parts: [],
		}

		await expect(
			handleUpdatedSegment(context, {
				peripheralDeviceId: device._id,
				rundownExternalId: externalId,
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})
		).rejects.toThrow(`getSegmentId: segmentExternalId must be set!`)
	})

	test('dataSegmentDelete already orphaned segment', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(
			context.directCollections.Segments.findFetch({ rundownId: rundown._id, externalId: segExternalId })
		).resolves.toHaveLength(1)

		await context.directCollections.Rundowns.update({}, { $unset: { orphaned: 1 } })
		await context.directCollections.Segments.update(
			{ rundownId: rundown._id, externalId: segExternalId },
			{ $set: { orphaned: SegmentOrphanedReason.DELETED } }
		)

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		await handleRemovedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			segmentExternalId: segExternalId,
		})

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)
		await expect(context.directCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeTruthy()
	})

	test('dataSegmentDelete in deleted rundown', async () => {
		// reset rundown
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
						},
					],
				},
				{
					externalId: segExternalId,
					name: 'Segment 3',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
		})

		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(
			context.directCollections.Segments.findFetch({ rundownId: rundown._id, externalId: segExternalId })
		).resolves.toHaveLength(1)

		await context.directCollections.Rundowns.update({}, { $set: { orphaned: 'deleted' } })
		await context.directCollections.Segments.update({ rundownId: rundown._id }, { $unset: { orphaned: 1 } })

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		await handleRemovedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			segmentExternalId: segExternalId,
		})

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)
		await expect(context.directCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeTruthy()
	})

	test('dataSegmentDelete', async () => {
		// reset rundown
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
						},
					],
				},
				{
					externalId: segExternalId,
					name: 'Segment 3',
					rank: 0,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
						},
					],
				},
			],
		}

		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
		})

		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		await context.directCollections.Rundowns.update({}, { $unset: { orphaned: 1 } })
		await context.directCollections.Segments.update({ rundownId: rundown._id }, { $unset: { orphaned: 1 } })

		await handleRemovedSegment(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			segmentExternalId: segExternalId,
		})

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)
		await expect(context.directCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeFalsy()
	})

	test('dataSegmentDelete for a second time', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(
			context.directCollections.Segments.findFetch({ rundownId: rundown._id, externalId: segExternalId })
		).resolves.toHaveLength(0)

		await expect(
			handleRemovedSegment(context, {
				peripheralDeviceId: device._id,
				rundownExternalId: externalId,
				segmentExternalId: segExternalId,
			})
		).rejects.toThrow(`Rundown "${externalId}" does not have a Segment "${segExternalId}" to remove`)

		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)
	})

	test('dataSegmentDelete from non-existant rundown', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.directCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)

		await expect(
			handleRemovedSegment(context, {
				peripheralDeviceId: device._id,
				rundownExternalId: 'wibble',
				segmentExternalId: segExternalId,
			})
		).rejects.toThrow(/Rundown.*not found/i)
	})

	test('dataSegmentCreate non-existant rundown', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			parts: [],
		}
		await expect(
			handleUpdatedSegment(context, {
				peripheralDeviceId: device._id,
				rundownExternalId: 'wibble',
				ingestSegment: ingestSegment,
				isCreateAction: true,
			})
		).rejects.toThrow(/Rundown.*not found/)
	})

	test('dataPartCreate', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		const segment = (await context.directCollections.Segments.findOne({ externalId: 'segment0' })) as DBSegment
		await expect(
			context.directCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(1)

		const ingestPart: IngestPart = {
			externalId: 'party',
			name: 'Part Y',
			rank: 0,
		}

		await handleUpdatedPart(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			segmentExternalId: segment.externalId,
			ingestPart: ingestPart,
			isCreateAction: true,
		})

		await expect(
			context.directCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(2)

		const part = (await context.directCollections.Parts.findOne({ externalId: 'party' })) as DBPart
		expect(part).toMatchObject({
			externalId: ingestPart.externalId,
			title: ingestPart.name,
		})
	})

	test('dataPartUpdate', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		const segment = (await context.directCollections.Segments.findOne({ externalId: 'segment0' })) as DBSegment
		await expect(
			context.directCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(2)

		const ingestPart: IngestPart = {
			externalId: 'party',
			name: 'Part Z',
			rank: 0,
		}

		await handleUpdatedPart(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			segmentExternalId: segment.externalId,
			ingestPart: ingestPart,
			isCreateAction: false,
		})

		await expect(
			context.directCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(2)

		const part = (await context.directCollections.Parts.findOne({ externalId: 'party' })) as DBPart
		expect(part).toMatchObject({
			externalId: ingestPart.externalId,
			title: ingestPart.name,
		})
	})

	test('dataPartDelete', async () => {
		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		const segment = (await context.directCollections.Segments.findOne({ externalId: 'segment0' })) as DBSegment
		await expect(
			context.directCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(2)

		await handleRemovedPart(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			segmentExternalId: segment.externalId,
			partExternalId: 'party',
		})

		await expect(
			context.directCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(1)
		await expect(context.directCollections.Parts.findOne({ externalId: 'party' })).resolves.toBeFalsy()
	})

	// TODO Part tests are minimal/happy path only on the assumption the API gets little use

	test('dataSegmentRanksUpdate', async () => {
		await context.directCollections.Rundowns.remove({})
		await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 1,
					// payload?: any,
					parts: [],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 2,
					// payload?: any,
					parts: [],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 3,
					// payload?: any,
					parts: [],
				},
				{
					externalId: 'segment3',
					name: 'Segment 3',
					rank: 4,
					// payload?: any,
					parts: [],
				},
				{
					externalId: 'segment4',
					name: 'Segment 4',
					rank: 5,
					// payload?: any,
					parts: [],
				},
				{
					externalId: 'segment5',
					name: 'Segment 5',
					rank: 6,
					// payload?: any,
					parts: [],
				},
			],
		}
		await handleUpdatedRundown(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
		})

		const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()

		await handleUpdatedSegmentRanks(context, {
			peripheralDeviceId: device._id,
			rundownExternalId: externalId,
			newRanks: {
				['segment0']: 6,
				['segment2']: 1,
				['segment5']: 3,
			},
		})

		const segments = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segments).toHaveLength(6)

		expect(segments.find((s) => s.externalId === 'segment0')?._rank).toBe(6)
		expect(segments.find((s) => s.externalId === 'segment1')?._rank).toBe(2)
		expect(segments.find((s) => s.externalId === 'segment2')?._rank).toBe(1)
		expect(segments.find((s) => s.externalId === 'segment3')?._rank).toBe(4)
		expect(segments.find((s) => s.externalId === 'segment4')?._rank).toBe(5)
		expect(segments.find((s) => s.externalId === 'segment5')?._rank).toBe(3)
	})

	test('unsyncing of rundown', async () => {
		try {
			{
				// Cleanup any rundowns / playlists
				const playlists = await context.directCollections.RundownPlaylists.findFetch({})
				await removeRundownPlaylistFromDb(
					context,
					playlists.map((p) => p._id)
				)
			}

			const rundownData: IngestRundown = {
				externalId: externalId,
				name: 'MyMockRundown',
				type: 'mock',
				segments: [
					{
						externalId: 'segment0',
						name: 'Segment 0',
						rank: 0,
						parts: [
							{
								externalId: 'part0',
								name: 'Part 0',
								rank: 0,
							},
							{
								externalId: 'part1',
								name: 'Part 1',
								rank: 0,
							},
						],
					},
					{
						externalId: 'segment1',
						name: 'Segment 1',
						rank: 0,
						parts: [
							{
								externalId: 'part2',
								name: 'Part 2',
								rank: 0,
							},
						],
					},
				],
			}

			// Preparation: set up rundown
			await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()

			await handleUpdatedRundown(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: true,
			})

			const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
			expect(rundown).toBeTruthy()
			expect(rundown).toMatchObject({
				externalId: rundownData.externalId,
			})

			const getRundownOrphaned = async () => {
				const rd = (await context.directCollections.Rundowns.findOne(rundown._id)) as DBRundown
				return rd.orphaned
			}
			const getPlaylist = async () =>
				(await context.directCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist
			const getSegmentOrphaned = async (id: SegmentId) => {
				const segment = (await context.directCollections.Segments.findOne(id)) as DBSegment
				return segment.orphaned
			}

			const resyncRundown = async () => {
				// simulate a resync. we don't have a gateway to call out to, but this is how it will respond
				await handleUpdatedRundown(context, {
					peripheralDeviceId: device2._id,
					rundownExternalId: rundownData.externalId,
					ingestRundown: rundownData,
					isCreateAction: true,
				})
			}

			const segments = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
			const parts = await context.directCollections.Parts.findFetch({ rundownId: rundown._id })

			expect(segments).toHaveLength(2)
			expect(parts).toHaveLength(3)

			// Activate the rundown, make data updates and verify that it gets unsynced properly
			await activateRundownPlaylist(context, {
				playlistId: rundown.playlistId,
				rehearsal: true,
			})
			await expect(getRundownOrphaned()).resolves.toBeUndefined()

			await handleRemovedRundown(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
			})
			await expect(getRundownOrphaned()).resolves.toEqual('deleted')

			await resyncRundown()
			await expect(getRundownOrphaned()).resolves.toBeUndefined()

			await takeNextPart(context, { playlistId: rundown.playlistId, fromPartInstanceId: null })
			const partInstance = await context.directCollections.PartInstances.findFetch({ 'part._id': parts[0]._id })
			expect(partInstance).toHaveLength(1)
			await expect(getPlaylist()).resolves.toMatchObject({ currentPartInstanceId: partInstance[0]._id })
			expect(partInstance[0].segmentId).toEqual(segments[0]._id)

			await handleRemovedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundown.externalId,
				segmentExternalId: segments[0].externalId,
			})
			await expect(getRundownOrphaned()).resolves.toBeUndefined()
			await expect(getSegmentOrphaned(segments[0]._id)).resolves.toEqual(SegmentOrphanedReason.DELETED)

			await resyncRundown()
			await expect(getRundownOrphaned()).resolves.toBeUndefined()
			await expect(getSegmentOrphaned(segments[0]._id)).resolves.toBeUndefined()

			await handleRemovedPart(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundown.externalId,
				segmentExternalId: segments[0].externalId,
				partExternalId: parts[0].externalId,
			})
			await expect(getRundownOrphaned()).resolves.toBeUndefined()
			await expect(getSegmentOrphaned(segments[0]._id)).resolves.toBeUndefined()

			await resyncRundown()
			await expect(getRundownOrphaned()).resolves.toBeUndefined()
			await expect(getSegmentOrphaned(segments[0]._id)).resolves.toBeUndefined()
		} finally {
			// forcefully 'deactivate' the playlist to allow for cleanup to happen
			await context.directCollections.RundownPlaylists.update({}, { $unset: { activationId: 1 } })
		}
	})

	test('replace the nexted part', async () => {
		try {
			{
				// Cleanup any rundowns / playlists
				const playlists = await context.directCollections.RundownPlaylists.findFetch({})
				await removeRundownPlaylistFromDb(
					context,
					playlists.map((p) => p._id)
				)
			}

			const rundownData: IngestRundown = {
				externalId: externalId,
				name: 'MyMockRundown',
				type: 'mock',
				segments: [
					{
						externalId: 'segment0',
						name: 'Segment 0',
						rank: 0,
						parts: [
							{
								externalId: 'part0',
								name: 'Part 0',
								rank: 0,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece0',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: {
												timelineObjects: [],
											},
										}),
									],
								},
							},
							{
								externalId: 'part1',
								name: 'Part 1',
								rank: 1,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece1',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: {
												timelineObjects: [],
											},
										}),
									],
								},
							},
						],
					},
					{
						externalId: 'segment1',
						name: 'Segment 1',
						rank: 1,
						parts: [
							{
								externalId: 'part2',
								name: 'Part 2',
								rank: 0,
							},
						],
					},
				],
			}

			// Preparation: set up rundown
			await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()

			await handleUpdatedRundown(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: true,
			})

			const rundown = (await context.directCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
			expect(rundown).toBeTruthy()
			expect(rundown).toMatchObject({
				externalId: rundownData.externalId,
			})

			// const getRundown = () => Rundowns.findOne(rundown._id) as Rundown
			const getPlaylist = async () =>
				(await context.directCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist

			const segments = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
			const parts = await context.directCollections.Parts.findFetch({ rundownId: rundown._id })

			expect(segments).toHaveLength(2)
			expect(parts).toHaveLength(3)
			await expect(
				context.directCollections.Pieces.findFetch({ startRundownId: rundown._id })
			).resolves.toHaveLength(2)

			// Activate the rundown, make data updates and verify that it gets unsynced properly
			await activateRundownPlaylist(context, {
				playlistId: rundown.playlistId,
				rehearsal: true,
			})
			await expect(getPlaylist()).resolves.toMatchObject({ currentPartInstanceId: null })

			// Take the first part
			await takeNextPart(context, { playlistId: rundown.playlistId, fromPartInstanceId: null })
			await expect(getPlaylist()).resolves.toMatchObject({
				currentPartInstanceId: expect.stringContaining('random'),
			})

			{
				// Check which parts are current and next
				const playlist = await getPlaylist()
				const selectedInstances = await getSelectedPartInstances(context, playlist)
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				const nextPartInstance = selectedInstances.nextPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part0')
				expect(nextPartInstance).toBeTruthy()
				expect(nextPartInstance.part.externalId).toBe('part1')

				// we should have some pieces
				await expect(
					context.directCollections.PieceInstances.findFetch({ partInstanceId: nextPartInstance._id })
				).resolves.not.toHaveLength(0)
			}

			// Replace part1 with a new part
			const updatedSegmentData: IngestSegment = rundownData.segments[0]
			updatedSegmentData.parts[1].externalId = 'new-part'

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: updatedSegmentData,
				isCreateAction: false,
			})

			{
				const segments2 = await context.directCollections.Segments.findFetch({ rundownId: rundown._id })
				const parts2 = await context.directCollections.Parts.findFetch({ rundownId: rundown._id })

				expect(segments2).toHaveLength(2)
				expect(parts2).toHaveLength(3)

				expect(parts2.find((p) => p.externalId === 'part1')).toBeFalsy()
				const newPart = parts2.find((p) => p.externalId === 'new-part') as DBPart
				expect(newPart).toBeTruthy()

				await expect(
					context.directCollections.Pieces.findFetch({ startRundownId: rundown._id })
				).resolves.toHaveLength(2)

				// we need some pieces for the test to work
				await expect(
					context.directCollections.Pieces.findFetch({ startPartId: newPart._id })
				).resolves.not.toHaveLength(0)
			}

			{
				// Check if the partInstance was updated
				const playlist = await getPlaylist()
				const selectedInstances = await getSelectedPartInstances(context, playlist)
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				const nextPartInstance = selectedInstances.nextPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part0')
				expect(nextPartInstance).toBeTruthy()
				expect(nextPartInstance.part.externalId).toBe('new-part')

				// the pieces should have been copied
				await expect(
					context.directCollections.PieceInstances.findFetch({ partInstanceId: nextPartInstance._id })
				).resolves.not.toHaveLength(0)
			}
		} finally {
			// forcefully 'deactivate' the playlist to allow for cleanup to happen
			await context.directCollections.RundownPlaylists.update({}, { $unset: { activationId: 1 } })
		}
	})

	test('previous partinstance getting removed if an adlib part', async () => {
		try {
			{
				// Cleanup any rundowns / playlists
				const playlists = await context.directCollections.RundownPlaylists.findFetch({})
				await removeRundownPlaylistFromDb(
					context,
					playlists.map((p) => p._id)
				)
			}

			const rundownData: IngestRundown = {
				externalId: externalId,
				name: 'MyMockRundown',
				type: 'mock',
				segments: [
					{
						externalId: 'segment0',
						name: 'Segment 0',
						rank: 0,
						parts: [
							{
								externalId: 'part0',
								name: 'Part 0',
								rank: 0,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece0',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: {
												timelineObjects: [],
											},
										}),
									],
								},
							},
							{
								externalId: 'part1',
								name: 'Part 1',
								rank: 1,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece1',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: {
												timelineObjects: [],
											},
										}),
									],
								},
							},
						],
					},
					{
						externalId: 'segment1',
						name: 'Segment 1',
						rank: 1,
						parts: [
							{
								externalId: 'part2',
								name: 'Part 2',
								rank: 0,
							},
						],
					},
					{
						externalId: 'segment2',
						name: 'Segment 2',
						rank: 1,
						parts: [
							{
								externalId: 'part3',
								name: 'Part 3',
								rank: 0,
							},
						],
					},
				],
			}

			await handleUpdatedRundown(context, {
				rundownExternalId: rundownData.externalId,
				peripheralDeviceId: device2._id,
				ingestRundown: rundownData,
				isCreateAction: true,
			})

			const rundown = (await context.directCollections.Rundowns.findOne()) as DBRundown
			expect(rundown).toBeTruthy()

			// Take into first part
			await activateRundownPlaylist(context, {
				playlistId: rundown.playlistId,
				rehearsal: true,
			})
			await takeNextPart(context, {
				playlistId: rundown.playlistId,
				fromPartInstanceId: null,
			})

			const doQueuePart = async (partInstanceId: PartInstanceId): Promise<void> =>
				runJobWithPlayoutCache(
					context,
					{
						playlistId: rundown.playlistId,
					},
					null,
					async (cache) => {
						const rundown0 = cache.Rundowns.findOne({}) as DBRundown
						expect(rundown0).toBeTruthy()

						const currentPartInstance = getSelectedPartInstancesFromCache(cache)
							.currentPartInstance as DBPartInstance
						expect(currentPartInstance).toBeTruthy()

						const newPartInstance: DBPartInstance = {
							_id: partInstanceId,
							rundownId: rundown0._id,
							segmentId: currentPartInstance.segmentId,
							playlistActivationId: currentPartInstance.playlistActivationId,
							segmentPlayoutId: currentPartInstance.segmentPlayoutId,
							takeCount: currentPartInstance.takeCount + 1,
							rehearsal: true,
							part: {
								_id: protectString(`${partInstanceId}_part`),
								_rank: 0,
								rundownId: rundown0._id,
								segmentId: currentPartInstance.segmentId,
								externalId: `${partInstanceId}_externalId`,
								title: 'New part',
								expectedDurationWithPreroll: undefined,
							},
						}

						// Simulate a queued part
						await innerStartQueuedAdLib(context, cache, rundown0, currentPartInstance, newPartInstance, [])
					}
				)

			// Queue and take an adlib-part
			const partInstanceId0: PartInstanceId = getRandomId()
			await doQueuePart(partInstanceId0)
			{
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					rundown.playlistId
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()

				await takeNextPart(context, {
					playlistId: rundown.playlistId,
					fromPartInstanceId: playlist.currentPartInstanceId,
				})
			}

			{
				// Verify it was taken properly
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					rundown.playlistId
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()
				expect(playlist.currentPartInstanceId).toBe(partInstanceId0)

				const currentPartInstance = (await getSelectedPartInstances(context, playlist))
					.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.orphaned).toBe('adlib-part')
			}

			// Ingest update should have no effect
			const ingestSegment: IngestSegment = {
				externalId: 'segment2',
				name: 'Segment 2a',
				rank: 1,
				parts: [
					{
						externalId: 'part3',
						name: 'Part 3',
						rank: 0,
					},
				],
			}

			{
				// Check props before
				const segment2 = (await context.directCollections.Segments.findOne({
					externalId: ingestSegment.externalId,
					rundownId: rundown._id,
				})) as DBSegment
				expect(segment2).toBeTruthy()
				expect(segment2.name).not.toBe(ingestSegment.name)
			}

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})

			{
				// Check props after
				const segment2 = (await context.directCollections.Segments.findOne({
					externalId: ingestSegment.externalId,
					rundownId: rundown._id,
				})) as DBSegment
				expect(segment2).toBeTruthy()
				expect(segment2.name).toBe(ingestSegment.name)
			}

			{
				// Verify the adlibbed part-instance didnt change
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					rundown.playlistId
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()
				expect(playlist.currentPartInstanceId).toBe(partInstanceId0)

				const currentPartInstance = (await getSelectedPartInstances(context, playlist))
					.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.orphaned).toBe('adlib-part')
			}

			// Queue and take another adlib-part
			const partInstanceId1: PartInstanceId = getRandomId()
			await doQueuePart(partInstanceId1)
			{
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					rundown.playlistId
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()

				await takeNextPart(context, {
					playlistId: rundown.playlistId,
					fromPartInstanceId: playlist.currentPartInstanceId,
				})
			}

			{
				// Verify the take was correct
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					rundown.playlistId
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()
				expect(playlist.currentPartInstanceId).toBe(partInstanceId1)
				expect(playlist.previousPartInstanceId).toBe(partInstanceId0)

				const currentPartInstance = (await getSelectedPartInstances(context, playlist))
					.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.orphaned).toBe('adlib-part')

				const previousPartInstance = (await getSelectedPartInstances(context, playlist))
					.previousPartInstance as DBPartInstance
				expect(previousPartInstance).toBeTruthy()
				expect(previousPartInstance.orphaned).toBe('adlib-part')
			}

			// Another ingest update
			ingestSegment.name += '2'

			{
				// Check props before
				const segment2 = (await context.directCollections.Segments.findOne({
					externalId: ingestSegment.externalId,
					rundownId: rundown._id,
				})) as DBSegment
				expect(segment2).toBeTruthy()
				expect(segment2.name).not.toBe(ingestSegment.name)
			}

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})

			{
				// Check props after
				const segment2 = (await context.directCollections.Segments.findOne({
					externalId: ingestSegment.externalId,
					rundownId: rundown._id,
				})) as DBSegment
				expect(segment2).toBeTruthy()
				expect(segment2.name).toBe(ingestSegment.name)
			}

			{
				// Verify the part-instances havent changed
				const playlist = (await context.directCollections.RundownPlaylists.findOne(
					rundown.playlistId
				)) as DBRundownPlaylist
				expect(playlist).toBeTruthy()
				expect(playlist.currentPartInstanceId).toBe(partInstanceId1)
				expect(playlist.previousPartInstanceId).toBe(partInstanceId0)

				const currentPartInstance = (await getSelectedPartInstances(context, playlist))
					.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.orphaned).toBe('adlib-part')

				const previousPartInstance = (await getSelectedPartInstances(context, playlist))
					.previousPartInstance as DBPartInstance
				expect(previousPartInstance).toBeTruthy()
				expect(previousPartInstance.orphaned).toBe('adlib-part')
			}
		} finally {
			// forcefully 'deactivate' the playlist to allow for cleanup to happen
			await context.directCollections.RundownPlaylists.update({}, { $unset: { activationId: 1 } })
		}
	})
	test('prevent hiding current segment when preserveUnsyncedPlayingSegmentContents: true', async () => {
		try {
			// Cleanup any rundowns / playlists
			{
				// Cleanup any rundowns / playlists
				const playlists = await context.directCollections.RundownPlaylists.findFetch({})
				await removeRundownPlaylistFromDb(
					context,
					playlists.map((p) => p._id)
				)
			}

			context.setStudio({
				...context.studio,
				settings: {
					...context.studio.settings,
					preserveUnsyncedPlayingSegmentContents: true,
				},
			})

			const rundownData: IngestRundown = {
				externalId: externalId,
				name: 'MyMockRundown',
				type: 'mock',
				segments: [
					{
						externalId: 'segment0',
						name: 'Segment 0',
						rank: 0,
						payload: {},
						parts: [
							{
								externalId: 'part0',
								name: 'Part 0',
								rank: 0,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece0',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: {
												timelineObjects: [],
											},
										}),
									],
								},
							},
							{
								externalId: 'part1',
								name: 'Part 1',
								rank: 1,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece1',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: {
												timelineObjects: [],
											},
										}),
									],
								},
							},
						],
					},
					{
						externalId: 'segment1',
						name: 'Segment 1',
						rank: 1,
						payload: {},
						parts: [
							{
								externalId: 'part2',
								name: 'Part 2',
								rank: 0,
							},
						],
					},
				],
			}

			// Preparation: set up rundown
			await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()
			await handleUpdatedRundown(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: true,
			})
			const rundown = (await context.directCollections.Rundowns.findOne()) as Rundown
			expect(rundown).toMatchObject({
				externalId: rundownData.externalId,
			})

			const getPlaylist = async () =>
				(await context.directCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist
			const getCurrentPartInstanceId = async () => {
				const playlist = await getPlaylist()
				return playlist.currentPartInstanceId
			}

			const playlist = await getPlaylist()
			expect(playlist).toBeTruthy()

			// const getRundown = async () => (await context.directCollections.Rundowns.findOne(rundown._id)) as Rundown

			const { segments, parts } = await getRundownData({ _id: rundown._id })
			expect(segments).toHaveLength(2)
			expect(parts).toHaveLength(3)
			await expect(
				context.directCollections.Pieces.findFetch({ startRundownId: rundown._id })
			).resolves.toHaveLength(2)

			// Activate the rundown
			await activateRundownPlaylist(context, {
				playlistId: playlist._id,
				rehearsal: true,
			})
			await expect(getCurrentPartInstanceId()).resolves.toBeNull()

			// Take the first part
			await takeNextPart(context, {
				playlistId: playlist._id,
				fromPartInstanceId: null,
			})
			await expect(getCurrentPartInstanceId()).resolves.not.toBeNull()

			{
				// Check which part is current
				const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part0')
			}

			// Hide segment 1, while not on air
			const updatedSegment1Data: IngestSegment = rundownData.segments[1]
			updatedSegment1Data.payload.hidden = true

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: updatedSegment1Data,
				isCreateAction: false,
			})
			{
				const { segments } = await getRundownData({ _id: rundown._id })
				expect(segments).toHaveLength(2)

				const segment1 = segments.find((s) => s.externalId === updatedSegment1Data.externalId)
				expect(segment1?.isHidden).toBeTruthy()
				expect(segment1?.orphaned).toBeFalsy()
			}

			// Un-hide segment 1
			updatedSegment1Data.payload.hidden = false

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: updatedSegment1Data,
				isCreateAction: false,
			})
			{
				const { segments } = await getRundownData({ _id: rundown._id })
				expect(segments).toHaveLength(2)
				const segment1 = segments.find((s) => s.externalId === updatedSegment1Data.externalId)
				expect(segment1?.isHidden).toBeFalsy()
				expect(segment1?.orphaned).toBeFalsy()
			}

			// Replace segment0 with empty hidden segment, while on air
			const updatedSegment0Data: IngestSegment = rundownData.segments[0]
			updatedSegment0Data.payload.hidden = true
			const oldParts = updatedSegment0Data.parts
			updatedSegment0Data.parts = []

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: updatedSegment0Data,
				isCreateAction: false,
			})
			{
				// Check the segment has been preserved
				const { segments, parts: parts2 } = await getRundownData({ _id: rundown._id })

				expect(segments).toHaveLength(2)

				const segment0 = segments.find((s) => s.externalId === updatedSegment0Data.externalId)
				expect(segment0?.isHidden).toBeFalsy()
				expect(segment0?.orphaned).toEqual(SegmentOrphanedReason.HIDDEN)

				expect(parts2).toHaveLength(3)
				expect(parts2.find((p) => p.externalId === 'part1')).toBeTruthy()

				await expect(
					context.directCollections.Pieces.findFetch({ startRundownId: rundown._id })
				).resolves.toHaveLength(2)
			}

			{
				// Check the partInstance
				const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part0')
			}

			// Unhide the segment while on air
			updatedSegment0Data.parts = oldParts
			delete updatedSegment0Data.payload['hidden']

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: updatedSegment0Data,
				isCreateAction: false,
			})
			{
				// Check the segment is still preserved and un-hidden
				const { segments: segments2, parts: parts2 } = await getRundownData({ _id: rundown._id })

				expect(segments2).toHaveLength(2)
				const segment0 = segments2.find((s) => s.externalId === updatedSegment0Data.externalId)
				expect(segment0?.isHidden).toBeFalsy()
				expect(segment0?.orphaned).toBeFalsy()

				expect(parts2).toHaveLength(3)
				expect(parts2.find((p) => p.externalId === 'part1')).toBeTruthy()

				await expect(
					context.directCollections.Pieces.findFetch({ startRundownId: rundown._id })
				).resolves.toHaveLength(2)
			}
			{
				// Check the partInstance
				const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part0')
			}

			// Replace segment0 with empty hidden segment again
			updatedSegment0Data.payload.hidden = true
			updatedSegment0Data.parts = []

			await handleUpdatedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestSegment: updatedSegment0Data,
				isCreateAction: false,
			})

			// Intercept the calls to queueIngestJob
			context.queueIngestJob = jest.fn(async () => Promise.resolve())
			expect(context.queueIngestJob).toHaveBeenCalledTimes(0)

			// Take Segment 1
			await takeNextPart(context, {
				playlistId: playlist._id,
				fromPartInstanceId: await getCurrentPartInstanceId(),
			})
			await expect(getCurrentPartInstanceId()).resolves.not.toBeNull()
			await takeNextPart(context, {
				playlistId: playlist._id,
				fromPartInstanceId: await getCurrentPartInstanceId(),
			})
			await expect(getCurrentPartInstanceId()).resolves.not.toBeNull()

			{
				// should have gotten a call to the ingest function RemoveOrphanedSegments
				expect(context.queueIngestJob).toHaveBeenCalledTimes(1)
				const expectedRemoveOrphanedSegmentsProps: RemoveOrphanedSegmentsProps = {
					rundownExternalId: rundown.externalId,
					peripheralDeviceId: null,
					orphanedHiddenSegmentIds: [protectString('RSv03K_yrl1oBVUEk4JjxWHlGiw_')],
					orphanedDeletedSegmentIds: [],
				}
				expect(context.queueIngestJob).toHaveBeenNthCalledWith(
					1,
					IngestJobs.RemoveOrphanedSegments,
					expectedRemoveOrphanedSegmentsProps
				)

				// Call it manually, as we intercepted the call earlier
				await handleRemoveOrphanedSegemnts(context, expectedRemoveOrphanedSegmentsProps)
			}

			{
				// Check the partInstance
				const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part2')
			}
			{
				const { segments: segments2, parts: parts2 } = await getRundownData({ _id: rundown._id })

				// Check if segment 0 was hidden
				expect(segments2).toHaveLength(2)
				const segment0 = segments2.find((s) => s.externalId === updatedSegment0Data.externalId)
				expect(segment0?.isHidden).toBeTruthy()
				expect(segment0?.orphaned).toBeFalsy()

				expect(parts2).toHaveLength(1)
			}
		} finally {
			// forcefully 'deactivate' the playlist to allow for cleanup to happen
			await context.directCollections.RundownPlaylists.update({}, { $unset: { activationId: 1 } })
		}
	})
	test('prevent hiding current segment when deleting segment onAir', async () => {
		try {
			// Cleanup any rundowns / playlists
			{
				// Cleanup any rundowns / playlists
				const playlists = await context.directCollections.RundownPlaylists.findFetch({})
				await removeRundownPlaylistFromDb(
					context,
					playlists.map((p) => p._id)
				)
			}

			const rundownData: IngestRundown = {
				externalId: externalId,
				name: 'MyMockRundown',
				type: 'mock',
				segments: [
					{
						externalId: 'segment0',
						name: 'Segment 0',
						rank: 0,
						payload: {},
						parts: [
							{
								externalId: 'part0',
								name: 'Part 0',
								rank: 0,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece0',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: { timelineObjects: [] },
										}),
									],
								},
							},
							{
								externalId: 'part1',
								name: 'Part 1',
								rank: 1,
								payload: {
									pieces: [
										literal<IBlueprintPiece>({
											externalId: 'piece1',
											name: '',
											enable: { start: 0 },
											sourceLayerId: '',
											outputLayerId: '',
											lifespan: PieceLifespan.WithinPart,
											content: { timelineObjects: [] },
										}),
									],
								},
							},
						],
					},
					{
						externalId: 'segment1',
						name: 'Segment 1',
						rank: 1,
						payload: {},
						parts: [
							{
								externalId: 'part2',
								name: 'Part 2',
								rank: 0,
							},
						],
					},
				],
			}

			// Preparation: set up rundown
			await expect(context.directCollections.Rundowns.findOne()).resolves.toBeFalsy()
			await handleUpdatedRundown(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: true,
			})
			const rundown = (await context.directCollections.Rundowns.findOne()) as Rundown
			expect(rundown).toMatchObject({
				externalId: rundownData.externalId,
			})

			const getPlaylist = async () =>
				(await context.directCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist
			const getCurrentPartInstanceId = async () => {
				const playlist = await getPlaylist()
				return playlist.currentPartInstanceId
			}

			const playlist = await getPlaylist()
			expect(playlist).toBeTruthy()

			// const getRundown = async () => (await context.directCollections.Rundowns.findOne(rundown._id)) as Rundown

			const { segments, parts } = await getRundownData({ _id: rundown._id })
			expect(segments).toHaveLength(2)
			expect(parts).toHaveLength(3)
			await expect(
				context.directCollections.Pieces.findFetch({ startRundownId: rundown._id })
			).resolves.toHaveLength(2)

			// Activate the rundown
			await activateRundownPlaylist(context, {
				playlistId: playlist._id,
				rehearsal: true,
			})
			await expect(getCurrentPartInstanceId()).resolves.toBeNull()

			// Take the first part
			await takeNextPart(context, {
				playlistId: playlist._id,
				fromPartInstanceId: null,
			})
			await expect(getCurrentPartInstanceId()).resolves.not.toBeNull()

			{
				// Check which part is current
				const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part0')
			}

			// Delete segment 0, while on air
			const segmentExternalId = rundownData.segments[0].externalId
			await handleRemovedSegment(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				segmentExternalId: segmentExternalId,
			})

			{
				const { segments, parts } = await getRundownData({ _id: rundown._id })
				expect(segments).toHaveLength(2)

				const segment0 = segments.find((s) => s.externalId === segmentExternalId) as DBSegment
				expect(segment0).toBeTruthy()
				expect(segment0.orphaned).toBe(SegmentOrphanedReason.DELETED)
				expect(segment0.isHidden).toBeFalsy()

				// Check that the PartInstance is still there
				const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
				const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				expect(currentPartInstance.part.externalId).toBe('part0')
				expect(currentPartInstance.part.segmentId).toBe(segment0._id)

				// Check that the Parts have been removed
				const parts0 = parts.filter((p) => p.segmentId === segment0._id)
				expect(parts0).toHaveLength(0) // <- FAIL, length is 2
			}

			// Trigger an 'resync' of the rundown
			rundownData.segments.splice(0, 1)
			await handleUpdatedRundown(context, {
				peripheralDeviceId: device2._id,
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: false,
			})

			// Make sure segment0 is still deleted
			{
				const { segments } = await getRundownData({ _id: rundown._id })
				expect(segments).toHaveLength(2)

				const segment0 = segments.find((s) => s.externalId === segmentExternalId) as DBSegment
				expect(segment0).toBeTruthy()
				expect(segment0.orphaned).toBe(SegmentOrphanedReason.DELETED)
				expect(segment0.isHidden).toBeFalsy()
			}
		} finally {
			// forcefully 'deactivate' the playlist to allow for cleanup to happen
			await context.directCollections.RundownPlaylists.update({}, { $unset: { activationId: 1 } })
		}
	})
})
