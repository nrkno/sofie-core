import * as React from 'react'

export const ZoomOutIcon = () => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="11.5" cy="11.5" r="7.5" fill="#3C3C3C" className="btn-bkg" />
		<rect x="6.5" y="10.5" width="10" height="2" fill="white" />
	</svg>
)

export const ZoomInIcon = () => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="11" cy="11" r="11" fill="#3C3C3C" className="btn-bkg" />
		<rect x="12" y="5" width="12" height="2" transform="rotate(90 12 5)" fill="white" />
		<rect x="5" y="10" width="12" height="2" fill="white" />
	</svg>
)

export const ZoomShowAll = () => (
	<svg width="23" height="22" viewBox="0 0 23 22" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect y="3" width="23" height="17" rx="3" fill="#3C3C3C" className="btn-bkg" />
		<line x1="2.5" y1="6.5" x2="2.5" y2="16.5" stroke="white" />
		<line x1="20.5" y1="6.5" x2="20.5" y2="16.5" stroke="white" />
		<path
			d="M19.4596 11.9596C19.7135 11.7058 19.7135 11.2942 19.4596 11.0404L15.323 6.90381C15.0692 6.64997 14.6576 6.64997 14.4038 6.90381C14.15 7.15765 14.15 7.5692 14.4038 7.82304L18.0808 11.5L14.4038 15.177C14.15 15.4308 14.15 15.8424 14.4038 16.0962C14.6576 16.35 15.0692 16.35 15.323 16.0962L19.4596 11.9596ZM11 12.15L19 12.15V10.85L11 10.85V12.15Z"
			fill="white"
		/>
		<path
			d="M3.54038 11.0404C3.28654 11.2942 3.28654 11.7058 3.54038 11.9596L7.67696 16.0962C7.9308 16.35 8.34235 16.35 8.59619 16.0962C8.85003 15.8424 8.85003 15.4308 8.59619 15.177L4.91924 11.5L8.59619 7.82304C8.85003 7.5692 8.85003 7.15765 8.59619 6.90381C8.34235 6.64997 7.9308 6.64997 7.67696 6.90381L3.54038 11.0404ZM12 10.85L4 10.85V12.15L12 12.15V10.85Z"
			fill="white"
		/>
	</svg>
)
