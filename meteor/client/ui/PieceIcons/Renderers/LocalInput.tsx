import React from 'react'
import { BaseRemoteInputIcon } from './RemoteInput'

export default function LocalInputIcon(props: { inputIndex?: string; abbreviation?: string }) {
	return <BaseRemoteInputIcon className="local">{props.abbreviation ? props.abbreviation : 'EVS'}</BaseRemoteInputIcon>
}
