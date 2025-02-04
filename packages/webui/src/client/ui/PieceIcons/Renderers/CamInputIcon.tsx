import * as React from 'react'

// @todo: use dynamic data for camera number
export default class CamInputIcon extends React.Component<{ inputIndex?: string; abbreviation?: string }> {
	render(): JSX.Element {
		return (
			<svg className="piece-icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
				<rect width="126.5" height="89" className="camera" />
				<text
					x="63.25"
					y="71.513954"
					textAnchor="middle"
					textLength="126.5"
					className="piece-icon-text"
					xmlSpace="preserve"
				>
					<tspan lengthAdjust="spacing" className="label">
						{this.props.abbreviation !== undefined ? this.props.abbreviation : 'C'}
						<tspan>{this.props.inputIndex !== undefined ? this.props.inputIndex : ''}</tspan>
					</tspan>
				</text>
			</svg>
		)
	}
}
