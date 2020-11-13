import React from 'react'
import { TFunction } from 'i18next'
import moment from 'moment'
import { getCurrentTime } from '../../../lib/lib'
import { time } from 'console'

const yesterday = moment().subtract(1, 'days')
const lastWeek = moment().subtract(6, 'days')
const tomorrow = moment().add(1, 'days')
const nextWeek = moment().add(6, 'days')

interface IJonasFormattedTimeProps {
	t: TFunction
	timestamp: number
}

export default function JonasFormattedTime(props: IJonasFormattedTimeProps) {
	const { timestamp, t } = props
	// const { t } = props

	// const timestamp = yesterday.toDate().valueOf()

	const now = moment(getCurrentTime()) // use synced time instead of client time

	// Overrides to be able to display calendar based string with Moment without
	// time of day. This is horrible, and hopefully will be replaced with something
	// smoother when we replace Moment
	// const momentCalendarOptions = {
	// 	sameDay: `[${t('Today')}] HH:mm:ss`,
	// 	nextDay: `[${t('Tomorrow')}] HH:mm:ss`,
	// 	nextWeek: 'dddd HH:mm:ss',
	// 	lastDay: `[${t('Yesterday')}] HH:mm:ss`,
	// 	lastWeek: `[${t('Last')}] dddd HH:mm:ss`,
	// 	sameElse: 'DD/MM/YYYY'
	// }
	const momentCalendarOptions = Object.assign(
		{},
		{
			lastDay: `[${t('Yesterday')}] HH:mm:ss`,
			nextDay: `[${t('Tomorrow')}] HH:mm:ss`,
		}
	)

	const diff = now.diff(timestamp, 'days')

	console.debug('diff', diff)
	let formattedDateString: string
	if (Math.abs(diff) < 6) {
		formattedDateString = moment(timestamp).calendar(now, momentCalendarOptions)
	} else if (now.isBefore(timestamp)) {
		formattedDateString = now.from(timestamp)
	} else {
		formattedDateString = now.to(timestamp)
	}

	return <span>{formattedDateString}</span>
}
