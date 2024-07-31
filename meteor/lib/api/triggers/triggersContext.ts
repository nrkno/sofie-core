import { Meteor } from 'meteor/meteor'
import { TriggersContext } from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { SINGLE_USE_TOKEN_SALT } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { assertNever, getCurrentTime, getHash, Time } from '../../lib'
import { IMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import { MeteorCall } from '../../../server/api/methods'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { UserAction } from '@sofie-automation/meteor-lib/dist/userAction'
import { TFunction } from 'i18next'
import { Tracker } from 'meteor/tracker'
import {
	AdLibActions,
	AdLibPieces,
	PartInstances,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
} from '../../collections/libCollections'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { MongoReadOnlyCollection } from '../../collections/lib'
import { LoggerInstanceFixed } from '@sofie-automation/corelib/dist/logging'
import { logger } from '../../../server/logging'
import { IBaseFilterLink, IRundownPlaylistFilterLink } from '@sofie-automation/blueprints-integration'
import { PartId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DummyReactiveVar } from '@sofie-automation/meteor-lib/dist/triggers/reactive-var'
import { ReactivePlaylistActionContext } from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

export function hashSingleUseToken(token: string): string {
	return getHash(SINGLE_USE_TOKEN_SALT + token)
}

export class MeteorTriggersContext implements TriggersContext {
	get MeteorCall(): IMeteorCall {
		return MeteorCall
	}

	get logger(): LoggerInstanceFixed {
		return logger
	}

	get isClient(): boolean {
		return Meteor.isClient
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
		_t: TFunction,
		userEvent: string,
		_action: UserAction,
		fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
		callback?: (err: any, res?: Result) => void | boolean,
		_okMessage?: string
	): void {
		fcn(userEvent, getCurrentTime()).then(
			(value) =>
				typeof callback === 'function' &&
				(ClientAPI.isClientResponseSuccess(value) ? callback(undefined, value.result) : callback(value)),
			(reason) => typeof callback === 'function' && callback(reason)
		)
	}

	nonreactiveTracker<T>(func: () => T): T {
		return Tracker.nonreactive(func)
	}

	memoizedIsolatedAutorun<T extends (...args: any) => any>(
		fnc: T,
		_functionName: string,
		...params: Parameters<T>
	): ReturnType<T> {
		return fnc(...(params as any))
	}

	createContextForRundownPlaylistChain(
		studioId: StudioId,
		filterChain: IBaseFilterLink[]
	): ReactivePlaylistActionContext | undefined {
		const playlist = rundownPlaylistFilter(
			studioId,
			filterChain.filter((link) => link.object === 'rundownPlaylist') as IRundownPlaylistFilterLink[]
		)

		if (!playlist) return undefined

		let currentPartId: PartId | null = null,
			nextPartId: PartId | null = null,
			currentPartInstance: PartInstance | null = null,
			currentSegmentPartIds: PartId[] = [],
			nextSegmentPartIds: PartId[] = []

		if (playlist.currentPartInfo) {
			currentPartInstance = PartInstances.findOne(playlist.currentPartInfo.partInstanceId) ?? null
			const currentPart = currentPartInstance?.part ?? null
			if (currentPart) {
				currentPartId = currentPart._id
				currentSegmentPartIds = Parts.find({
					segmentId: currentPart.segmentId,
				}).map((part) => part._id)
			}
		}
		if (playlist.nextPartInfo) {
			const nextPart = PartInstances.findOne(playlist.nextPartInfo.partInstanceId)?.part ?? null
			if (nextPart) {
				nextPartId = nextPart._id
				nextSegmentPartIds = Parts.find({
					segmentId: nextPart.segmentId,
				}).map((part) => part._id)
			}
		}

		return {
			rundownPlaylistId: new DummyReactiveVar(playlist?._id),
			rundownPlaylist: new DummyReactiveVar(playlist),
			currentRundownId: new DummyReactiveVar(
				currentPartInstance?.rundownId ?? playlist.rundownIdsInOrder[0] ?? null
			),
			currentPartId: new DummyReactiveVar(currentPartId),
			currentSegmentPartIds: new DummyReactiveVar(currentSegmentPartIds),
			nextPartId: new DummyReactiveVar(nextPartId),
			nextSegmentPartIds: new DummyReactiveVar(nextSegmentPartIds),
			currentPartInstanceId: new DummyReactiveVar(playlist.currentPartInfo?.partInstanceId ?? null),
		}
	}
}

function rundownPlaylistFilter(
	studioId: StudioId,
	filterChain: IRundownPlaylistFilterLink[]
): DBRundownPlaylist | undefined {
	const selector: MongoQuery<DBRundownPlaylist> = {
		$and: [
			{
				studioId,
			},
		],
	}

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'activationId':
				selector['activationId'] = {
					$exists: link.value,
				}
				break
			case 'name':
				selector['name'] = {
					$regex: link.value,
				}
				break
			case 'studioId':
				selector['$and']?.push({
					studioId: {
						$regex: link.value as any,
					},
				})
				break
			default:
				assertNever(link)
				break
		}
	})

	return RundownPlaylists.findOne(selector)
}
