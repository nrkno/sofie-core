import { UserAction } from '../userAction'
import { IMeteorCall } from '../api/methods'
import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { ClientAPI } from '../api/client'
import { MongoReadOnlyCollection } from '../collections/lib'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { LoggerInstanceFixed } from '@sofie-automation/corelib/dist/logging'
import { IBaseFilterLink } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReactivePlaylistActionContext } from './actionFactory'
import { TFunction } from 'i18next'

export interface TriggersContext {
	readonly MeteorCall: IMeteorCall

	readonly logger: LoggerInstanceFixed

	readonly isClient: boolean

	readonly AdLibActions: MongoReadOnlyCollection<AdLibAction>
	readonly AdLibPieces: MongoReadOnlyCollection<AdLibPiece>
	readonly Parts: MongoReadOnlyCollection<DBPart>
	readonly RundownBaselineAdLibActions: MongoReadOnlyCollection<RundownBaselineAdLibAction>
	readonly RundownBaselineAdLibPieces: MongoReadOnlyCollection<RundownBaselineAdLibItem>
	readonly RundownPlaylists: MongoReadOnlyCollection<DBRundownPlaylist>
	readonly Rundowns: MongoReadOnlyCollection<DBRundown>
	readonly Segments: MongoReadOnlyCollection<DBSegment>

	hashSingleUseToken(token: string): string

	doUserAction<Result>(
		_t: TFunction,
		userEvent: string,
		_action: UserAction,
		fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
		callback?: (err: any, res?: Result) => void | boolean,
		_okMessage?: string
	): void

	nonreactiveTracker<T>(func: () => T): T

	memoizedIsolatedAutorun<T extends (...args: any) => any>(
		fnc: T,
		functionName: string,
		...params: Parameters<T>
	): ReturnType<T>

	createContextForRundownPlaylistChain(
		_studioId: StudioId,
		_filterChain: IBaseFilterLink[]
	): ReactivePlaylistActionContext | undefined
}
