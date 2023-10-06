import React from 'react'

export function LinePartIdentifier({ identifier }: { identifier: string }): JSX.Element {
	return (
		<div className="segment-opl__identifier-area">
			<div className="segment-opl__identifier">{identifier}</div>
		</div>
	)
}
