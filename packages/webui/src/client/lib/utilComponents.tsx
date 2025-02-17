import * as React from 'react'
import _ from 'underscore'
// @ts-expect-error No types available
import * as VelocityReact from 'velocity-react'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function makeTableOfObject(o: any): React.ReactNode {
	if (typeof o === 'string') {
		return o
	}

	return (
		<table>
			<tbody>
				{Object.keys(o).map((key) => {
					const val = o[key]

					let content: any = null
					if (_.isObject(val)) {
						content = makeTableOfObject(val)
					} else {
						content = val
						if (_.isString(val)) {
							let json = ''
							try {
								json = JSON.parse(val)
							} catch (e) {
								// ignore
							}
							if (json) {
								content = <pre>{JSON.stringify(json, undefined, ' ')}</pre>
							}
						}
					}
					return (
						<tr key={key}>
							<td>{key}</td>
							<td>{content}</td>
						</tr>
					)
				})}
			</tbody>
		</table>
	)
}

interface OptionalVelocityComponentProps {
	shouldAnimate: boolean
	animation: Record<string, any>
	duration: number
}
export function OptionalVelocityComponent(props: React.PropsWithChildren<OptionalVelocityComponentProps>): JSX.Element {
	return props.shouldAnimate ? (
		<VelocityReact.VelocityComponent animation={props.animation} duration={props.duration}>
			{props.children}
		</VelocityReact.VelocityComponent>
	) : (
		<>{props.children}</>
	)
}
