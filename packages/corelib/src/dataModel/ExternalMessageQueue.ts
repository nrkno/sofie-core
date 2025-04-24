import {
	IBlueprintExternalMessageQueueObj,
	Time,
	IBlueprintExternalMessageQueueType,
} from '@sofie-automation/blueprints-integration'
import { ProtectedStringProperties } from '../protectedString.js'
import { ExternalMessageQueueObjId, StudioId, RundownId } from './Ids.js'

export interface ExternalMessageQueueObj extends ProtectedStringProperties<IBlueprintExternalMessageQueueObj, '_id'> {
	_id: ExternalMessageQueueObjId
	/** Id of the studio this message originates from */
	studioId: StudioId
	/** (Optional) id of the rundown this message originates from */
	rundownId?: RundownId
	/** At this time the message will be removed */
	expires: Time
	/** Time of message creation */
	created: Time
	/** Number of times the message tried to be sent */
	tryCount: number
	/** Time of last send try: */
	lastTry?: Time
	/** If message send failed, last error message */
	errorMessage?: string
	/** If message send failed, last error message timestamp */
	errorMessageTime?: number
	/** Time of succeeded send: */
	sent?: Time
	/** Reply from receiver */
	sentReply?: string
	/** If true, wont retry any more */
	errorFatal?: boolean
	/** If true, wont retry (can be set from UI) */
	hold?: boolean

	/** Type of message */
	type: IBlueprintExternalMessageQueueType
	/**
	 * If set, the message won't be sent automatically.
	 * Contains the reason for why the message was queued and not sent.
	 */
	queueForLaterReason?: string
	/** Receiver details */
	receiver: any
	/** Messate details */
	message: any
	/** Retry sending messages until this time */
	retryUntil?: Time
	/** Manual retry override (UI retry button) - retry once more */
	manualRetry?: boolean
}
