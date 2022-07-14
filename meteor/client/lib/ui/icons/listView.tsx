import React from 'react'

export function ListView(props: React.SVGProps<SVGSVGElement>) {
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
			<path d="M9 0H0V2H9V0Z" fill="#BBBBBB" />
			<path d="M14 3H0V5H14V3Z" fill="#BBBBBB" />
			<path d="M14 6H0V8H14V6Z" fill="#BBBBBB" />
		</svg>
	)
}
