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

import { MeteorPubSub } from '../../lib/api/pubsub'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { MeteorPublications } from './lib'
import { logger } from '../logging'

// Ensure all the publications were registered at startup
if (Meteor.isDevelopment) {
	function checkPublications(pubNames: string[]) {
		for (const pubName of pubNames) {
			if (!MeteorPublications[pubName]) {
				logger.error(`Publication "${pubName}" is not setup!`)
			}
		}
	}

	Meteor.startup(() => {
		checkPublications(Object.values<string>(MeteorPubSub))
		checkPublications(Object.values<string>(CorelibPubSub))
		checkPublications(Object.values<string>(PeripheralDevicePubSub))
	})
}
