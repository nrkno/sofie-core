/**
 * A GENERAL COMMENT ON THIS MODULE
 * ==
 *
 * During the lifecycle of a Rundown, it, along with all of it's Parts & PartInstances undergoes thousands of mutations
 * on it's timing properties. Because of that, it's very difficult to accurately simulate what's going on in one for the
 * purposes of automated testing. It also means that debugging any bugs here is very time consuming and difficult.
 *
 * Please be very cautious when introducing changes here and make sure to try and exhaustively explain any changes made
 * here by answering both How and Why of a particular change, since it may not be clearly evident to the next person,
 * without knowing what particular case you are trying to solve.
 */

import {
	PlaylistTimingBackTime,
	PlaylistTimingForwardTime,
	PlaylistTimingNone,
	PlaylistTimingType,
	RundownPlaylistTiming,
} from '@sofie-automation/blueprints-integration'
import _ from 'underscore'
import {
	findPartInstanceInMapOrWrapToTemporary,
	PartInstance,
	PartInstanceId,
	wrapPartToTemporaryInstance,
} from '../collections/PartInstances'
import { Part, PartId } from '../collections/Parts'
import { RundownPlaylist } from '../collections/RundownPlaylists'
import { Rundown } from '../collections/Rundowns'
import { DBSegment, SegmentId } from '../collections/Segments'
import { unprotectString, literal, protectString } from '../lib'
import { Settings } from '../Settings'

// Minimum duration that a part can be assigned. Used by gap parts to allow them to "compress" to indicate time running out.
const MINIMAL_NONZERO_DURATION = 1

interface BreakProps {
	rundownsBeforeNextBreak: Rundown[]
	breakIsLastRundown
}

interface BreakPropsStateItem {
	expectedEnd: number | undefined
	endOfRundownIsShowBreak: boolean | undefined
	currentPartInstanceId: PartInstanceId | null
	nextPartInstanceId: PartInstanceId | null
}

/**
 * This is a class for calculating timings in a Rundown playlist used by RundownTimingProvider.
 *
 * @export
 * @class RundownTimingCalculator
 */
export class RundownTimingCalculator {
	private temporaryPartInstances: Map<PartId, PartInstance> = new Map<PartId, PartInstance>()

	private linearParts: Array<[PartId, number | null]> = []

	// this.previousPartInstanceId is used to check if the previousPart has changed since last iteration.
	// this is used to track takes and simulate the take timing for the previousPart
	private previousPartInstanceId: PartInstanceId | null = null
	// this is the "simulated" take time of previousPartInstanceId (or real one, if available)
	private lastTakeAt: number | undefined = undefined
	// we need to keep the nextSegmentId here for the brief moment when the next partinstance can't be found
	private nextSegmentId: SegmentId | undefined = undefined

	// look at the comments on RundownTimingContext to understand what these do
	// Note, that these objects are created when an instance is created and are reused for the lifetime
	// of the component. This is to avoid GC running all the time on discarded objects.
	// Only the RundownTimingContext object is unique for a call to `updateDurations`.
	private partDurations: Record<string, number> = {}
	private partExpectedDurations: Record<string, number> = {}
	private partPlayed: Record<string, number> = {}
	private partStartsAt: Record<string, number> = {}
	private partDisplayStartsAt: Record<string, number> = {}
	private partDisplayDurations: Record<string, number> = {}
	private partDisplayDurationsNoPlayback: Record<string, number> = {}
	private displayDurationGroups: Record<string, number> = {}
	private segmentBudgetDurations: Record<string, number> = {}
	private segmentStartedPlayback: Record<string, number> = {}
	private segmentAsPlayedDurations: Record<string, number> = {}
	private breakProps: {
		props: BreakProps | undefined
		state: BreakPropsStateItem[] | undefined
	} = { props: undefined, state: undefined }
	private untimedSegments: Set<SegmentId> = new Set()

	/**
	 * Returns a RundownTimingContext for a given point in time.
	 *
	 * @param {number} now
	 * @param {boolean} isLowResolution
	 * @param {(RundownPlaylist | undefined)} playlist
	 * @param {Rundown[]} rundowns
	 * @param {(Rundown | undefined)} currentRundown
	 * @param {Part[]} parts
	 * @param {Map<PartId, PartInstance>} partInstancesMap
	 * @param {number} [defaultDuration]
	 * @return {*}  {RundownTimingContext}
	 * @memberof RundownTimingCalculator
	 */
	updateDurations(
		now: number,
		isLowResolution: boolean,
		playlist: RundownPlaylist | undefined,
		rundowns: Rundown[],
		currentRundown: Rundown | undefined,
		parts: Part[],
		partInstancesMap: Map<PartId, PartInstance>,
		segments: DBSegment[],
		/** Fallback duration for Parts that have no as-played duration of their own. */
		defaultDuration?: number,
		segmentEntryPartInstances?: PartInstance[]
	): RundownTimingContext {
		let totalRundownDuration = 0
		let remainingRundownDuration = 0
		let asPlayedRundownDuration = 0
		let asDisplayedRundownDuration = 0
		let waitAccumulator = 0
		let currentRemaining = 0
		let startsAtAccumulator = 0
		let displayStartsAtAccumulator = 0
		let segmentDisplayDuration = 0
		let segmentBudgetDurationLeft = 0

		const rundownExpectedDurations: Record<string, number> = {}
		const rundownAsPlayedDurations: Record<string, number> = {}

		let rundownsBeforeNextBreak: Rundown[] | undefined
		let breakIsLastRundown: boolean | undefined
		let liveSegmentId: SegmentId | undefined

		Object.keys(this.displayDurationGroups).forEach((key) => delete this.displayDurationGroups[key])
		Object.keys(this.segmentBudgetDurations).forEach((key) => delete this.segmentBudgetDurations[key])
		Object.keys(this.segmentStartedPlayback).forEach((key) => delete this.segmentStartedPlayback[key])
		Object.keys(this.segmentAsPlayedDurations).forEach((key) => delete this.segmentAsPlayedDurations[key])
		this.untimedSegments.clear()
		this.linearParts.length = 0

		let nextAIndex = -1
		let currentAIndex = -1

		let lastSegmentId: SegmentId | undefined = undefined

		if (playlist) {
			const breakProps = currentRundown
				? this.getRundownsBeforeNextBreak(rundowns, currentRundown, playlist)
				: undefined

			if (breakProps) {
				rundownsBeforeNextBreak = breakProps.rundownsBeforeNextBreak
				breakIsLastRundown = breakProps.breakIsLastRundown
			}

			if (!playlist.nextPartInstanceId) {
				this.nextSegmentId = undefined
			}

			parts.forEach((origPart) => {
				if (origPart.budgetDuration !== undefined) {
					const segmentId = unprotectString(origPart.segmentId)
					if (this.segmentBudgetDurations[segmentId] !== undefined) {
						this.segmentBudgetDurations[unprotectString(origPart.segmentId)] += origPart.budgetDuration
					} else {
						this.segmentBudgetDurations[unprotectString(origPart.segmentId)] = origPart.budgetDuration
					}
				}
			})

			segmentEntryPartInstances?.forEach((partInstance) => {
				if (partInstance.timings?.startedPlayback !== undefined)
					this.segmentStartedPlayback[unprotectString(partInstance.segmentId)] =
						partInstance.timings?.startedPlayback
			})

			parts.forEach((origPart, itIndex) => {
				const partInstance = this.getPartInstanceOrGetCachedTemp(partInstancesMap, origPart)

				if (partInstance.segmentId !== lastSegmentId) {
					this.untimedSegments.add(partInstance.segmentId)
					lastSegmentId = partInstance.segmentId
					segmentDisplayDuration = 0
					if (segmentBudgetDurationLeft > 0) {
						waitAccumulator += segmentBudgetDurationLeft
					}
					segmentBudgetDurationLeft = this.segmentBudgetDurations[unprotectString(partInstance.segmentId)]
				}

				// add piece to accumulator
				const aIndex = this.linearParts.push([partInstance.part._id, waitAccumulator]) - 1

				// if this is next segementLine, clear previous countdowns and clear accumulator
				if (playlist.nextPartInstanceId === partInstance._id) {
					nextAIndex = aIndex
					this.nextSegmentId = partInstance.segmentId
				} else if (playlist.currentPartInstanceId === partInstance._id) {
					currentAIndex = aIndex
					liveSegmentId = partInstance.segmentId
				}

				const partCounts =
					playlist.outOfOrderTiming ||
					!playlist.activationId ||
					(itIndex >= currentAIndex && currentAIndex >= 0) ||
					(itIndex >= nextAIndex && nextAIndex >= 0 && currentAIndex === -1)

				const lastStartedPlayback = partInstance.timings?.startedPlayback
				const segmentUsesBudget =
					this.segmentBudgetDurations[unprotectString(partInstance.segmentId)] !== undefined

				const partIsUntimed = partInstance.part.untimed || false

				if (!partIsUntimed) {
					this.untimedSegments.delete(partInstance.segmentId)
				}

				// expected is just a sum of expectedDurations
				if (!segmentUsesBudget && !partIsUntimed) {
					totalRundownDuration += partInstance.part.expectedDuration || 0
				}

				const playOffset = partInstance.timings?.playOffset || 0

				let partDuration = 0
				let partExpectedDuration = 0
				let partDisplayDuration = 0
				let partDisplayDurationNoPlayback = 0

				let displayDurationFromGroup = 0

				partExpectedDuration = partInstance.part.expectedDuration || partInstance.timings?.duration || 0

				// Display Duration groups are groups of two or more Parts, where some of them have an
				// expectedDuration and some have 0.
				// Then, some of them will have a displayDuration. The expectedDurations are pooled together, the parts with
				// display durations will take up that much time in the Rundown. The left-over time from the display duration group
				// will be used by Parts without expectedDurations.
				let memberOfDisplayDurationGroup = false
				// using a separate displayDurationGroup processing flag simplifies implementation
				if (
					partInstance.part.displayDurationGroup &&
					// either this is not the first element of the displayDurationGroup
					(this.displayDurationGroups[partInstance.part.displayDurationGroup] !== undefined ||
						// or there is a following member of this displayDurationGroup
						(parts[itIndex + 1] &&
							parts[itIndex + 1].displayDurationGroup === partInstance.part.displayDurationGroup)) &&
					!partInstance.part.floated &&
					!partIsUntimed
				) {
					this.displayDurationGroups[partInstance.part.displayDurationGroup] =
						(this.displayDurationGroups[partInstance.part.displayDurationGroup] || 0) +
						(partInstance.part.expectedDuration || 0)
					displayDurationFromGroup =
						partInstance.part.displayDuration ||
						Math.max(
							0,
							this.displayDurationGroups[partInstance.part.displayDurationGroup],
							partInstance.part.gap
								? MINIMAL_NONZERO_DURATION
								: defaultDuration || Settings.defaultDisplayDuration
						)
					partExpectedDuration =
						partExpectedDuration || this.displayDurationGroups[partInstance.part.displayDurationGroup] || 0
					memberOfDisplayDurationGroup = true
				}

				// This is where we actually calculate all the various variants of duration of a part
				if (lastStartedPlayback && !partInstance.timings?.duration) {
					// if duration isn't available, check if `takeOut` has already been set and use the difference
					// between startedPlayback and takeOut as a temporary duration
					const duration =
						partInstance.timings?.duration ||
						(partInstance.timings?.takeOut
							? lastStartedPlayback - partInstance.timings?.takeOut
							: undefined)
					currentRemaining = Math.max(
						0,
						(duration ||
							(memberOfDisplayDurationGroup
								? displayDurationFromGroup
								: partInstance.part.expectedDuration) ||
							0) -
							(now - lastStartedPlayback)
					)
					partDuration =
						Math.max(duration || partInstance.part.expectedDuration || 0, now - lastStartedPlayback) -
						playOffset
					// because displayDurationGroups have no actual timing on them, we need to have a copy of the
					// partDisplayDuration, but calculated as if it's not playing, so that the countdown can be
					// calculated
					partDisplayDurationNoPlayback =
						duration ||
						(memberOfDisplayDurationGroup
							? displayDurationFromGroup
							: partInstance.part.expectedDuration) ||
						defaultDuration ||
						Settings.defaultDisplayDuration
					partDisplayDuration = Math.max(partDisplayDurationNoPlayback, now - lastStartedPlayback)
					this.partPlayed[unprotectString(partInstance.part._id)] = now - lastStartedPlayback
					if (segmentUsesBudget) {
						currentRemaining = Math.max(
							0,
							this.segmentBudgetDurations[unprotectString(partInstance.segmentId)] -
								segmentDisplayDuration -
								(now - lastStartedPlayback)
						)
						segmentBudgetDurationLeft = 0
					} else {
						currentRemaining = Math.max(
							0,
							(partInstance.timings?.duration ||
								(memberOfDisplayDurationGroup
									? displayDurationFromGroup
									: partInstance.part.expectedDuration) ||
								0) -
								(now - lastStartedPlayback)
						)
					}
				} else {
					partDuration =
						(partInstance.timings?.duration || partInstance.part.expectedDuration || 0) - playOffset
					partDisplayDurationNoPlayback = Math.max(
						0,
						(partInstance.timings?.duration && partInstance.timings?.duration + playOffset) ||
							displayDurationFromGroup ||
							partInstance.part.expectedDuration ||
							defaultDuration ||
							Settings.defaultDisplayDuration
					)
					partDisplayDuration = partDisplayDurationNoPlayback
					this.partPlayed[unprotectString(partInstance.part._id)] =
						(partInstance.timings?.duration || 0) - playOffset
				}

				// asPlayed is the actual duration so far and expected durations in unplayed lines.
				// If item is onAir right now, it's duration is counted as expected duration or current
				// playback duration whichever is larger.
				// Parts that are Untimed are ignored always.
				// Parts that don't count are ignored, unless they are being played or have been played.
				if (!partIsUntimed) {
					if (!segmentUsesBudget) {
						let valToAddToAsPlayedDuration = 0

						if (lastStartedPlayback && !partInstance.timings?.duration) {
							valToAddToAsPlayedDuration = Math.max(partExpectedDuration, now - lastStartedPlayback)
						} else if (partInstance.timings?.duration) {
							valToAddToAsPlayedDuration = partInstance.timings.duration
						} else if (partCounts) {
							valToAddToAsPlayedDuration = partInstance.part.expectedDuration || 0
						}

						asPlayedRundownDuration += valToAddToAsPlayedDuration
						if (!rundownAsPlayedDurations[unprotectString(partInstance.part.rundownId)]) {
							rundownAsPlayedDurations[unprotectString(partInstance.part.rundownId)] =
								valToAddToAsPlayedDuration
						} else {
							rundownAsPlayedDurations[unprotectString(partInstance.part.rundownId)] +=
								valToAddToAsPlayedDuration
						}
					} else {
						let valToAddToAsPlayedDuration = 0
						if (partInstance.timings?.duration) {
							valToAddToAsPlayedDuration = partInstance.timings?.duration
						} else if (lastStartedPlayback && !partInstance.timings?.duration) {
							valToAddToAsPlayedDuration =
								Math.min(partInstance.timings?.takeOut || Number.POSITIVE_INFINITY, now) -
								lastStartedPlayback
						}
						this.segmentAsPlayedDurations[unprotectString(partInstance.segmentId)] =
							(this.segmentAsPlayedDurations[unprotectString(partInstance.segmentId)] || 0) +
							valToAddToAsPlayedDuration
					}
				}

				// asDisplayed is the actual duration so far and expected durations in unplayed lines
				// If item is onAir right now, it's duration is counted as expected duration or current
				// playback duration whichever is larger.
				// All parts are counted.
				if (lastStartedPlayback && !partInstance.timings?.duration) {
					asDisplayedRundownDuration += Math.max(
						memberOfDisplayDurationGroup
							? Math.max(partExpectedDuration, partInstance.part.expectedDuration || 0)
							: partInstance.part.expectedDuration || 0,
						now - lastStartedPlayback
					)
				} else {
					asDisplayedRundownDuration +=
						partInstance.timings?.duration || partInstance.part.expectedDuration || 0
				}

				// the part is the current part but has not yet started playback
				if (playlist.currentPartInstanceId === partInstance._id && !lastStartedPlayback) {
					currentRemaining = partDisplayDuration
				}

				// Handle invalid parts by overriding the values to preset values for Invalid parts
				if (partInstance.part.invalid && !partInstance.part.gap) {
					partDisplayDuration = defaultDuration || Settings.defaultDisplayDuration
					this.partPlayed[unprotectString(partInstance.part._id)] = 0
				}

				if (
					memberOfDisplayDurationGroup &&
					partInstance.part.displayDurationGroup &&
					!partInstance.part.floated &&
					!partInstance.part.invalid &&
					!partIsUntimed &&
					(partInstance.timings?.duration || partInstance.timings?.takeOut || partCounts)
				) {
					this.displayDurationGroups[partInstance.part.displayDurationGroup] =
						this.displayDurationGroups[partInstance.part.displayDurationGroup] - partDisplayDuration
				}

				// specially handle the previous part as it is being taken out
				if (playlist.previousPartInstanceId === partInstance._id) {
					if (this.previousPartInstanceId !== playlist.previousPartInstanceId) {
						// it is possible that this.previousPartInstanceId !== playlist.previousPartInstanceId, because
						// this is in fact the first iteration. If that's the case, it's more than likely that the
						// previous part has already good "lastTake" information that we can use, either in "takeOut",
						// if the part was taken out manually, or stoppedPlayback, if there was no User Action.
						// Finally, if both of those are undefined, we use "now", since what has happened
						// is that user has taken out this part, but we're still waiting for timing and "now"
						// is the best approximation of the take time we have.
						this.lastTakeAt = partInstance.timings?.takeOut || partInstance.timings?.stoppedPlayback || now
						this.previousPartInstanceId = playlist.previousPartInstanceId
					}
					// a simulated display duration, created using the "lastTakeAt" value
					const virtualDuration =
						this.lastTakeAt && lastStartedPlayback
							? this.lastTakeAt - lastStartedPlayback
							: partDisplayDuration
					partDisplayDuration = virtualDuration
				}

				const partInstancePartId = unprotectString(partInstance.part._id)
				this.partExpectedDurations[partInstancePartId] = partExpectedDuration
				this.partStartsAt[partInstancePartId] = startsAtAccumulator
				this.partDisplayStartsAt[partInstancePartId] = displayStartsAtAccumulator
				this.partDurations[partInstancePartId] = partDuration
				this.partDisplayDurations[partInstancePartId] = partDisplayDuration
				this.partDisplayDurationsNoPlayback[partInstancePartId] = partDisplayDurationNoPlayback
				startsAtAccumulator += this.partDurations[partInstancePartId]
				displayStartsAtAccumulator += this.partDisplayDurations[partInstancePartId]

				// waitAccumulator is used to calculate the countdowns for Parts relative to the current Part
				// always add the full duration, in case by some manual intervention this segment should play twice
				let waitDuration = 0
				if (memberOfDisplayDurationGroup) {
					waitDuration =
						partInstance.timings?.duration || partDisplayDuration || partInstance.part.expectedDuration || 0
				} else {
					waitDuration = partInstance.timings?.duration || partInstance.part.expectedDuration || 0
				}
				if (segmentUsesBudget) {
					waitAccumulator += Math.min(waitDuration, Math.max(segmentBudgetDurationLeft, 0))
					segmentBudgetDurationLeft -= waitDuration
				} else {
					waitAccumulator += waitDuration
				}

				// remaining is the sum of unplayed lines + whatever is left of the current segment
				// if outOfOrderTiming is true, count parts before current part towards remaining rundown duration
				// if false (default), past unplayed parts will not count towards remaining time
				if (!segmentUsesBudget) {
					if (!lastStartedPlayback && !partInstance.part.floated && partCounts && !partIsUntimed) {
						remainingRundownDuration += partExpectedDuration || 0
						// item is onAir right now, and it's is currently shorter than expectedDuration
					} else if (
						lastStartedPlayback &&
						!partInstance.timings?.duration &&
						playlist.currentPartInstanceId === partInstance._id &&
						lastStartedPlayback + partExpectedDuration > now &&
						!partIsUntimed
					) {
						remainingRundownDuration += partExpectedDuration - (now - lastStartedPlayback)
					}
				}

				if (!rundownExpectedDurations[unprotectString(partInstance.part.rundownId)]) {
					rundownExpectedDurations[unprotectString(partInstance.part.rundownId)] = partExpectedDuration
				} else {
					rundownExpectedDurations[unprotectString(partInstance.part.rundownId)] += partExpectedDuration
				}
			})

			// This is where the waitAccumulator-generated data in the linearSegLines is used to calculate the countdowns.
			let localAccum = 0
			for (let i = 0; i < this.linearParts.length; i++) {
				if (i < nextAIndex) {
					// this is a line before next line
					localAccum = this.linearParts[i][1] || 0
					// only null the values if not looping, if looping, these will be offset by the countdown for the last part
					if (!playlist.loop) {
						this.linearParts[i][1] = null // we use null to express 'will not probably be played out, if played in order'
					}
				} else if (i === nextAIndex) {
					// this is a calculation for the next line, which is basically how much there is left of the current line
					localAccum = this.linearParts[i][1] || 0 // if there is no current line, rebase following lines to the next line
					this.linearParts[i][1] = currentRemaining
				} else {
					// these are lines after next line
					// we take whatever value this line has, subtract the value as set on the Next Part
					// (note that the Next Part value will be using currentRemaining as the countdown)
					// and add the currentRemaining countdown, since we are currentRemaining + diff between next and
					// this away from this line.
					this.linearParts[i][1] = (this.linearParts[i][1] || 0) - localAccum + currentRemaining
				}
			}
			// contiunation of linearParts calculations for looping playlists
			if (playlist.loop) {
				for (let i = 0; i < nextAIndex; i++) {
					// offset the parts before the on air line by the countdown for the end of the rundown
					this.linearParts[i][1] =
						(this.linearParts[i][1] || 0) + waitAccumulator - localAccum + currentRemaining
				}
			}

			let nextSegmentIndex = -1
			segments.forEach((segment, itIndex) => {
				if (segment._id === this.nextSegmentId) {
					nextSegmentIndex = itIndex
				}
				const segmentBudgetDuration = this.segmentBudgetDurations[unprotectString(segment._id)]

				if (segmentBudgetDuration === undefined || this.untimedSegments.has(segment._id)) return

				totalRundownDuration += segmentBudgetDuration

				let valToAddToRundownAsPlayedDuration = 0
				let valToAddToRundownRemainingDuration = 0
				if (segment._id === liveSegmentId) {
					const startedPlayback = this.segmentStartedPlayback[unprotectString(segment._id)]
					valToAddToRundownRemainingDuration = Math.max(
						0,
						segmentBudgetDuration - (startedPlayback ? now - startedPlayback : 0)
					)
					valToAddToRundownAsPlayedDuration = Math.max(
						startedPlayback ? now - startedPlayback : 0,
						segmentBudgetDuration
					)
				} else if (!playlist.activationId || (nextSegmentIndex >= 0 && itIndex >= nextSegmentIndex)) {
					valToAddToRundownAsPlayedDuration = segmentBudgetDuration
					valToAddToRundownRemainingDuration = segmentBudgetDuration
				} else {
					valToAddToRundownAsPlayedDuration = this.segmentAsPlayedDurations[unprotectString(segment._id)] || 0
				}
				remainingRundownDuration += valToAddToRundownRemainingDuration
				asPlayedRundownDuration += valToAddToRundownAsPlayedDuration
				rundownAsPlayedDurations[unprotectString(segment.rundownId)] =
					(rundownAsPlayedDurations[unprotectString(segment.rundownId)] ?? 0) +
					valToAddToRundownAsPlayedDuration
			})

			// if (this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0) {
			// 	const c = document.getElementById('debug-console')
			// 	if (c) c.innerHTML = debugConsole.replace(/\n/g, '<br>')
			// }
		}

		let remainingTimeOnCurrentPart: number | undefined = undefined
		let currentPartWillAutoNext = false
		if (currentAIndex >= 0) {
			const currentLivePart = parts[currentAIndex]
			const currentLivePartInstance = findPartInstanceInMapOrWrapToTemporary(partInstancesMap, currentLivePart)

			const lastStartedPlayback = currentLivePartInstance.timings?.startedPlayback

			let onAirPartDuration = currentLivePartInstance.timings?.duration || currentLivePart.expectedDuration || 0
			if (currentLivePart.displayDurationGroup) {
				onAirPartDuration =
					this.partExpectedDurations[unprotectString(currentLivePart._id)] || onAirPartDuration
			}

			remainingTimeOnCurrentPart = lastStartedPlayback
				? now - (lastStartedPlayback + onAirPartDuration)
				: onAirPartDuration * -1

			currentPartWillAutoNext = !!(
				currentLivePart.autoNext &&
				(currentLivePart.expectedDuration !== undefined ? currentLivePart.expectedDuration !== 0 : false)
			)
		}

		return literal<RundownTimingContext>({
			totalPlaylistDuration: totalRundownDuration,
			remainingPlaylistDuration: remainingRundownDuration,
			asDisplayedPlaylistDuration: asDisplayedRundownDuration,
			asPlayedPlaylistDuration: asPlayedRundownDuration,
			rundownExpectedDurations,
			rundownAsPlayedDurations,
			partCountdown: _.object(this.linearParts),
			partDurations: this.partDurations,
			partPlayed: this.partPlayed,
			partStartsAt: this.partStartsAt,
			partDisplayStartsAt: this.partDisplayStartsAt,
			partExpectedDurations: this.partExpectedDurations,
			partDisplayDurations: this.partDisplayDurations,
			segmentBudgetDurations: this.segmentBudgetDurations,
			segmentStartedPlayback: this.segmentStartedPlayback,
			currentTime: now,
			remainingTimeOnCurrentPart,
			currentPartWillAutoNext,
			rundownsBeforeNextBreak,
			breakIsLastRundown,
			isLowResolution,
		})
	}

	clearTempPartInstances() {
		this.temporaryPartInstances.clear()
	}

	private getPartInstanceOrGetCachedTemp(partInstancesMap: Map<PartId, PartInstance>, part: Part): PartInstance {
		const origPartId = part._id
		const partInstance = partInstancesMap.get(origPartId)
		if (partInstance !== undefined) {
			return partInstance
		} else {
			let tempPartInstance = this.temporaryPartInstances.get(origPartId)
			if (tempPartInstance !== undefined) {
				return tempPartInstance
			} else {
				tempPartInstance = wrapPartToTemporaryInstance(protectString(''), part)
				this.temporaryPartInstances.set(origPartId, tempPartInstance)
				return tempPartInstance
			}
		}
	}

	private getRundownsBeforeNextBreak(
		orderedRundowns: Rundown[],
		currentRundown: Rundown | undefined,
		playlist: RundownPlaylist
	): BreakProps | undefined {
		const currentState = orderedRundowns.map((r) => ({
			expectedEnd: PlaylistTiming.getExpectedEnd(r.timing),
			endOfRundownIsShowBreak: r.endOfRundownIsShowBreak,
			currentPartInstanceId: playlist.currentPartInstanceId,
			nextPartInstanceId: playlist.nextPartInstanceId,
		}))
		if (!_.isEqual(this.breakProps.state, currentState)) {
			this.recalculateBreaks(orderedRundowns, currentRundown)
		}

		this.breakProps.state = currentState
		return this.breakProps.props
	}

	private recalculateBreaks(orderedRundowns: Rundown[], currentRundown: Rundown | undefined) {
		if (!currentRundown) {
			this.breakProps.props = undefined
			return
		}

		const currentRundownIndex = orderedRundowns.findIndex((r) => r._id === currentRundown._id)

		if (currentRundownIndex === -1) {
			this.breakProps.props = undefined
			return
		}

		const nextBreakIndex = orderedRundowns.findIndex((rundown, index) => {
			if (index < currentRundownIndex) {
				return false
			}

			return rundown.endOfRundownIsShowBreak === true
		})

		this.breakProps.props = {
			rundownsBeforeNextBreak: orderedRundowns.slice(currentRundownIndex, nextBreakIndex + 1),
			breakIsLastRundown: nextBreakIndex === orderedRundowns.length - 1,
		}
	}
}

export interface RundownTimingContext {
	/** This is the total duration of the playlist as planned (using expectedDurations and/or budgetDurations). */
	totalPlaylistDuration?: number
	/** This is the content remaining to be played in the playlist (based on the expectedDurations).  */
	remainingPlaylistDuration?: number
	/** This is the total duration of the playlist: as planned for the unplayed (skipped & future) content, and as-run for the played-out. */
	asDisplayedPlaylistDuration?: number
	/** This is the complete duration of the playlist: as planned for the unplayed content, and as-run for the played-out, but ignoring unplayed/unplayable parts in order */
	asPlayedPlaylistDuration?: number
	/** Expected duration of each rundown in playlist (based on part expected durations) */
	rundownExpectedDurations?: Record<string, number>
	/** This is the complete duration of each rundown: as planned for the unplayed content, and as-run for the played-out, but ignoring unplayed/unplayable parts in order */
	rundownAsPlayedDurations?: Record<string, number>
	/** this is the countdown to each of the parts relative to the current on air part. */
	partCountdown?: Record<string, number>
	/** The calculated durations of each of the Parts: as-planned/as-run depending on state. */
	partDurations?: Record<string, number>
	/** The offset of each of the Parts from the beginning of the Playlist. */
	partStartsAt?: Record<string, number>
	/** Same as partStartsAt, but will include display duration overrides
	 *  (such as minimal display width for an Part, etc.).
	 */
	partDisplayStartsAt?: Record<string, number>
	/** Same as partDurations, but will include display duration overrides
	 * (such as minimal display width for an Part, etc.).
	 */
	partDisplayDurations?: Record<string, number>
	/** As-played durations of each part. Will be 0, if not yet played.
	 * Will be counted from start to now if currently playing.
	 */
	partPlayed?: Record<string, number>
	/** Expected durations of each of the parts or the as-played duration,
	 * if the Part does not have an expected duration.
	 */
	partExpectedDurations?: Record<string, number>
	/** Budget durations of segments (sum of parts budget durations). */
	segmentBudgetDurations?: Record<string, number>
	/** Time when selected segments started playback. Contains only the current segment and the segment before, if we've just entered a new one */
	segmentStartedPlayback?: Record<string, number>
	/** Remaining time on current part */
	remainingTimeOnCurrentPart?: number
	/** Current part will autoNext */
	currentPartWillAutoNext?: boolean
	/** Current time of this calculation */
	currentTime?: number
	/** Rundowns between current rundown and rundown with next break (inclusive of both). Undefined if there's no break in the future. */
	rundownsBeforeNextBreak?: Rundown[]
	/** Whether the next break is also the last */
	breakIsLastRundown?: boolean
	/** Was this time context calculated during a high-resolution tick */
	isLowResolution: boolean
}

/**
 * Computes the actual (as-played fallbacking to expected) duration of a segment, consisting of given parts
 * @export
 * @param  {RundownTimingContext} timingDurations The timing durations calculated for the Rundown
 * @param  {Array<string>} partIds The IDs of parts that are members of the segment
 * @return number
 */
export function computeSegmentDuration(
	timingDurations: RundownTimingContext,
	partIds: PartId[],
	display?: boolean
): number {
	const partDurations = timingDurations.partDurations

	if (partDurations === undefined) return 0

	return partIds.reduce((memo, partId) => {
		const pId = unprotectString(partId)
		let partDuration: number = 0
		if (partDurations && partDurations[pId] !== undefined) {
			partDuration = partDurations[pId]
		}
		if (!partDuration && display) {
			partDuration = Settings.defaultDisplayDuration
		}
		return memo + partDuration
	}, 0)
}

export namespace PlaylistTiming {
	export function isPlaylistTimingNone(timing: RundownPlaylistTiming): timing is PlaylistTimingNone {
		return timing.type === PlaylistTimingType.None
	}

	export function isPlaylistTimingForwardTime(timing: RundownPlaylistTiming): timing is PlaylistTimingForwardTime {
		return timing.type === PlaylistTimingType.ForwardTime
	}

	export function isPlaylistTimingBackTime(timing: RundownPlaylistTiming): timing is PlaylistTimingBackTime {
		return timing.type === PlaylistTimingType.BackTime
	}

	export function getExpectedStart(timing: RundownPlaylistTiming): number | undefined {
		return PlaylistTiming.isPlaylistTimingForwardTime(timing)
			? timing.expectedStart
			: PlaylistTiming.isPlaylistTimingBackTime(timing)
			? // Use expectedStart if present, otherwise try to calculate from expectedEnd - expectedDuration
			  timing.expectedStart ||
			  (timing.expectedDuration ? timing.expectedEnd - timing.expectedDuration : undefined)
			: undefined
	}

	export function getExpectedEnd(timing: RundownPlaylistTiming): number | undefined {
		return PlaylistTiming.isPlaylistTimingBackTime(timing)
			? timing.expectedEnd
			: PlaylistTiming.isPlaylistTimingForwardTime(timing)
			? timing.expectedEnd ||
			  (timing.expectedDuration ? timing.expectedStart + timing.expectedDuration : undefined)
			: undefined
	}

	export function getExpectedDuration(timing: RundownPlaylistTiming): number | undefined {
		return PlaylistTiming.isPlaylistTimingForwardTime(timing)
			? timing.expectedDuration
			: PlaylistTiming.isPlaylistTimingBackTime(timing)
			? timing.expectedDuration
			: undefined
	}

	export function sortTiminings(a, b): number {
		// Compare start times, then allow rundowns with start time to be first
		if (
			PlaylistTiming.isPlaylistTimingForwardTime(a.timing) &&
			PlaylistTiming.isPlaylistTimingForwardTime(b.timing)
		)
			return a.timing.expectedStart - b.timing.expectedStart
		if (PlaylistTiming.isPlaylistTimingForwardTime(a.timing)) return -1
		if (PlaylistTiming.isPlaylistTimingForwardTime(b.timing)) return 1

		// Compare end times, then allow rundowns with end time to be first
		if (PlaylistTiming.isPlaylistTimingBackTime(a.timing) && PlaylistTiming.isPlaylistTimingBackTime(b.timing))
			return a.timing.expectedEnd - b.timing.expectedEnd
		if (PlaylistTiming.isPlaylistTimingBackTime(a.timing)) return -1
		if (PlaylistTiming.isPlaylistTimingBackTime(b.timing)) return 1

		// No timing
		return 0
	}
}
