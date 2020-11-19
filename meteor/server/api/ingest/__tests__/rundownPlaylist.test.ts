import { Meteor } from 'meteor/meteor'
import { PeripheralDeviceAPI, PeripheralDeviceAPIMethods } from '../../../../lib/api/peripheralDevice'
import { setupDefaultStudioEnvironment, setupMockPeripheralDevice } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { Segment, Segments } from '../../../../lib/collections/Segments'
import { Part, Parts, PartId } from '../../../../lib/collections/Parts'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { updatePartRanks, ServerRundownAPI } from '../../rundown'
import { ServerPlayoutAPI } from '../../playout/playout'
import { RundownInput } from '../rundownInput'
import { RundownPlaylists, RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { unprotectString, protectString } from '../../../../lib/lib'
import { PartInstances } from '../../../../lib/collections/PartInstances'
import { getSegmentId } from '../lib'
import * as MOS from 'mos-connection'

import { wrapWithCacheForRundownPlaylistFromRundown, wrapWithCacheForRundownPlaylist } from '../../../DatabaseCaches'
import { removeRundownPlaylistFromCache } from '../../playout/lib'
import { MethodContext } from '../../../../lib/api/methods'

require('../../peripheralDevice.ts') // include in order to create the Meteor methods needed

const DEFAULT_CONTEXT: MethodContext = {
	userId: null,
	isSimulation: false,
	connection: {
		id: 'mockConnectionId',
		close: () => {},
		onClose: () => {},
		clientAddress: '127.0.0.1',
		httpHeaders: {},
	},
	setUserId: () => {},
	unblock: () => {},
}

describe('Test ingest actions for rundowns and segments', () => {
	let device: PeripheralDevice
	let device2: PeripheralDevice
	let externalId = 'abcde'
	let externalId2 = 'fghij'
	let externalId3 = 'klmno'
	let segExternalId = 'zyxwv'
	let segExternalId2 = 'utsrp'
	let segExternalId3 = 'onmlk'
	beforeAll(() => {
		const env = setupDefaultStudioEnvironment()
		device = env.ingestDevice

		device2 = setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.INGEST,
			// @ts-ignore
			'mockDeviceType',
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio
		)
	})

	// Based on ingest.test.ts unsync test
	// Test coverage that attempts to prevent a regression of R24 issue where 2nd,3rd... rundowns
	// in an active and playing playlist could become unsynced from MOS and then not resync correctly.
	testInFiber('unsyncing of rundown - three item playlist', () => {
		// Cleanup any rundowns / playlists
		RundownPlaylists.find()
			.fetch()
			.forEach((playlist) =>
				wrapWithCacheForRundownPlaylist(playlist, (cache) => removeRundownPlaylistFromCache(cache, playlist))
			)

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

		const rundownData2: IngestRundown = {
			externalId: externalId2,
			name: 'MyMockRundown2',
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

		const rundownData3: IngestRundown = {
			externalId: externalId3,
			name: 'MyMockRundown3',
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
		expect(Rundowns.findOne()).toBeFalsy()
		Meteor.call(PeripheralDeviceAPIMethods.dataRundownCreate, device2._id, device2.token, rundownData)
		Meteor.call(PeripheralDeviceAPIMethods.dataRundownCreate, device2._id, device2.token, rundownData2)
		Meteor.call(PeripheralDeviceAPIMethods.dataRundownCreate, device2._id, device2.token, rundownData3)
		const rundown = Rundowns.findOne({ externalId: externalId }) as Rundown
		expect(rundown).toMatchObject({
			externalId: externalId,
		})
		const playlist = rundown.getRundownPlaylist()
		expect(playlist).toBeTruthy()
		expect(playlist.getRundowns()).toHaveLength(3)

		const rundown2 = Rundowns.findOne({ externalId: externalId2 }) as Rundown
		const rundown3 = Rundowns.findOne({ externalId: externalId3 }) as Rundown
		// ServerRundownAPI.moveRundown(DEFAULT_CONTEXT, rundown2._id, playlist._id, [rundown._id, rundown2._id])
		// ServerRundownAPI.moveRundown(DEFAULT_CONTEXT, rundown3._id, playlist._id, [rundown._id, rundown2._id, rundown3._id])
		// expect(playlist.getRundowns()).toHaveLength(3)
		// console.log(playlist.getRundownIDs())

		const getRundown = (rd: Rundown) => Rundowns.findOne(rd._id) as Rundown
		// const playlist2 = getRundown(rundown2).getRundownPlaylist()
		// expect(playlist._id).toEqual(playlist2._id)

		const getPlaylist = () => rundown.getRundownPlaylist() as RundownPlaylist
		const resyncRundown = (rd: Rundown) => {
			try {
				ServerRundownAPI.resyncRundown(DEFAULT_CONTEXT, rd._id)
			} catch (e) {
				if (e.toString().match(/does not support the method "reloadRundown"/)) {
					// This is expected
					return
				}
				throw e
			}
		}
		const resyncPlaylist = () => {
			try {
				ServerRundownAPI.resyncRundownPlaylist(DEFAULT_CONTEXT, playlist._id)
			} catch (e) {
				if (e.toString().match(/does not support the method "reloadRundown"/)) {
					// This is expected
					return
				}
				throw e
			}
		}

		Meteor.call(PeripheralDeviceAPIMethods.mosRoReadyToAir, device2._id, device2.token, {
			ID: new MOS.MosString128(rundown.externalId),
			Status: MOS.IMOSObjectAirStatus.READY,
		} as MOS.IMOSROReadyToAir)
		Meteor.call(PeripheralDeviceAPIMethods.mosRoReadyToAir, device2._id, device2.token, {
			ID: new MOS.MosString128(rundown2.externalId),
			Status: MOS.IMOSObjectAirStatus.READY,
		} as MOS.IMOSROReadyToAir)
		Meteor.call(PeripheralDeviceAPIMethods.mosRoReadyToAir, device2._id, device2.token, {
			ID: new MOS.MosString128(rundown3.externalId),
			Status: MOS.IMOSObjectAirStatus.READY,
		} as MOS.IMOSROReadyToAir)
		// Activate the rundown, make data updates and verify that it gets unsynced properly
		ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_CONTEXT, playlist._id, true)
		ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlist._id)

		Meteor.call(PeripheralDeviceAPIMethods.mosRoReadyToAir, device2._id, device2.token, {
			ID: new MOS.MosString128(rundown3.externalId),
			Status: MOS.IMOSObjectAirStatus.NOT_READY,
		} as MOS.IMOSROReadyToAir)
		expect(getRundown(rundown3).airStatus).toEqual('NOT READY')

		Meteor.call(PeripheralDeviceAPIMethods.mosRoReadyToAir, device2._id, device2.token, {
			ID: new MOS.MosString128(rundown3.externalId),
			Status: MOS.IMOSObjectAirStatus.READY,
		} as MOS.IMOSROReadyToAir)
		expect(getRundown(rundown3).airStatus).toEqual('READY')

		expect(getRundown(rundown).unsynced).toEqual(false)
		RundownInput.dataRundownDelete(DEFAULT_CONTEXT, device2._id, device2.token, rundownData.externalId)
		expect(getRundown(rundown).unsynced).toEqual(true)

		resyncPlaylist()
		expect(getRundown(rundown).unsynced).toEqual(false)

		// Unsyncs on playing segment
		RundownInput.dataSegmentDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData.externalId,
			rundownData.segments[0].externalId
		)
		expect(getRundown(rundown).unsynced).toEqual(true)

		resyncPlaylist()
		expect(getRundown(rundown).unsynced).toEqual(false)

		// Does not unsync on future playlist segment
		RundownInput.dataSegmentDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData3.externalId,
			rundownData3.segments[0].externalId
		)
		expect(getRundown(rundown3).unsynced).toEqual(false)

		resyncPlaylist()
		expect(getRundown(rundown3).unsynced).toEqual(false)
		expect(getRundown(rundown3).getSegments()).toHaveLength(1)

		// Does not get flustered by another change
		RundownInput.dataSegmentDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData3.externalId,
			rundownData3.segments[1].externalId
		)
		expect(getRundown(rundown3).unsynced).toEqual(false)

		resyncPlaylist()
		expect(getRundown(rundown3).unsynced).toEqual(false)
		expect(getRundown(rundown3).getSegments()).toHaveLength(0)

		// Confirm that deleting a future part - stays in sync
		RundownInput.dataPartDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData2.externalId,
			rundownData2.segments[0].externalId,
			rundownData2.segments[0].parts[0].externalId
		)
		expect(getRundown(rundown2).unsynced).toEqual(false)

		resyncPlaylist()
		expect(getRundown(rundown2).unsynced).toEqual(false)
	})
})
