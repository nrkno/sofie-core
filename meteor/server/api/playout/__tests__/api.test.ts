import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundownPlaylist } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { RundownPlaylists } from '../../../../lib/collections/RundownPlaylists'

namespace PlayoutAPI { // Using our own method definition, to catch external API changes
	export enum methods {

		'rundownPrepareForBroadcast' 		= 'playout.rundownPrepareForBroadcast',
		'rundownResetRundown' 				= 'playout.rundownResetRundownt',
		'rundownResetAndActivate' 			= 'playout.rundownResetAndActivate',
		'rundownActivate' 					= 'playout.rundownActivate',
		'rundownDeactivate' 				= 'playout.rundownDeactivate',
		'reloadData' 						= 'playout.reloadData',

		'updateStudioBaseline'				= 'playout.updateStudioBaseline',
		'shouldUpdateStudioBaseline'		= 'playout.shouldUpdateStudioBaseline',

		'rundownTake'						= 'playout.rundownTake',
		'rundownSetNext'					= 'playout.rundownSetNext',
		'rundownMoveNext'					= 'playout.rundownMoveNext',
		'rundownActivateHold'				= 'playout.rundownActivateHold',
		'rundownDisableNextPiece'			= 'playout.rundownDisableNextPiece',
		'rundownTogglePartArgument'			= 'playout.rundownTogglePartArgument',
		// 'partPlaybackStartedCallback'		= 'playout.partPlaybackStartedCallback',
		// 'piecePlaybackStartedCallback'		= 'playout.piecePlaybackStartedCallback',
		'pieceTakeNow'						= 'playout.pieceTakeNow',
		'segmentAdLibPieceStart'			= 'playout.segmentAdLibPieceStart',
		'rundownBaselineAdLibPieceStart'	= 'playout.rundownBaselineAdLibPieceStart',
		'segmentAdLibPieceStop'				= 'playout.segmentAdLibPieceStop',
		'sourceLayerOnPartStop'				= 'playout.sourceLayerOnPartStop',
		'sourceLayerStickyPieceStart'		= 'playout.sourceLayerStickyPieceStart'
	}
}

describe('Playout API', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
	})
	testInFiber('Basic rundown control', () => {
		const {
			rundownId: rundownId0,
			playlistId: playlistId0
		} = setupDefaultRundownPlaylist(env)
		const {
			rundownId: rundownId1,
			playlistId: playlistId1
		} = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(rundownId1).toBeTruthy()
		expect(playlistId0).toBeTruthy()
		expect(playlistId1).toBeTruthy()


		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getRundown1 = () => {
			return Rundowns.findOne(rundownId1) as Rundown
		}
		const getPlaylist0 = () => {
			return RundownPlaylists.findOne(playlistId0)
		}
		const getPlaylist1 = () => {
			return RundownPlaylists.findOne(playlistId1)
		}

		expect(getRundown0()).toBeTruthy()
		expect(getRundown1()).toBeTruthy()
		expect(getRundown0()._id).not.toEqual(getRundown1()._id)
		expect(getPlaylist0()).toBeTruthy()
		expect(getPlaylist1()).toBeTruthy()

		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false
		})

		// Prepare and activate in rehersal:
		Meteor.call(PlayoutAPI.methods.rundownPrepareForBroadcast, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			active: true,
			rehearsal: true,
			currentPartId: null,
			nextPartId: parts[0]._id,
		})
		// Activate a second rundown (this should throw an error)
		expect(() => {
			Meteor.call(PlayoutAPI.methods.rundownActivate, playlistId1)
		}).toThrowError(/only one rundown/i)


		// Take the first Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[0]._id,
			nextPartId: parts[1]._id,
		})

		// Take the second Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[1]._id,
			nextPartId: parts[2]._id,
		})
		// Reset rundown:
		Meteor.call(PlayoutAPI.methods.rundownResetRundown, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: null,
			nextPartId: parts[0]._id,
		})

		// Set Part as next:
		Meteor.call(PlayoutAPI.methods.rundownSetNext, playlistId0, parts[parts.length - 2]._id)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: null,
			nextPartId: parts[parts.length - 2]._id,
		})

		// Take the Nexted Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[parts.length - 2]._id,
			nextPartId: parts[parts.length - 1]._id,
		})

		// Take the last Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[parts.length - 1]._id,
			nextPartId: null
		})

		// Move the next-point backwards:
		Meteor.call(PlayoutAPI.methods.rundownMoveNext, playlistId0, -1, 0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[parts.length - 1]._id,
			nextPartId: parts[parts.length - 2]._id
		})
		// Move the next-point backwards:
		Meteor.call(PlayoutAPI.methods.rundownMoveNext, playlistId0, -1, 0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[parts.length - 1]._id,
			nextPartId: parts[parts.length - 3]._id
		})

		// Take the nexted Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[parts.length - 3]._id,
			nextPartId: parts[parts.length - 2]._id,
		})

		// Deactivate rundown:
		Meteor.call(PlayoutAPI.methods.rundownDeactivate, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			active: false,
			currentPartId: null,
			nextPartId: null
		})
	})
})
