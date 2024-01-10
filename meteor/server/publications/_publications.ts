import { Meteor } from 'meteor/meteor'
import './lib'

import './buckets'
import './blueprintUpgradeStatus/publication'
import './packageManager/expectedPackages/publication'
import './packageManager/packageContainers'
import './packageManager/playoutContext'
import './pieceContentStatusUI/bucket/publication'
import './pieceContentStatusUI/rundown/publication'
import './organization'
import './peripheralDevice'
import './peripheralDeviceForDevice'
import './rundown'
import './rundownPlaylist'
import './segmentPartNotesUI/publication'
import './showStyle'
import './showStyleUI'
import './studio'
import './studioUI'
import './system'
import './timeline'
import './translationsBundles'
import './triggeredActionsUI'
import './mountedTriggers'
import './deviceTriggersPreview'

import { AllPubSubNames } from '../../lib/api/pubsub'
import { MeteorPublications } from './lib'
import { logger } from '../logging'

// Ensure all the publications were registered at startup
if (Meteor.isDevelopment) {
	Meteor.startup(() => {
		for (const pubName of AllPubSubNames) {
			if (!MeteorPublications[pubName]) {
				logger.error(`Publication "${pubName}" is not setup!`)
			}
		}
	})
}
