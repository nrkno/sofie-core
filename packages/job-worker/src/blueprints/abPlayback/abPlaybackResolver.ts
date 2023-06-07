import { clone } from '@sofie-automation/corelib/dist/lib'
import * as _ from 'underscore'

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

export interface SessionRequest {
	readonly id: string
	readonly start: number
	readonly end: number | undefined
	readonly optional?: boolean
	readonly lookaheadRank?: number
	player?: number
}

export interface AssignmentResult {
	failedRequired: string[]
	failedOptional: string[]
	requests: Readonly<SessionRequest[]>
}

interface SlotAvailability {
	id: number
	before: (SessionRequest & { end: number }) | null
	after: SessionRequest | null
	clashes: SessionRequest[]
}

function safeMax<T>(arr: T[], func: (val: T) => number): T | undefined {
	if (arr.length) {
		const v = _.max(arr, func)
		return typeof v === 'number' ? undefined : v
	} else {
		return undefined
	}
}

function safeMin<T>(arr: T[], func: (val: T) => number): T | undefined {
	if (arr.length) {
		const v = _.min(arr, func)
		return typeof v === 'number' ? undefined : v
	} else {
		return undefined
	}
}

export function resolveAbAssignmentsFromRequests(
	options: ABResolverOptions,
	slotIds: number[],
	rawRequests: SessionRequest[],
	now: number // Current time
): AssignmentResult {
	const res: AssignmentResult = {
		requests: _.sortBy(rawRequests, (r) => r.start).map((v) => clone(v)),
		failedRequired: [],
		failedOptional: [],
	}

	if (slotIds.length === 1) {
		// If only a single player, lets hope it works out forcing them all into the one..
		for (const request of res.requests) {
			request.player = slotIds[0]
		}
		return res
	}

	let grouped = _.groupBy(res.requests, (r) => r.player ?? 'undefined')
	let pendingRequests = grouped[undefined as any]
	if (!pendingRequests) {
		// Nothing pending, result must be ok
		return res
	}

	const originalLookaheadAssignments: Record<string, number> = {}
	for (const req of rawRequests) {
		if (req.lookaheadRank !== undefined && req.player !== undefined) {
			originalLookaheadAssignments[req.id] = req.player
			delete req.player
		}
	}

	const safeNow = now + options.nowWindow // Treat now + nowWindow as now, as it is likely that anything changed within that window will be late to air

	// Clear assignments for anything which has no chance of being preloaded yet
	_.each(grouped, (grp) => {
		for (let i = 1; i < grp.length; i++) {
			const prev = grp[i - 1]
			const next = grp[i]
			if (next.start >= safeNow && prev.end && prev.end < safeNow) {
				delete next.player
			}
		}
	})
	grouped = _.groupBy(res.requests, (r) => r.player ?? 'undefined') // Recalculate the groups based on the new data
	pendingRequests = grouped[undefined as any]

	// build map of slots and what they already have assigned
	const slots: Map<number, SessionRequest[]> = new Map()
	_.each(slotIds, (id) => slots.set(id, grouped[id] || []))

	const beforeHasGap = (p: SlotAvailability, req: SessionRequest): boolean =>
		!p.before || p.before.end < req.start - options.idealGapBefore
	const maxGapAfter = (sl: SlotAvailability[]): SlotAvailability | undefined => {
		if (sl.length) {
			return safeMax(sl, (p) => p.after?.start ?? Number.POSITIVE_INFINITY)
		} else {
			return undefined
		}
	}
	const canBeReplaced = (other: SessionRequest, self: SessionRequest): boolean => other.optional || !self.optional

	const invalidateOnesStartingAfterOrClashing = (
		_req: SessionRequest,
		candidate: SlotAvailability | undefined,
		allowClashing?: boolean
	): SessionRequest[] => {
		const invalidated: SessionRequest[] = []

		if (candidate?.after) {
			const start = candidate.after.start
			for (const pl of slots) {
				const [startNowOrLater, startEarlier] = _.partition(pl[1], (p) => p.start >= start)
				slots.set(pl[0], startEarlier)
				invalidated.push(
					...startNowOrLater.map((p) => {
						delete p.player
						return p
					})
				)
			}
		}

		if (!allowClashing && candidate) {
			const slot = slots.get(candidate.id)
			if (slot) {
				candidate.clashes?.forEach((cl) => {
					delete cl.player
					invalidated.push(cl)

					// They no longer are assigned to the slot, so pull them off
					const index = slot.findIndex((cl2) => cl2.id === cl.id)
					if (index !== -1) {
						slot.splice(index, 1)
					}
				})
				slots.set(candidate.id, slot)
			}
		}

		return invalidated
	}
	const clashesStartsAfterThis = (slot: SlotAvailability, req: SessionRequest): boolean =>
		!slot.clashes.find((c) => c.start <= safeNow || c.start < req.start || !canBeReplaced(c, req))

	let iterations = 200
	for (let req0 = pendingRequests.shift(); req0; req0 = pendingRequests.shift()) {
		const req = req0

		// Ignore any lookahead objects for now
		if (req.lookaheadRank !== undefined) continue

		// A break condition in case we get stuck swapping between some assignments
		if (iterations-- < 0) {
			throw new Error('pendingRequests infinite loop')
		}

		// Calculate each slots availability for the timewindow that req needs
		const slotAvailability: SlotAvailability[] = []
		for (const slot of slots) {
			slotAvailability.push(getAvailability(slot[0], req, slot[1]))
		}
		const nonClashing = slotAvailability.filter((p) => p.clashes.length === 0)
		const clashing = slotAvailability.filter((p) => p.clashes.length > 0)

		let invalidated: SessionRequest[] | undefined

		let candidate: SlotAvailability | undefined
		if (req.start < safeNow) {
			// Pack it dense, as lookahead will very likely not be able to show anyway
			// Try and leave a gap before/after if possible though

			// Try and keep a short gap before, and a long gap after
			const hasGapBefore = nonClashing.filter((p) => beforeHasGap(p, req))
			if (!candidate) {
				candidate = maxGapAfter(hasGapBefore)
			}

			// Accept no gap before, and a long gap after
			if (!candidate) {
				candidate = maxGapAfter(nonClashing)
			}

			// consider slots where the start is free, but the end is occupied and outside of safeNow
			const freeAtStart = clashing.filter((p) => beforeHasGap(p, req) && clashesStartsAfterThis(p, req))
			if (!candidate && freeAtStart.length) {
				candidate = safeMax(
					freeAtStart,
					(p) => safeMax(p.clashes, (c) => c.start)?.start ?? Number.POSITIVE_INFINITY
				)
			}
		} else {
			// Spread it out, we might get some lookahead

			const nothingAfter = nonClashing.filter((p) => !p.after)
			if (!candidate && nothingAfter.length) {
				// Find the player with nothing coming up that gives us the best preload time
				candidate = safeMin(nothingAfter, (p) => {
					const minClearance = req.start - options.idealGapBefore
					const availableAfter = p.before?.end ?? Number.NEGATIVE_INFINITY
					// Return in range of before.end <-> (req.start - gap)
					// We want the slot which has the earliest before.end
					return Math.min(minClearance, availableAfter)
				})
			}

			// Find ones with something after, where the after is optional, or we are not optional
			const withAfter = nonClashing.filter((p) => p.after && canBeReplaced(p.after, req))
			if (!candidate && withAfter.length) {
				// Find the player which starts the last
				candidate = safeMax(withAfter, (p) => p.after?.start ?? Number.NEGATIVE_INFINITY)
				invalidated = invalidateOnesStartingAfterOrClashing(req, candidate)
			}

			// consider slots where the start is free, but the end is occupied
			const freeAtStart = clashing.filter((p) => beforeHasGap(p, req) && clashesStartsAfterThis(p, req))
			if (!candidate && freeAtStart.length) {
				candidate = safeMax(
					freeAtStart,
					(p) => safeMax(p.clashes, (c) => c.start)?.start ?? Number.POSITIVE_INFINITY
				)
				invalidated = invalidateOnesStartingAfterOrClashing(req, candidate)
			}

			// if there is a player full of optionals, then claim it
			const nonPlayingClashingOptionals = clashing.filter(
				(p) => !p.clashes.find((c) => !c.optional) && !req.optional && req.lookaheadRank === undefined
			)
			if (!candidate && nonPlayingClashingOptionals.length) {
				candidate = safeMax(
					nonPlayingClashingOptionals,
					(p) => safeMax(p.clashes, (c) => c.start)?.start ?? Number.POSITIVE_INFINITY
				)
				invalidated = invalidateOnesStartingAfterOrClashing(req, candidate)
			}
		}

		// Find ones which end when we start
		const touchesStart = clashing.filter(
			(p) => p.clashes.filter((cl) => cl.end === req.start).length === p.clashes.length
		)
		if (!candidate && touchesStart.length) {
			// Find the player with the longest clearance to the next usage
			candidate = safeMax(touchesStart, (p) => p.after?.start ?? Number.POSITIVE_INFINITY)
			invalidated = invalidateOnesStartingAfterOrClashing(req, candidate, true)
		}

		// Wrap it up
		if (invalidated) {
			if (req.lookaheadRank !== undefined) {
				// Ignore any lookaheads that were invalidated, or we get lost in an infinite loop
				invalidated = invalidated.filter((i) => i.lookaheadRank === undefined)
			}

			pendingRequests.push(...invalidated)
			pendingRequests = _.sortBy(pendingRequests, (p) => p.start) // TODO - can we optimise this?
		}

		// We found a slot, so claim it
		if (candidate) {
			let dropId: string | undefined
			if (
				(candidate.after?.lookaheadRank !== undefined &&
					req.end === undefined &&
					req.lookaheadRank === undefined) || // If a lookahead follows
				(req.end && candidate.after?.start && candidate.after?.start < req.end) // If the after clashes
			) {
				delete candidate.after.player
				dropId = candidate.after.id

				// Push back to the queue for allocation
				pendingRequests.push(candidate.after)
			}

			req.player = candidate.id
			let slotRequests = slots.get(candidate.id)
			if (slotRequests) {
				slotRequests.push(req)
				slotRequests = _.sortBy(
					slotRequests.filter((p) => p.id !== dropId),
					(p) => p.start
				) // TODO - can we optimise this?
				slots.set(candidate.id, slotRequests)
			}
		} else {
			if (req.lookaheadRank !== undefined) {
				// ignore
			} else if (req.optional) {
				res.failedOptional.push(req.id)
			} else {
				res.failedRequired.push(req.id)
			}
		}
	}

	// Ensure lookahead gets assigned based on priority not some randomness
	// Includes slots which have either no sessions, or the last has a known end time
	const lastSessionPerSlot: Record<number, number | undefined> = {} // slotId, end
	for (const [slotId, sessions] of slots) {
		const last = _.last(sessions.filter((s) => s.lookaheadRank === undefined))
		if (!last) {
			lastSessionPerSlot[slotId] = Number.NEGATIVE_INFINITY
		} else if (last.end !== undefined) {
			// If there is a defined end, then it can be useful after that point of time
			lastSessionPerSlot[slotId] = last.end
		}
	}

	// Filter down to the lookaheads that we should try to assign
	const lookaheadsToAssign = _.sortBy(
		res.requests.filter((r) => r.lookaheadRank !== undefined),
		(r) => r.lookaheadRank
	).slice(0, Object.keys(lastSessionPerSlot).length)

	// Persist previous players if possible
	const remainingLookaheads: SessionRequest[] = []
	for (const req of lookaheadsToAssign) {
		delete req.player

		const prevPlayer = originalLookaheadAssignments[req.id]
		if (prevPlayer === undefined) {
			remainingLookaheads.push(req)
		} else {
			// Ensure the assignment is ok
			const slotEnd = lastSessionPerSlot[prevPlayer]
			if (slotEnd === undefined || slotEnd >= safeNow) {
				// It isnt available for this lookahead, or isnt visible yet
				remainingLookaheads.push(req)
			} else {
				// It is ours, so remove the player from the pool
				req.player = prevPlayer
				delete lastSessionPerSlot[req.player]
			}
		}
	}

	// Assign any remaining lookaheads
	const sortedSlots = _.sortBy(Object.entries<number | undefined>(lastSessionPerSlot), (s) => s[1] ?? 0)
	for (let i = 0; i < remainingLookaheads.length; i++) {
		const slot = sortedSlots[i]
		const req = remainingLookaheads[i]

		if (slot) {
			req.player = Number(slot[0])
		} else {
			delete req.player
		}
	}

	return res
}

function getAvailability(id: number, thisReq: SessionRequest, orderedRequests: SessionRequest[]): SlotAvailability {
	const res: SlotAvailability = {
		id,
		before: null,
		after: null,
		clashes: [],
	}

	for (const req of orderedRequests) {
		if (req.end && req.end < thisReq.start) {
			res.before = {
				...req,
				end: req.end,
			}
		} else if (req.lookaheadRank || (thisReq.end && req.start >= thisReq.end)) {
			res.after = req
			break
		} else {
			res.clashes.push(req)
		}
	}

	return res
}
