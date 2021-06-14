import { RundownTimingContext } from '../../../../lib/rundown/rundownTiming'

export interface TimeEventArgs {
	currentTime: number
}

export type TimingEvent = CustomEvent<TimeEventArgs>

declare global {
	interface WindowEventMap {
		[RundownTiming.Events.timeupdate]: TimingEvent
		[RundownTiming.Events.timeupdateHR]: TimingEvent
	}
}

export namespace RundownTiming {
	/**
	 * Events used by the RundownTimingProvider
	 * @export
	 * @enum {number}
	 */
	export enum Events {
		/** Event is emitted every now-and-then, generally to be used for simple displays */
		'timeupdate' = 'sofie:rundownTimeUpdate',
		/** event is emitted with a very high frequency (60 Hz), to be used sparingly as
		 * hooking up Components to it will cause a lot of renders
		 */
		'timeupdateHR' = 'sofie:rundownTimeUpdateHR',
	}

	/**
	 * This are the properties that will be injected by the withTiming HOC.
	 * @export
	 * @interface InjectedROTimingProps
	 */
	export interface InjectedROTimingProps {
		timingDurations: RundownTimingContext
	}
}
