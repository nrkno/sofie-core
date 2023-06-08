import {
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	ITimelineEventContext,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ABSessionInfo, DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime } from '../../lib'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config'
import _ = require('underscore')
import { ProcessedShowStyleCompound } from '../../jobs'
import { convertPartInstanceToBlueprints } from './lib'
import { RundownContext } from './RundownContext'
import { AbSessionHelper } from '../../playout/abPlayback/abSessionHelper'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export class OnTimelineGenerateContext extends RundownContext implements ITimelineEventContext {
	readonly currentPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly nextPartInstance: Readonly<IBlueprintPartInstance> | undefined
	readonly previousPartInstance: Readonly<IBlueprintPartInstance> | undefined

	readonly abSessionsHelper: AbSessionHelper
	readonly #pieceInstanceCache = new Map<PieceInstanceId, PieceInstance>()

	constructor(
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		playlist: ReadonlyDeep<DBRundownPlaylist>,
		rundown: ReadonlyDeep<DBRundown>,
		previousPartInstance: DBPartInstance | undefined,
		currentPartInstance: DBPartInstance | undefined,
		nextPartInstance: DBPartInstance | undefined,
		pieceInstances: PieceInstance[]
	) {
		super(
			{
				name: playlist.name,
				identifier: `playlistId=${playlist._id},previousPartInstance=${previousPartInstance?._id},currentPartInstance=${currentPartInstance?._id},nextPartInstance=${nextPartInstance?._id}`,
			},
			studio,
			studioBlueprintConfig,
			showStyleCompound,
			showStyleBlueprintConfig,
			rundown
		)

		this.currentPartInstance = currentPartInstance && convertPartInstanceToBlueprints(currentPartInstance)
		this.nextPartInstance = nextPartInstance && convertPartInstanceToBlueprints(nextPartInstance)
		this.previousPartInstance = previousPartInstance && convertPartInstanceToBlueprints(previousPartInstance)

		const partInstances = _.compact([previousPartInstance, currentPartInstance, nextPartInstance])

		for (const pieceInstance of pieceInstances) {
			this.#pieceInstanceCache.set(pieceInstance._id, pieceInstance)
		}

		this.abSessionsHelper = new AbSessionHelper(
			partInstances,
			clone<ABSessionInfo[]>(playlist.trackedAbSessions ?? [])
		)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	/**
	 * @deprecated Use core provided AB resolving
	 */
	getPieceABSessionId(pieceInstance0: Pick<IBlueprintPieceInstance, '_id'>, sessionName: string): string {
		const pieceInstanceId = protectString(pieceInstance0._id)
		if (!pieceInstanceId) throw new Error('Invalid PieceInstance passed to getPieceABSessionId')

		// Fetch the cached PieceInstance, to ensure it hasn't been mangled by the blueprints
		const pieceInstance = this.#pieceInstanceCache.get(pieceInstanceId)
		const partInstanceId = pieceInstance?.partInstanceId
		if (!partInstanceId) throw new Error('Missing partInstanceId in call to getPieceABSessionId')

		return this.abSessionsHelper.getPieceABSessionId(pieceInstance, sessionName)
	}

	/**
	 * @deprecated Use core provided AB resolving
	 */
	getTimelineObjectAbSessionId(tlObj: OnGenerateTimelineObjExt, sessionName: string): string | undefined {
		return this.abSessionsHelper.getTimelineObjectAbSessionId(tlObj, sessionName)
	}
}
