import * as React from 'react'
import * as _ from 'underscore'

export function makeTableOfObject (o: any) {
	return (
		<table><tbody>
			{_.map(o, (val, key) => {
				return (
					<tr key={key}>
						<td>{key}</td>
						<td>{(
							_.isObject(val) ? makeTableOfObject(val) : val
						)}</td>
					</tr>
				)
			})}
		</tbody></table>
	)
}
