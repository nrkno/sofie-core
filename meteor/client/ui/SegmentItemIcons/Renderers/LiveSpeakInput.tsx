import * as React from 'react'

// @todo: use colours from the scss
// @todo: split can use any source (rather than cam + live)
export default class LiveSpeakInputIcon extends React.Component<{ abbreviation?: string }> {
	render () {
		return (
			<svg className='segment_line_item_icon' version='1.1' viewBox='0 0 126.5 89' xmlns='http://www.w3.org/2000/svg'>
				<rect width='126.5' height='44.5' className='vt'/>
				<rect width='126.5' height='44.5' y='44.5' className='mic'/>
				<text x='5' y='66.514' textLength='116.5' style={{ fill: '#ffffff', 'font-family': 'open-sans', 'font-size': '40px', 'letter-spacing': '0px', 'line-height': '1.25', 'word-spacing': '0px' }} xmlSpace='preserve'>
					<tspan x='5' y='66.514' style={{fill: '#ffffff', 'font-family': 'Roboto', 'font-size': '62px', 'font-weight': '100'}}>
						{this.props.abbreviation ? this.props.abbreviation : 'LSK'}
					</tspan>
				</text>
			</svg>
		)
	}
}
