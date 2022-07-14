import React from 'react'

export function TimelineView(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 8"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="presentation"
			{...props}
		>
			<path d="M4 0H0V2H4V0Z" fill="#BBBBBB" />
			<path d="M4 3H0V5H4V3Z" fill="#BBBBBB" />
			<path d="M14 3H6V5H14V3Z" fill="#BBBBBB" />
			<path d="M4 6H0V8H4V6Z" fill="#BBBBBB" />
			<path d="M14 6H6V8H14V6Z" fill="#BBBBBB" />
			<path d="M14 0H6V2H14V0Z" fill="#BBBBBB" />
		</svg>

	)
}
