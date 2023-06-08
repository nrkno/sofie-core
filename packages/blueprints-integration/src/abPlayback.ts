import type { ICommonContext } from './context'
import type { OnGenerateTimelineObj, TSR } from './timeline'

export interface PieceAbSessionInfo {
	/**
	 * Name for this session
	 * TODO - document uniqueness rules
	 */
	name: string
	/**
	 * Which AB Pool this session is for
	 */
	pool: string
	/**
	 * If true, this assignment will be given low priority
	 */
	optional?: boolean
}

/**
 * A token to identify sessions that need an assignment, but won't be able to provide a unique id.
 * Instead, when this token is encountered, the id of the pieceInstance will be used instead of the name of the session.
 * Note: This doesnt play nice with transitions, so if they are required, then auto cannot be used
 */
export const AB_MEDIA_PLAYER_AUTO = '__auto__'

export interface ABTimelineLayerChangeRule {
	acceptedPoolNames: string[]
	newLayerName: (playerId: number) => string
	allowsLookahead: boolean
}
export type ABTimelineLayerChangeRules = {
	[fromLayer: string]: ABTimelineLayerChangeRule | undefined
}

export interface ABResolverConfiguration {
	resolverOptions: ABResolverOptions
	pools: Record<string, number[]>
	timelineObjectLayerChangeRules?: ABTimelineLayerChangeRules
	customApplyToObject?: (
		context: ICommonContext,
		poolName: string,
		playerId: number,
		timelineObject: OnGenerateTimelineObj<TSR.TSRTimelineContent>
	) => boolean
}

export interface ABResolverOptions {
	/**
	 * Ideal gap between playbacks for the player to be considered a good match
	 */
	idealGapBefore: number
	/**
	 * Duration to consider as now, to ensure playout-gateway has enough time to receive and re-resolve
	 */
	nowWindow: number
}
