import { RundownTimingContext } from '../../../lib/rundownTiming'
import { WithTiming, withTiming } from './withTiming'

interface IProps {
	filter?: (timingDurations: RundownTimingContext) => any
	children?: (timingDurations: RundownTimingContext) => JSX.Element | null
}

export const RundownTimingConsumer = withTiming<IProps, {}>((props) => ({
	filter: props.filter,
}))(({ timingDurations, children }: WithTiming<IProps>) => {
	return children ? children(timingDurations) : null
})
