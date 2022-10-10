import React from 'react'
import { RundownTimingConsumer } from '../../RundownView/RundownTiming/RundownTimingConsumer'
import { TimingDataResolution, TimingTickResolution } from '../../RundownView/RundownTiming/withTiming'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export const LiveLineIsPast = React.memo(function LiveLineIsPast({
	partId,
	time,
	children,
}: {
	partId: PartId
	time: number
	children?: (isPast: boolean) => JSX.Element | null
}) {
	return (
		<RundownTimingConsumer
			dataResolution={TimingDataResolution.High}
			tickResolution={TimingTickResolution.High}
			filter={(data) => data.partPlayed?.[unprotectString(partId)]}
		>
			{(timingContext) => {
				const livePosition = timingContext.partPlayed?.[unprotectString(partId)] ?? 0

				return children ? children(livePosition > time) : null
			}}
		</RundownTimingConsumer>
	)
})
