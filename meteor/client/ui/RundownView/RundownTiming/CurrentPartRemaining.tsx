import * as React from 'react'
import ClassNames from 'classnames'
import { TimingDataResolution, TimingTickResolution, withTiming, WithTiming } from './withTiming'
import { RundownUtils } from '../../../lib/rundown'
import { PartInstanceId } from '../../../../lib/collections/PartInstances'
import { SpeechSynthesiser } from '../../../lib/speechSynthesis'

const SPEAK_ADVANCE = 500

interface IPartRemainingProps {
	currentPartInstanceId: PartInstanceId | null
	hideOnZero?: boolean
	className?: string
	heavyClassName?: string
	speaking?: boolean
}

// global variable for remembering last uttered displayTime
let prevDisplayTime: number | undefined = undefined

/**
 * A presentational component that will render a countdown to the end of the current part
 * @class CurrentPartRemaining
 * @extends React.Component<WithTiming<{}>>
 */
export const CurrentPartRemaining = withTiming<IPartRemainingProps, {}>({
	// TODOSYNC: TV2 uses TimingTickResolution.Synced for these
	tickResolution: TimingTickResolution.High,
	dataResolution: TimingDataResolution.High,
})(
	class CurrentPartRemaining extends React.Component<WithTiming<IPartRemainingProps>> {
		render() {
			const displayTimecode = this.props.timingDurations.remainingTimeOnCurrentPart
			return (
				<span
					className={ClassNames(
						this.props.className,
						Math.floor((displayTimecode || 0) / 1000) > 0 ? this.props.heavyClassName : undefined
					)}
					role="timer"
				>
					{RundownUtils.formatDiffToTimecode(displayTimecode || 0, true, false, true, false, true, '', false, true)}
				</span>
			)
		}

		speak(displayTime: number) {
			let text = '' // Say nothing

			switch (displayTime) {
				case -1:
					text = 'One'
					break
				case -2:
					text = 'Two'
					break
				case -3:
					text = 'Three'
					break
				case -4:
					text = 'Four'
					break
				case -5:
					text = 'Five'
					break
				case -6:
					text = 'Six'
					break
				case -7:
					text = 'Seven'
					break
				case -8:
					text = 'Eight'
					break
				case -9:
					text = 'Nine'
					break
				case -10:
					text = 'Ten'
					break
			}
			// if (displayTime === 0 && prevDisplayTime !== undefined) {
			// 	text = 'Zero'
			// }

			if (text) {
				SpeechSynthesiser.speak(text, 'countdown')
			}
		}

		vibrate(displayTime: number) {
			if ('vibrate' in navigator) {
				switch (displayTime) {
					case 0:
						navigator.vibrate([500])
						break
					case -1:
					case -2:
					case -3:
						navigator.vibrate([250])
						break
				}
			}
		}

		act() {
			// Note that the displayTime is negative when counting down to 0.
			let displayTime = this.props.timingDurations.remainingTimeOnCurrentPart || 0

			if (displayTime === 0) {
				// do nothing
			} else {
				displayTime += SPEAK_ADVANCE
				displayTime = Math.floor(displayTime / 1000)
			}

			if (prevDisplayTime !== displayTime) {
				if (this.props.speaking) {
					this.speak(displayTime)
				}

				this.vibrate(displayTime)

				prevDisplayTime = displayTime
			}
		}

		componentDidUpdate(prevProps: WithTiming<IPartRemainingProps>) {
			if (this.props.currentPartInstanceId !== prevProps.currentPartInstanceId) {
				prevDisplayTime = undefined
			}
			this.act()
		}
	}
)
