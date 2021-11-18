import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { withTiming, WithTiming } from './withTiming'
import Moment from 'react-moment'

export const TimeOfDay = withTranslation()(
	withTiming<WithTranslation, {}>()(function RundownName(props: Translated<WithTiming<{}>>) {
		return (
			<span className="timing-clock time-now">
				<Moment interval={0} format="HH:mm:ss" date={props.timingDurations.currentTime || 0} />
			</span>
		)
	})
)
