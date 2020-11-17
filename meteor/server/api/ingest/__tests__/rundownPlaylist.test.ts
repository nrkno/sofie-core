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

	testInFiber('unsyncing of rundown - one item list', () => {
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

		// Preparation: set up rundown
		expect(Rundowns.findOne()).toBeFalsy()
		Meteor.call(PeripheralDeviceAPIMethods.dataRundownCreate, device2._id, device2.token, rundownData)
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId,
		})
		const playlist = rundown.getRundownPlaylist()
		expect(playlist).toBeTruthy()

		const getRundown = () => Rundowns.findOne(rundown._id) as Rundown
		const getPlaylist = () => rundown.getRundownPlaylist() as RundownPlaylist
		const resyncRundown = () => {
			try {
				ServerRundownAPI.resyncRundown(DEFAULT_CONTEXT, rundown._id)
			} catch (e) {
				if (e.toString().match(/does not support the method "reloadRundown"/)) {
					// This is expected
					return
				}
				throw e
			}
		}

		const segments = getRundown().getSegments()
		const parts = getRundown().getParts()

		expect(segments).toHaveLength(2)
		expect(parts).toHaveLength(3)

		// Activate the rundown, make data updates and verify that it gets unsynced properly
		ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_CONTEXT, playlist._id, true)
		expect(getRundown().unsynced).toEqual(false)

		RundownInput.dataRundownDelete(DEFAULT_CONTEXT, device2._id, device2.token, rundownData.externalId)
		expect(getRundown().unsynced).toEqual(true)

		resyncRundown()
		expect(getRundown().unsynced).toEqual(false)

		ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlist._id)
		const partInstance = PartInstances.find({ 'part._id': parts[0]._id }).fetch()
		expect(partInstance).toHaveLength(1)
		expect(getPlaylist().currentPartInstanceId).toEqual(partInstance[0]._id)

		RundownInput.dataSegmentDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData.externalId,
			segments[0].externalId
		)
		expect(getRundown().unsynced).toEqual(true)

		resyncRundown()
		expect(getRundown().unsynced).toEqual(false)

		RundownInput.dataPartDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData.externalId,
			segments[0].externalId,
			parts[0].externalId
		)
		expect(getRundown().unsynced).toEqual(true)

		resyncRundown()
		expect(getRundown().unsynced).toEqual(false)
	})

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
		// const rundown3 = Rundowns.findOne({ externalId: externalId3 }) as Rundown
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
		console.log(getRundown(rundown))
		console.log(getRundown(rundown2))
		console.log(getRundown(rundown).getRundownPlaylist())
		console.log(getRundown(rundown2).getRundownPlaylist())
		// Activate the rundown, make data updates and verify that it gets unsynced properly
		ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_CONTEXT, playlist._id, true)
		console.log(getRundown(rundown))

		Meteor.call(PeripheralDeviceAPIMethods.mosRoReadyToAir, device2._id, device2.token, {
			ID: new MOS.MosString128(rundown.externalId),
			Status: MOS.IMOSObjectAirStatus.NOT_READY,
		} as MOS.IMOSROReadyToAir)
		console.log(getRundown(rundown))

		/*expect(getRundown(rundown3).unsynced).toEqual(false)

		RundownInput.dataRundownDelete(DEFAULT_CONTEXT, device2._id, device2.token, rundownData3.externalId)
		console.log(getPlaylist().getRundownIDs())
		expect(getRundown(rundown3).unsynced).toEqual(true)

		// ServerRundownAPI.resyncRundownPlaylist(DEFAULT_CONTEXT, playlist._id)
		resyncPlaylist()
		expect(getRundown(rundown3).unsynced).toEqual(false)
		*/
		/* ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlist._id)
		const partInstance = PartInstances.find({ 'part._id': parts[0]._id }).fetch()
		expect(partInstance).toHaveLength(1)
		expect(getPlaylist().currentPartInstanceId).toEqual(partInstance[0]._id)

		RundownInput.dataSegmentDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData.externalId,
			segments[0].externalId
		)
		expect(getRundown().unsynced).toEqual(true)

		resyncRundown(rundown)
		expect(getRundown().unsynced).toEqual(false)

		RundownInput.dataPartDelete(
			DEFAULT_CONTEXT,
			device2._id,
			device2.token,
			rundownData.externalId,
			segments[0].externalId,
			parts[0].externalId
		)
		expect(getRundown().unsynced).toEqual(true)

		resyncRundown(rundown)
		expect(getRundown().unsynced).toEqual(false) */
	})
})

/*
000g</variant>
<_valid>false</_valid>
</content>
</mosPayload>
</mosExternalMetadata>
<mosExternalMetadata><mosScope>PLAYLIST</mosScope>
<mosSchema>https://nora.nrk.no/mos/timing</mosSchema>
<mosPayload><timeIn>0</timeIn>
<duration>8000</duration>

<in>manual</in>
<out>auto</out>
</mosPayload>
</mosExternalMetadata>
</storyItem>
<p>----------------------------------------------- </p>
\r\n<p>Med p� report-it? </p>
\r\n<p>Dra linje opp fra under strek. Den linjen som heter portrettbilde-splitt.</p>
\r\n<p>Legg inn navn og bilde p� gjest i den malen.</p>
\r\n<p>-----------------------------------------------</p>
\r\n<p>Video:</p>
\r\n<p>&lt;BTS&gt;&lt;</p>
\r\n<p>&gt;</p>
\r\n<p> </p>
</storyBody>
\r\n<mosExternalMetadata>\r\n<mosScope>PLAYLIST</mosScope>
\r\n<mosSchema>http://MAENPSOSLO02:10505/schema/enps.dtd</mosSchema>
\r\n<mosPayload>\r\n<Actual>0</Actual>
\r\n<Approved>0</Approved>
\r\n<Creator>N16426</Creator>
\r\n<MediaTime>0</MediaTime>
\r\n<ModBy>N16426</ModBy>
\r\n<ModTime>20201113T120931Z</ModTime>
\r\n<MOSItemDurations>\r\n\r\n\r\n\r\n</MOSItemDurations>
\r\n<MOSItemEdDurations>\r\n\r\n\r\n\r\n</MOSItemEdDurations>
\r\n<MOSObjSlugs>M: \r\nTema (00:00, Auto/OnNext): vanlig\r\nNavn|Ett navn (00:08, Manual/Auto): vanlig\r\nNavn|Ett navn (00:08, Manual/Auto): vanlig\r\nNavn|Ett navn (00:08, Manual/Auto): vanlig</MOSObjSlugs>
\r\n<MOSSlugs>Uten tittel\r\nSak-1;Debatt 1-15\r\nhei-6\r\nhei-6\r\nhei-6</MOSSlugs>
\r\n<MOSStatus>\r\n\r\n\r\n\r\n</MOSStatus>
\r\n<Owner>N16426</Owner>
\r\n<SourceMediaTime>0</SourceMediaTime>
\r\n<SourceTextTime>0</SourceTextTime>
\r\n<StoryLogPreview>&lt;\r\nTemasuper: \r\n-----------------------------------------------</StoryLogPreview>
\r\n<TextTime>0</TextTime>
\r\n<GUID>C076AE0A-E92D-43FD-88B4D81F31E7C5EC</GUID>
\r\n<Kilde>sjekker </Kilde>
\r\n<mosartType>KAM</mosartType>
\r\n<mosartVariant>1</mosartVariant>
\r\n<ReadTime>0</ReadTime>
\r\n<ENPSItemType>3</ENPSItemType>
\r\n</mosPayload>
\r\n</mosExternalMetadata>
\r\n</roStorySend>
\r\n</mos>
\r\n"}
*/
