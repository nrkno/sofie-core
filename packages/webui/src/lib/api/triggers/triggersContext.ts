import { TriggersContext } from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { IMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import { hashSingleUseToken } from '../../../client/lib/lib'
import { MeteorCall } from '../../../client/lib/meteorApi'
import { Time } from '@sofie-automation/blueprints-integration'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { TFunction } from 'i18next'
import { UserAction } from '../../clientUserAction'
import { doUserAction } from '../../clientUserAction'
import { memoizedIsolatedAutorun } from '../../memoizedIsolatedAutorun'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { MongoReadOnlyCollection } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import {
	AdLibActions,
	AdLibPieces,
	Parts,
	PartInstances,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
} from '../../../client/collections'
import { LoggerInstanceFixed } from '@sofie-automation/corelib/dist/logging'
import { logger } from '../../../client/lib/logging'

export class UiTriggersContext implements TriggersContext {
	get MeteorCall(): IMeteorCall {
		return MeteorCall
	}

	get logger(): LoggerInstanceFixed {
		return logger
	}

	get isClient(): boolean {
		return Meteor.isClient
	}
	get isServer(): boolean {
		return Meteor.isServer
	}

	get AdLibActions(): MongoReadOnlyCollection<AdLibAction> {
		return AdLibActions
	}
	get AdLibPieces(): MongoReadOnlyCollection<AdLibPiece> {
		return AdLibPieces
	}
	get Parts(): MongoReadOnlyCollection<DBPart> {
		return Parts
	}
	get PartInstances(): MongoReadOnlyCollection<PartInstance> {
		return PartInstances
	}
	get RundownBaselineAdLibActions(): MongoReadOnlyCollection<RundownBaselineAdLibAction> {
		return RundownBaselineAdLibActions
	}
	get RundownBaselineAdLibPieces(): MongoReadOnlyCollection<RundownBaselineAdLibItem> {
		return RundownBaselineAdLibPieces
	}
	get RundownPlaylists(): MongoReadOnlyCollection<DBRundownPlaylist> {
		return RundownPlaylists
	}
	get Rundowns(): MongoReadOnlyCollection<DBRundown> {
		return Rundowns
	}
	get Segments(): MongoReadOnlyCollection<DBSegment> {
		return Segments
	}

	hashSingleUseToken(token: string): string {
		return hashSingleUseToken(token)
	}

	doUserAction<Result>(
		t: TFunction,
		userEvent: string,
		action: UserAction,
		fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
		callback?: (err: any, res?: Result) => void | boolean,
		okMessage?: string
	): void {
		doUserAction(t, userEvent, action, fcn, callback, okMessage)
	}
	nonreactiveTracker<T>(func: () => T): T {
		return Tracker.nonreactive(func)
	}

	memoizedIsolatedAutorun<T extends (...args: any) => any>(
		fnc: T,
		functionName: string,
		...params: Parameters<T>
	): ReturnType<T> {
		return memoizedIsolatedAutorun(fnc, functionName, ...params)
	}
}
