import { BaseRemoteInputIcon } from './RemoteInputIcon.js'

export default function LocalInputIcon(props: Readonly<{ inputIndex?: string; abbreviation?: string }>): JSX.Element {
	return (
		<BaseRemoteInputIcon className="local">
			{props.abbreviation !== undefined ? props.abbreviation : 'EVS'}
			<tspan>{props.inputIndex ?? ''}</tspan>
		</BaseRemoteInputIcon>
	)
}
