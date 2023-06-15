import { AB_MEDIA_PLAYER_AUTO } from '@sofie-automation/blueprints-integration'
import { PartId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionInfo } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { getRandomString, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString, unpartialString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { ReadonlyDeep } from 'type-fest'

interface ABSessionInfoExt extends ABSessionInfo {
	/** Whether to store this session on the playlist (ie, whether it is still valid) */
	keep?: boolean
}

/**
 * A helper class for generating unique and persistent AB-playback sessionIds
 */
export class AbSessionHelper {
	readonly #partInstances: ReadonlyDeep<Array<DBPartInstance>>

	readonly #knownSessions: ABSessionInfoExt[]

	constructor(partInstances: ReadonlyDeep<Array<DBPartInstance>>, knownSessions: ABSessionInfo[]) {
		this.#partInstances = partInstances
		this.#knownSessions = knownSessions
	}

	public get allKnownSessions(): ABSessionInfo[] {
		return this.#knownSessions.map((s) => omit(s, 'keep'))
	}

	public get knownSessions(): ABSessionInfo[] {
		return this.#knownSessions.filter((s) => s.keep).map((s) => omit(s, 'keep'))
	}

	/** Internal, for overriding in tests */
	getNewSessionId(): string {
		return getRandomString()
	}

	/**
	 * Get the full session id for an ab playback session.
	 * Note: sessionName should be unique within the segment unless pieces want to share a session
	 */
	getPieceABSessionId(pieceInstance: PieceInstance, sessionName: string): string {
		const partInstanceIndex = this.#partInstances.findIndex((p) => p._id === pieceInstance.partInstanceId)
		const partInstance = partInstanceIndex >= 0 ? this.#partInstances[partInstanceIndex] : undefined
		if (!partInstance) throw new Error('Unknown partInstanceId in call to getPieceABSessionId')

		const infiniteId = pieceInstance.infinite?.infiniteInstanceId
		const preserveSession = (session: ABSessionInfoExt): string => {
			session.keep = true
			session.infiniteInstanceId = unpartialString(infiniteId)
			delete session.lookaheadForPartId
			return session.id
		}

		// If this is an infinite continuation, then reuse that
		if (infiniteId) {
			const infiniteSession = this.#knownSessions.find(
				(s) => s.infiniteInstanceId === infiniteId && s.name === sessionName
			)
			if (infiniteSession) {
				return preserveSession(infiniteSession)
			}
		}

		// We only want to consider sessions already tagged to this partInstance
		const existingSession = this.#knownSessions.find(
			(s) => s.partInstanceIds?.includes(pieceInstance.partInstanceId) && s.name === sessionName
		)
		if (existingSession) {
			return preserveSession(existingSession)
		}

		// Check if we can continue sessions from the part before, or if we should create new ones
		const canReuseFromPartInstanceBefore =
			partInstanceIndex > 0 && this.#partInstances[partInstanceIndex - 1].part._rank < partInstance.part._rank

		if (canReuseFromPartInstanceBefore) {
			// Try and find a session from the part before that we can use
			const previousPartInstanceId = this.#partInstances[partInstanceIndex - 1]._id
			const continuedSession = this.#knownSessions.find(
				(s) => s.partInstanceIds?.includes(previousPartInstanceId) && s.name === sessionName
			)
			if (continuedSession) {
				continuedSession.partInstanceIds = [
					...(continuedSession.partInstanceIds || []),
					pieceInstance.partInstanceId,
				]
				return preserveSession(continuedSession)
			}
		}

		// Find an existing lookahead session to convert
		const partId = partInstance.part._id
		const lookaheadSession = this.#knownSessions.find(
			(s) => s.name === sessionName && s.lookaheadForPartId === partId
		)
		if (lookaheadSession) {
			lookaheadSession.partInstanceIds = [pieceInstance.partInstanceId]
			return preserveSession(lookaheadSession)
		}

		// Otherwise define a new session
		const sessionId = this.getNewSessionId()
		const newSession: ABSessionInfoExt = {
			id: sessionId,
			name: sessionName,
			infiniteInstanceId: unpartialString(infiniteId),
			partInstanceIds: !infiniteId ? [pieceInstance.partInstanceId] : [],
			keep: true,
		}
		this.#knownSessions.push(newSession)
		return sessionId
	}

	/**
	 * Get the full session id for a timelineobject that belongs to an ab playback session
	 * sessionName should also be used in calls to getPieceABSessionId for the owning piece
	 */
	getTimelineObjectAbSessionId(tlObj: OnGenerateTimelineObjExt, sessionName: string): string | undefined {
		// Find an infinite
		const searchId = tlObj.infinitePieceInstanceId
		if (searchId) {
			const infiniteSession = this.#knownSessions.find(
				(s) => s.infiniteInstanceId === searchId && s.name === sessionName
			)
			if (infiniteSession) {
				infiniteSession.keep = true
				return infiniteSession.id
			}
		}

		// Find an normal partInstance
		const partInstanceId = tlObj.partInstanceId
		if (partInstanceId) {
			const partInstanceSession = this.#knownSessions.find(
				(s) => s.partInstanceIds?.includes(partInstanceId) && s.name === sessionName
			)
			if (partInstanceSession) {
				partInstanceSession.keep = true
				return partInstanceSession.id
			}
		}

		// If it is lookahead, then we run differently
		let partId = protectString<PartId>(unprotectString(partInstanceId))
		if (tlObj.isLookahead && partInstanceId && partId) {
			// If partId is a known partInstanceId, then convert it to a partId
			const partInstance = this.#partInstances.find((p) => p._id === partInstanceId)
			if (partInstance) partId = partInstance.part._id

			const lookaheadSession = this.#knownSessions.find(
				(s) => s.lookaheadForPartId === partId && s.name === sessionName
			)
			if (lookaheadSession) {
				lookaheadSession.keep = true
				if (partInstance) {
					lookaheadSession.partInstanceIds = [partInstanceId]
				}
				return lookaheadSession.id
			} else {
				const sessionId = this.getNewSessionId()
				this.#knownSessions.push({
					id: sessionId,
					name: sessionName,
					lookaheadForPartId: partId,
					partInstanceIds: partInstance ? [partInstanceId] : undefined,
					keep: true,
				})
				return sessionId
			}
		}

		return undefined
	}

	/**
	 * Make the sessionName unique for the pool, and ensure it isn't set to AUTO
	 */
	validateSessionName(pieceInstanceId: PieceInstanceId | string, session: TimelineObjectAbSessionInfo): string {
		const newName = session.sessionName === AB_MEDIA_PLAYER_AUTO ? pieceInstanceId : session.sessionName
		return `${session.poolName}_${newName}`
	}
}
