import React, { useCallback, useRef, useState } from 'react'
import { IEditAttribute } from '../EditAttribute'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useHistory } from 'react-router-dom'

export const defaultEditAttributeProps: Partial<IEditAttribute> = {
	modifiedClassName: 'bghl',
	className: 'mdinput',
}

export const RedirectToShowStyleButton = React.memo(function RedirectToShowStyleButton(props: {
	id: ShowStyleBaseId
	name: string
}) {
	const history = useHistory()

	const doRedirect = () => history.push('/settings/showStyleBase/' + props.id)

	return (
		<button className="btn btn-primary btn-add-new" onClick={doRedirect}>
			Edit {props.name}
		</button>
	)
})

/**
 * Like useState, except the state returns to undefined after one render
 */
export function useTrigger<T>(initialValue: T): [T | undefined, (triggerValue: T) => void] {
	const [v, setV] = useState<T | undefined>(initialValue)

	const isTriggered = useRef(false)

	const trigger = useCallback((triggerValue) => {
		isTriggered.current = true
		setV(triggerValue)
	}, [])

	if (isTriggered.current) {
		setTimeout(() => {
			isTriggered.current = false
			setV(undefined)
		}, 0)
	}

	return [v, trigger]
}
