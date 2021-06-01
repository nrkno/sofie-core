import React from 'react'

export const RightArrow = (props: React.SVGProps<SVGSVGElement>) => (
	<svg width="8" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M8 5L0.5 9.33013L0.5 0.669872L8 5Z" fill="white" />
	</svg>
)

export const LeftArrow = (props: React.SVGProps<SVGSVGElement>) => (
	<svg width="8" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M5.96244e-08 5L7.5 0.669872L7.5 9.33013L5.96244e-08 5Z" fill="white" />
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
