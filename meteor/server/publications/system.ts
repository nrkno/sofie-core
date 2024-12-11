import { meteorPublish } from './lib/lib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { CoreSystem } from '../collections'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

meteorPublish(MeteorPubSub.coreSystem, async function (_token: string | undefined) {
	triggerWriteAccessBecauseNoCheckNecessary()

	return CoreSystem.findWithCursor(SYSTEM_ID, {
		fields: {
			// Include only specific fields in the result documents:
			_id: 1,
			systemInfo: 1,
			apm: 1,
			name: 1,
			logLevel: 1,
			serviceMessages: 1,
			blueprintId: 1,
			logo: 1,
			settingsWithOverrides: 1,
		},
	})
})
