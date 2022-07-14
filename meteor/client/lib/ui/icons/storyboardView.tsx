import React from 'react'

export function StoryboardView(props: React.SVGProps<SVGSVGElement>) {
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
		<rect y="0" width="27" height="27" rx="3" fill="#00000000" className="btn-bkg" />
		<rect width="9" height="5" rx="2" fill="#BBBBBB" />
		<rect y="6" width="9" height="2" rx="1" fill="#BBBBBB" />
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M9.5 5.0667H11.2135C12.3181 5.0667 13.2135 4.1712 13.2135 3.0667V2C13.2135 0.89543 12.3181 0 11.2135 0H9.5796C9.9948 0.36647 10.2567 0.90265 10.2567 1.5V3.5C10.2567 4.1347 9.9611 4.7003 9.5 5.0667Z"
			fill="#8B8B8B"
		/>
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M9 8H12C12.5523 8 13 7.55228 13 7C13 6.44772 12.5523 6 12 6H9C9.55229 6 10 6.44772 10 7C10 7.55228 9.55228 8 9 8Z"
			fill="#8B8B8B"
		/>
	</svg>
	)
}
