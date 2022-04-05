import React from 'react'

export const RightArrow = (props: React.SVGProps<SVGSVGElement>) => (
	<svg width="6" height="13" viewBox="0 0 6 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M1.25 2.14003L5.31629 6.5L1.25 10.86L1.25 2.14003Z" fill="black" stroke="white" />
	</svg>
)

export const CenterHandle = (props: React.SVGProps<SVGSVGElement>) => (
	<svg width="9" height="13" viewBox="0 0 9 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<line x1="8.5" x2="8.5" y2="13" stroke="black" />
		<line x1="4.5" x2="4.5" y2="13" stroke="black" />
		<line x1="0.5" x2="0.5" y2="13" stroke="black" />
	</svg>
)

export const LeftArrow = (props: React.SVGProps<SVGSVGElement>) => (
	<svg width="6" height="13" viewBox="0 0 6 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M4.75 10.86L0.683707 6.5L4.75 2.14003L4.75 10.86Z" fill="black" stroke="white" />
	</svg>
)

export const SegmentEnd = (props: React.SVGProps<SVGSVGElement>) => (
	<svg width="24" height="22" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path
			d="M15.5 1H21C22.1046 1 23 1.89543 23 3V10.9104C23 12.015 22.1046 12.9104 21 12.9104H2M2 12.9104L9.5 5.41045M2 12.9104L9.5 20.4104"
			stroke="white"
			strokeWidth="2"
		/>
	</svg>
)

export const SmallPartFlag = (props: React.SVGProps<SVGSVGElement>) => (
	<svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path
			d="M16 1L8.02307 1C6.9185 1 6.02307 1.89543 6.02307 3L6.02307 15M6.02307 15L11.0461 10M6.02307 15L1 10"
			stroke="white"
			strokeWidth="2"
		/>
	</svg>
)

export const Storyboard = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		width="27"
		height="27"
		viewBox="0 0 27 27"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		role="presentation"
		{...props}
	>
		<rect y="0" width="27" height="27" rx="3" fill="#00000000" className="btn-bkg" />
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M19.5 18.0667H21.2135C22.3181 18.0667 23.2135 17.1712 23.2135 16.0667V11C23.2135 9.89543 22.3181 9 21.2135 9H19.5796C19.9948 9.36647 20.2567 9.90265 20.2567 10.5V16.5C20.2567 17.1347 19.9611 17.7003 19.5 18.0667Z"
			fill="#A0A0A0"
			opacity="0.66"
			className="btn-icon"
		/>
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M15.5 18.0667H17.2135C18.3181 18.0667 19.2135 17.1712 19.2135 16.0667V11C19.2135 9.89543 18.3181 9 17.2135 9H15.5796C15.9948 9.36647 16.2567 9.90265 16.2567 10.5V16.5C16.2567 17.1347 15.9611 17.7003 15.5 18.0667Z"
			fill="#A0A0A0"
			opacity="0.89"
			className="btn-icon"
		/>
		<rect x="4" y="9" width="11" height="9.06667" rx="2" fill="#A0A0A0" className="btn-icon" />
	</svg>
)

export const Timeline = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		width="27"
		height="27"
		viewBox="0 0 27 27"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		role="presentation"
		{...props}
	>
		<rect y="0" width="27" height="27" rx="3" fill="#00000000" className="btn-bkg" />
		<rect x="4" y="9" width="13" height="2" fill="#BABABA" className="btn-icon" />
		<rect x="7" y="12" width="13" height="2" fill="#BABABA" className="btn-icon" />
		<rect x="10" y="15" width="13" height="2" fill="#BABABA" className="btn-icon" />
	</svg>
)
