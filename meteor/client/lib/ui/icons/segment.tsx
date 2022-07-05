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
		width="14"
		height="14"
		viewBox="0 0 14 8"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		role="presentation"
		{...props}
	>
		<rect y="0" width="27" height="27" rx="3" fill="#00000000" className="btn-bkg" />
		<rect width="9" height="5" rx="2" fill="#BBBBBB"/>
		<rect y="6" width="9" height="2" rx="1" fill="#BBBBBB"/>
		<path fill-rule="evenodd" clip-rule="evenodd" d="M9.5 5.0667H11.2135C12.3181 5.0667 13.2135 4.1712 13.2135 3.0667V2C13.2135 0.89543 12.3181 0 11.2135 0H9.5796C9.9948 0.36647 10.2567 0.90265 10.2567 1.5V3.5C10.2567 4.1347 9.9611 4.7003 9.5 5.0667Z" fill="#8B8B8B"/>
		<path fill-rule="evenodd" clip-rule="evenodd" d="M9 8H12C12.5523 8 13 7.55228 13 7C13 6.44772 12.5523 6 12 6H9C9.55229 6 10 6.44772 10 7C10 7.55228 9.55228 8 9 8Z" fill="#8B8B8B"/>
	</svg>
)

export const Timeline = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 14 8"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		role="presentation"
		{...props}
	>
		<path d="M4 0H0V2H4V0Z" fill="#BBBBBB"/>
		<path d="M4 3H0V5H4V3Z" fill="#BBBBBB"/>
		<path d="M14 3H6V5H14V3Z" fill="#BBBBBB"/>
		<path d="M4 6H0V8H4V6Z" fill="#BBBBBB"/>
		<path d="M14 6H6V8H14V6Z" fill="#BBBBBB"/>
		<path d="M14 0H6V2H14V0Z" fill="#BBBBBB"/>
	</svg>
)

export const List = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 14 8"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		role="presentation"
		{...props}
	>
		<path d="M9 0H0V2H9V0Z" fill="#BBBBBB"/>
		<path d="M14 3H0V5H14V3Z" fill="#BBBBBB"/>
		<path d="M14 6H0V8H14V6Z" fill="#BBBBBB"/>
	</svg>

)