import * as React from 'react'
import * as _ from 'underscore'
import * as VelocityReact from 'velocity-react'

export function makeTableOfObject(o: any) {
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
								// @ts-ignore
								content = <pre>{JSON.stringify(json, '', ' ')}</pre>
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

export function OptionalVelocityComponent(props: any) {
	return props.shouldAnimate ? (
		<VelocityReact.VelocityComponent animation={props.animation} duration={props.duration}>
			{props.children}
		</VelocityReact.VelocityComponent>
	) : (
		<>{props.children}</>
	)
}
