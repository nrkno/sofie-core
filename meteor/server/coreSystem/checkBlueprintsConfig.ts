import { StatusCode } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { Blueprints } from '../../lib/collections/Blueprints'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Studios } from '../../lib/collections/Studios'
import { findMissingConfigs } from '../api/blueprints/config'
import { createShowStyleCompound } from '../api/showStyles'
import { logger } from '../logging'
import { removeSystemStatus, setSystemStatus } from '../systemStatus/systemStatus'

let checkBlueprintsConfigTimeout: number | undefined
let checkBlueprintsConfigRunning = false
export function queueCheckBlueprintsConfig() {
	const RATE_LIMIT = 10000

	// We want to rate limit this. It doesn't matter if it is delayed, so lets do that to keep it simple
	if (!checkBlueprintsConfigTimeout) {
		checkBlueprintsConfigTimeout = Meteor.setTimeout(() => {
			checkBlueprintsConfigTimeout = undefined

			checkBlueprintsConfig()
		}, RATE_LIMIT)
	}
}

let lastBlueprintConfigIds: { [id: string]: true } = {}
function checkBlueprintsConfig() {
	if (checkBlueprintsConfigRunning) {
		// already running, queue for later
		queueCheckBlueprintsConfig()
		return
	}
	checkBlueprintsConfigRunning = true

	logger.debug('checkBlueprintsConfig start')

	try {
		const blueprintIds: { [id: string]: true } = {}

		// Studios
		_.each(Studios.find({}).fetch(), (studio) => {
			const blueprint = Blueprints.findOne(studio.blueprintId)
			if (!blueprint) return

			const blueprintConfig = applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
			const diff = findMissingConfigs(blueprint.studioConfigManifest, blueprintConfig)
			const systemStatusId = `blueprintConfig_${blueprint._id}_studio_${studio._id}`
			setBlueprintConfigStatus(systemStatusId, diff, studio._id)
			blueprintIds[systemStatusId] = true
		})

		// ShowStyles
		_.each(ShowStyleBases.find({}).fetch(), (showBase) => {
			const blueprint = Blueprints.findOne(showBase.blueprintId)
			if (!blueprint || !blueprint.showStyleConfigManifest) return

			const variants = ShowStyleVariants.find({
				showStyleBaseId: showBase._id,
			}).fetch()

			const allDiffs: string[] = []

			_.each(variants, (variant) => {
				const compound = createShowStyleCompound(showBase, variant)
				if (!compound) return

				const diff = findMissingConfigs(blueprint.showStyleConfigManifest, compound.combinedBlueprintConfig)
				if (diff && diff.length) {
					allDiffs.push(`Variant ${variant._id}: ${diff.join(', ')}`)
				}
			})
			const systemStatusId = `blueprintConfig_${blueprint._id}_showStyle_${showBase._id}`
			setBlueprintConfigStatus(systemStatusId, allDiffs)
			blueprintIds[systemStatusId] = true
		})

		// Check for removed
		_.each(lastBlueprintConfigIds, (_val, id: string) => {
			if (!blueprintIds[id]) {
				removeSystemStatus(id)
			}
		})
		lastBlueprintConfigIds = blueprintIds
	} finally {
		checkBlueprintsConfigRunning = false

		logger.debug('checkBlueprintsConfig done!')
	}
}
function setBlueprintConfigStatus(systemStatusId: string, diff: string[], studioId?: StudioId) {
	if (diff && diff.length > 0) {
		setSystemStatus(systemStatusId, {
			studioId: studioId,
			statusCode: StatusCode.WARNING_MAJOR,
			messages: [`Config is missing required fields: ${diff.join(', ')}`],
		})
	} else {
		setSystemStatus(systemStatusId, {
			studioId: studioId,
			statusCode: StatusCode.GOOD,
			messages: ['Config is valid'],
		})
	}
}
