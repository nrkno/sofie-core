import React from 'react'
import { TFunction } from 'i18next'
import { JonasFormattedTimeInner } from './JonasFormattedTimeInner'

interface IJonasFormattedTimeProps {
	t: TFunction
	/** Timestamp to display */
	displayTimestamp: number
	/** Timestamp of "now", if omitted, defaults to "now" */
	nowTimestamp?: number
}

export function JonasFormattedTime(props: IJonasFormattedTimeProps) {
	return <span>{JonasFormattedTimeInner(props.t, props.displayTimestamp, props.nowTimestamp)}</span>
}
