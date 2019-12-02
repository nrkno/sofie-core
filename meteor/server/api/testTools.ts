import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { RecordedFiles, RecordedFile } from '../../lib/collections/RecordedFiles'
import { Studios, Studio, ITestToolsConfig, MappingExt } from '../../lib/collections/Studios'
import { getCurrentTime, literal, waitForPromise, getHash } from '../../lib/lib'
import { TestToolsAPI } from '../../lib/api/testTools'
import { setMeteorMethods, Methods } from '../methods'
import { logger } from '../logging'
import * as moment from 'moment'
import { TimelineObjRecording, TimelineObjType, setTimelineId } from '../../lib/collections/Timeline'
import { LookaheadMode, TSR } from 'tv-automation-sofie-blueprints-integration'
import * as request from 'request'
import { promisify } from 'util'
import { check } from 'meteor/check'
import { updateTimeline } from './playout/timeline'

const deleteRequest = promisify(request.delete)

// TODO: Allow arbitrary layers:
const layerRecord = '_internal_ccg_record_consumer'
const layerInput = '_internal_ccg_record_input'

const defaultConfig = {
	channelFormat: TSR.ChannelFormat.HD_1080I5000,
	prefix: ''
}
export function getStudioConfig (studio: Studio): ITestToolsConfig {
	const config: ITestToolsConfig = studio.testToolsConfig || { recordings: defaultConfig }
	if (!config.recordings) config.recordings = defaultConfig
	return config
}

export function generateRecordingTimelineObjs (studio: Studio, recording: RecordedFile): TimelineObjRecording[] {
	if (!studio) throw new Meteor.Error(404, `Studio was not defined!`)
	if (!recording) throw new Meteor.Error(404, `Recording was not defined!`)

	const config = getStudioConfig(studio)
	if (!config.recordings.decklinkDevice) throw new Meteor.Error(500, `Recording decklink for Studio "${studio._id}" not defined!`)

	if (!studio.mappings[layerInput] || !studio.mappings[layerRecord]) {
		throw new Meteor.Error(500, `Recording layer mappings in Studio "${studio._id}" not defined!`)
	}

	const IDs = {
		record: getHash(recording._id + layerRecord),
		input: getHash(recording._id + layerInput)
	}

	return setTimelineId([
		literal<TSR.TimelineObjCCGRecord & TimelineObjRecording>({
			id: IDs.record,
			_id: '',
			studioId: studio._id,
			objectType: TimelineObjType.RECORDING,
			enable: {
				start: recording.startedAt,
				duration: 3600 * 1000, // 1hr
			},
			priority: 0,
			layer: layerRecord,
			content: {
				deviceType: TSR.DeviceType.CASPARCG,
				type: TSR.TimelineContentTypeCasparCg.RECORD,
				file: recording.path,
				encoderOptions: '-f mp4 -vcodec libx264 -preset ultrafast -tune fastdecode -crf 25 -acodec aac -b:a 192k'
				// This looks fine, but may need refinement
			}
		}),
		literal<TSR.TimelineObjCCGInput & TimelineObjRecording>({
			id: IDs.input,
			_id: '', // set later,
			studioId: studio._id,
			objectType: TimelineObjType.RECORDING,
			enable: { while: 1 },
			priority: 0,
			layer: layerInput,
			content: {
				deviceType: TSR.DeviceType.CASPARCG,
				type: TSR.TimelineContentTypeCasparCg.INPUT,
				inputType: 'decklink',
				device: config.recordings.decklinkDevice,
				deviceFormat: config.recordings.channelFormat
			}
		})
	])
}

export namespace ServerTestToolsAPI {
	/**
	 * Stop a currently running recording
	 */
	export function recordStop (studioId: string) {
		check(studioId, String)
		const updated = RecordedFiles.update({
			studioId: studioId,
			stoppedAt: { $exists: false }
		}, {
			$set: {
				stoppedAt: getCurrentTime()
			}
		})

		if (updated === 0) throw new Meteor.Error(404, `No active recording for "${studioId}" was found!`)

		updateTimeline(studioId)

		return true
	}

	export function recordStart (studioId: string, name: string) {
		check(studioId, String)
		check(name, String)
		const studio = Studios.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" was not found!`)

		const active = RecordedFiles.findOne({
			studioId: studioId,
			stoppedAt: { $exists: false }
		})
		if (active) throw new Meteor.Error(404, `An active recording for "${studioId}" was found!`)

		if (name === '') name = moment(getCurrentTime()).format('YYYY-MM-DD HH:mm:ss')

		const config = getStudioConfig(studio)
		if (!config.recordings.channelIndex) throw new Meteor.Error(500, `Recording channel for Studio "${studio._id}" not defined!`)
		if (!config.recordings.deviceId) throw new Meteor.Error(500, `Recording device for Studio "${studio._id}" not defined!`)
		if (!config.recordings.decklinkDevice) throw new Meteor.Error(500, `Recording decklink for Studio "${studio._id}" not defined!`)
		if (!config.recordings.channelIndex) throw new Meteor.Error(500, `Recording channel for Studio "${studio._id}" not defined!`)

		// Ensure the layer mappings in the db are correct
		const setter: any = {}
		setter['mappings.' + layerInput] = literal<TSR.MappingCasparCG & MappingExt>({
			device: TSR.DeviceType.CASPARCG,
			deviceId: config.recordings.deviceId,
			channel: config.recordings.channelIndex,
			layer: 10,
			lookahead: LookaheadMode.NONE,
			internal: true
		})
		setter['mappings.' + layerRecord] = literal<TSR.MappingCasparCG & MappingExt>({
			device: TSR.DeviceType.CASPARCG,
			deviceId: config.recordings.deviceId,
			channel: config.recordings.channelIndex,
			layer: 0,
			lookahead: LookaheadMode.NONE,
			internal: true
		})
		Studios.update(studio._id, { $set: setter })

		const id = Random.id(7)
		const path = (config.recordings.filePrefix || defaultConfig.prefix) + id + '.mp4'

		RecordedFiles.insert({
			_id: id,
			studioId: studioId,
			modified: getCurrentTime(),
			startedAt: getCurrentTime(),
			name: name,
			path: path
		})

		updateTimeline(studioId)

		return true
	}

	export function recordDelete (id: string) {
		check(id, String)
		const file = RecordedFiles.findOne(id)
		if (!file) throw new Meteor.Error(404, `Recording "${id}" was not found!`)

		const studio = Studios.findOne(file.studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${file.studioId}" was not found!`)

		const config = getStudioConfig(studio)
		if (!config.recordings.urlPrefix) throw new Meteor.Error(500, `URL prefix for Studio "${studio._id}" not defined!`)

		const p = deleteRequest({ uri: config.recordings.urlPrefix + file.path })
		.then(res => {
			// 404 is ok, as it means file already doesnt exist. 200 is also good
			if (res.statusCode !== 404 && res.statusCode !== 200) {
				throw new Meteor.Error(500, `Failed to delete recording "${id}"!`)
			}

			RecordedFiles.remove(id)

			return true
		})
		waitForPromise(p)
	}
}

let methods: Methods = {}
methods[TestToolsAPI.methods.recordStop] = (studioId: string) => {
	return ServerTestToolsAPI.recordStop(studioId)
}
methods[TestToolsAPI.methods.recordStart] = (studioId: string, name: string) => {
	return ServerTestToolsAPI.recordStart(studioId, name)
}
methods[TestToolsAPI.methods.recordDelete] = (id: string) => {
	return ServerTestToolsAPI.recordDelete(id)
}

// Transform methods:
_.each(methods, (fcn: Function, key) => {
	methods[key] = (...args: any[]) => {
		// logger.info('------- Method call -------')
		// logger.info(key)
		// logger.info(args)
		// logger.info('---------------------------')
		try {
			return fcn.apply(null, args)
		} catch (e) {
			logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
			throw e
		}
	}
})

// Apply methods:
setMeteorMethods(methods)
