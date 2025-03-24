import { Meteor } from 'meteor/meteor'
import './lib/lib.js'

import './buckets.js'
import './blueprintUpgradeStatus/publication.js'
import './packageManager/expectedPackages/publication.js'
import './packageManager/packageContainers.js'
import './packageManager/playoutContext.js'
import './pieceContentStatusUI/bucket/publication.js'
import './pieceContentStatusUI/rundown/publication.js'
import './organization.js'
import './partsUI/publication.js'
import './partInstancesUI/publication.js'
import './peripheralDevice.js'
import './peripheralDeviceForDevice.js'
import './rundown.js'
import './rundownPlaylist.js'
import './segmentPartNotesUI/publication.js'
import './showStyle.js'
import './showStyleUI.js'
import './studio.js'
import './studioUI.js'
import './system.js'
import './timeline.js'
import './translationsBundles.js'
import './triggeredActionsUI.js'
import './mountedTriggers.js'
import './deviceTriggersPreview.js'

import { AllPubSubNames } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MeteorPublications } from './lib/lib.js'
import { logger } from '../logging.js'

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
