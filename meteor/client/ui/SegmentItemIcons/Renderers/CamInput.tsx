import * as React from 'react'

// @todo: use dynamic data for camera number
export default class CamInputIcon extends React.Component<{ inputIndex?: number, abbreviation?: string }> {
	render () {
		return (
			<svg className='segment_line_item_icon' version='1.1' viewBox='0 0 126.5 89' xmlns='http://www.w3.org/2000/svg'>
				<rect width='126.5' height='89' className='camera'/>
				<text x='9.6414976' textLength='106.5' y='71.513954' style={{ fill: '#ffffff', 'font-family': 'open-sans', 'font-size': '40px', 'letter-spacing': '0px', 'line-height': '1.25', 'word-spacing': '0px' }} xmlSpace='preserve'>
					<tspan x='9.6414976' y='71.513954' style={{fill: '#ffffff', 'font-family': 'Roboto', 'font-size': '75px', 'font-weight': '100'}}>
						{this.props.abbreviation ? this.props.abbreviation : 'C '}
						<tspan style={{'font-family': 'Roboto', 'font-weight': 'normal'}}>{this.props.inputIndex ? this.props.inputIndex : ''}</tspan>
					</tspan>
				</text>
			</svg>
		)
	}
}
