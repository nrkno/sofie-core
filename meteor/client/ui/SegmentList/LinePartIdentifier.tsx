import React from 'react'

export function LinePartIdentifier({ identifier }: { identifier: string }) {
	return (
		<div className="segment-opl__identifier-area">
			<div className="segment-opl__identifier">{identifier}</div>
		</div>
	)
}
