import React from 'react'
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
