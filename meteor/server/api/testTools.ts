import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { RecordedFiles, RecordedFile } from '../../lib/collections/RecordedFiles'
import { StudioInstallations, StudioInstallation, ITestToolsConfig, Mappings, MappingCasparCG } from '../../lib/collections/StudioInstallations'
import { getCurrentTime, literal } from '../../lib/lib'
import { TestToolsAPI } from '../../lib/api/testTools'
import { setMeteorMethods } from '../methods'
import { logger } from '../logging'
import { updateTimeline } from './playout'
import * as moment from 'moment'
import { TimelineObj, TimelineObjCCGRecord, TimelineContentTypeCasparCg, TimelineObjCCGInput } from '../../lib/collections/Timeline'
import { TriggerType } from 'superfly-timeline'
import { ChannelFormat } from '../../lib/constants/casparcg'
import { getHash } from '../lib'
import { PlayoutDeviceType } from '../../lib/collections/PeripheralDevices'
import { LookaheadMode } from '../../lib/api/playout'
import * as request from 'request'
import { promisify } from 'util'

const deleteRequest = promisify(request.delete)

const LLayerRecord = '_internal_ccg_record_consumer'
const LLayerInput = '_internal_ccg_record_input'

const defaultConfig = {
	channelFormat: ChannelFormat.HD_1080I5000,
	prefix: ''
}
function getStudioConfig (studio: StudioInstallation): ITestToolsConfig {
	const config: ITestToolsConfig = studio.testToolsConfig || { recordings: defaultConfig }
	if (!config.recordings) config.recordings = defaultConfig
	return config
}

export function generateRecordingTimelineObjs (studio: StudioInstallation, recording: RecordedFile): TimelineObj[] {
	if (!studio) throw new Meteor.Error(404, `Studio was not defined!`)
	if (!recording) throw new Meteor.Error(404, `Recording was not defined!`)

	const config = getStudioConfig(studio)
	if (!config.recordings.decklinkDevice) throw new Meteor.Error(500, `Recording decklink for Studio "${studio._id}" not defined!`)

	if (!studio.mappings[LLayerInput] || !studio.mappings[LLayerRecord]) {
		throw new Meteor.Error(500, `Recording layer mappings in Studio "${studio._id}" not defined!`)
	}

	const IDs = {
		record: getHash(studio._id + LLayerRecord),
		input: getHash(studio._id + LLayerInput)
	}

	return [
		literal<TimelineObjCCGRecord>({
			_id: IDs.record,
			siId: studio._id,
			roId: '',
			deviceId: [''],
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: recording.startedAt
			},
			duration: 3600 * 1000, // 1hr
			priority: 0,
			LLayer: LLayerRecord,
			content: {
				type: TimelineContentTypeCasparCg.RECORD,
				attributes: {
					file: recording.path,
					encoderOptions: '-f mp4 -vcodec libx264 -preset ultrafast -tune fastdecode -crf 25 -acodec aac -b:a 192k'
					// This looks fine, but may need refinement
				}
			}
		}),
		literal<TimelineObjCCGInput>({
			_id: IDs.input,
			siId: studio._id,
			roId: '',
			deviceId: [''],
			trigger: {
				type: TriggerType.LOGICAL,
				value: '1'
			},
			duration: 0,
			priority: 0,
			LLayer: LLayerInput,
			content: {
				type: TimelineContentTypeCasparCg.INPUT,
				attributes: {
					type: 'decklink',
					device: config.recordings.decklinkDevice,
					deviceFormat: config.recordings.channelFormat
				}
			}
		})
	]
}

export namespace ServerTestToolsAPI {
	/**
	 * Stop a currently running recording
	 */
	export function recordStop (studioId: string) {
		const updated = RecordedFiles.update({
			studioId: studioId,
			stoppedAt: {$exists: false}
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
		const studio = StudioInstallations.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" was not found!`)

		const active = RecordedFiles.findOne({
			studioId: studioId,
			stoppedAt: {$exists: false}
		})
		if (active) throw new Meteor.Error(404, `An active recording for "${studioId}" was found!`)

		if (name === '') name = moment(getCurrentTime()).format('YYYY-MM-DD HH:mm:ss')

		const config = getStudioConfig(studio)
		if (!config.recordings.channelIndex) throw new Meteor.Error(500, `Recording channel for Studio "${studio._id}" not defined!`)
		if (!config.recordings.deviceId) throw new Meteor.Error(500, `Recording device for Studio "${studio._id}" not defined!`)
		if (!config.recordings.decklinkDevice) throw new Meteor.Error(500, `Recording decklink for Studio "${studio._id}" not defined!`)
		if (!config.recordings.channelIndex) throw new Meteor.Error(500, `Recording channel for Studio "${studio._id}" not defined!`)

		// Ensure the layer mappings in the db are correct
		const setter = {}
		setter['mappings.' + LLayerInput] = literal<MappingCasparCG>({
			device: PlayoutDeviceType.CASPARCG,
			deviceId: config.recordings.deviceId,
			channel: config.recordings.channelIndex,
			layer: 10,
			lookahead: LookaheadMode.NONE,
			internal: true
		})
		setter['mappings.' + LLayerRecord] = literal<MappingCasparCG>({
			device: PlayoutDeviceType.CASPARCG,
			deviceId: config.recordings.deviceId,
			channel: config.recordings.channelIndex,
			layer: 0,
			lookahead: LookaheadMode.NONE,
			internal: true
		})
		StudioInstallations.update(studio._id, { $set: setter })

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
		const file = RecordedFiles.findOne(id)
		if (!file) throw new Meteor.Error(404, `Recording "${id}" was not found!`)

		const studio = StudioInstallations.findOne(file.studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${file.studioId}" was not found!`)

		const config = getStudioConfig(studio)
		if (!config.recordings.urlPrefix) throw new Meteor.Error(500, `URL prefix for Studio "${studio._id}" not defined!`)

		deleteRequest({ uri: config.recordings.urlPrefix + file.path }).then(res => {
			// 404 is ok, as it means file already doesnt exist. 200 is also good
			if (res.statusCode !== 404 && res.statusCode !== 200) {
				throw new Meteor.Error(500, `Failed to delete recording "${id}"!`)
			}

			RecordedFiles.remove(id)

			return true
		})
	}
}

let methods = {}
methods[TestToolsAPI.methods.recordStop] = (studioId) => {
	return ServerTestToolsAPI.recordStop(studioId)
}
methods[TestToolsAPI.methods.recordStart] = (studioId, name) => {
	return ServerTestToolsAPI.recordStart(studioId, name)
}
methods[TestToolsAPI.methods.recordDelete] = (id) => {
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
