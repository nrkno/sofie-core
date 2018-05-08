import * as React from 'react'

export const Spinner: React.SFC<{}> = () => (
	<div className='mod mhl mvl alc'>
		<div className='origo-spinner sp-blue sp-large'>
			<svg className='origo-spinner-svg' version='1.1' xmlns='http://www.w3.org/2000/svg'>
				<circle className='origo-spin-circle' cx='17' cy='17' r='15'></circle>
			</svg>
		</div>
	</div>
)
