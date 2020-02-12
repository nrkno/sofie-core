import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundown } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'

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
		const rundownId0 = setupDefaultRundown(env)
		const rundownId1 = setupDefaultRundown(env)
		expect(rundownId0).toBeTruthy()
		expect(rundownId1).toBeTruthy()


		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getRundown1 = () => {
			return Rundowns.findOne(rundownId1) as Rundown
		}

		expect(getRundown0()).toBeTruthy()
		expect(getRundown1()).toBeTruthy()
		expect(getRundown0()._id).not.toEqual(getRundown1()._id)

		const parts = getRundown0().getParts()

		expect(getRundown0()).toMatchObject({
			active: false,
			rehearsal: false
		})

		// Prepare and activate in rehersal:
		Meteor.call(PlayoutAPI.methods.rundownPrepareForBroadcast, rundownId0)
		expect(getRundown0()).toMatchObject({
			active: true,
			rehearsal: true,
			currentPartId: null,
			nextPartId: parts[0]._id,
		})
		// Activate a second rundown (this should throw an error)
		expect(() => {
			Meteor.call(PlayoutAPI.methods.rundownActivate, rundownId1, false)
		}).toThrowError(/only one rundown/i)


		// Take the first Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, rundownId0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[0]._id,
			nextPartId: parts[1]._id,
		})

		// Take the second Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, rundownId0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[1]._id,
			nextPartId: parts[2]._id,
		})
		// Reset rundown:
		Meteor.call(PlayoutAPI.methods.rundownResetRundown, rundownId0)
		expect(getRundown0()).toMatchObject({
			currentPartId: null,
			nextPartId: parts[0]._id,
		})

		// Set Part as next:
		Meteor.call(PlayoutAPI.methods.rundownSetNext, rundownId0, parts[parts.length - 2]._id)
		expect(getRundown0()).toMatchObject({
			currentPartId: null,
			nextPartId: parts[parts.length - 2]._id,
		})

		// Take the Nexted Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, rundownId0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[parts.length - 2]._id,
			nextPartId: parts[parts.length - 1]._id,
		})

		// Take the last Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, rundownId0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[parts.length - 1]._id,
			nextPartId: null
		})

		// Move the next-point backwards:
		Meteor.call(PlayoutAPI.methods.rundownMoveNext, rundownId0, -1, 0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[parts.length - 1]._id,
			nextPartId: parts[parts.length - 2]._id
		})
		// Move the next-point backwards:
		Meteor.call(PlayoutAPI.methods.rundownMoveNext, rundownId0, -1, 0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[parts.length - 1]._id,
			nextPartId: parts[parts.length - 3]._id
		})

		// Take the nexted Part:
		Meteor.call(PlayoutAPI.methods.rundownTake, rundownId0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[parts.length - 3]._id,
			nextPartId: parts[parts.length - 2]._id,
		})

		// Deactivate rundown:
		Meteor.call(PlayoutAPI.methods.rundownDeactivate, rundownId0)
		expect(getRundown0()).toMatchObject({
			active: false,
			currentPartId: null,
			nextPartId: null
		})
	})
})
