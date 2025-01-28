/**
 * This file is the entry-point for Meteor's server side
 */

import { Meteor } from 'meteor/meteor'

Meteor.startup(() => {
	console.log('startup')
})

// Import all files that register Meteor methods:
import './api/blueprints/api.js'
import './api/blueprints/http.js'
import './api/blueprintConfigPresets.js'
import './api/client.js'
import './api/ExternalMessageQueue.js'
import './api/heapSnapshot.js'
import './api/ingest/debug.js'
import './api/integration/expectedPackages.js'
import './api/integration/media-scanner.js'
import './api/integration/mediaWorkFlows.js'
import './api/peripheralDevice.js'
import './api/playout/api.js'
import './api/rundown.js'
import './api/rundownLayouts.js'
import './api/showStyles.js'
import './api/triggeredActions.js'
import './api/snapshot.js'
import './api/studio/api.js'
import './api/system.js'
import './api/userActions.js'
import './methods.js'
import './migration/api.js'
import './migration/databaseMigration.js'
import './migration/migrations.js'
import './api/playout/debug.js'
import './performanceMonitor.js'
import './systemStatus/api.js'
import './api/user.js'
import './api/organizations.js'
import './api/serviceMessages/api.js'
import './webmanifest.js'

// import all files that calls Meteor.startup:
import './api/rest/api.js'
import './Connections.js'
import './coreSystem/index.js'
import './cronjobs.js'
import './prometheus.js'
import './api/deviceTriggers/observer.js'
import './logo.js'
import './systemTime.js'
// import './performanceMonitor' // called above

// Setup publications and security:
import './publications/_publications.js'
import './security/securityVerify.js'
