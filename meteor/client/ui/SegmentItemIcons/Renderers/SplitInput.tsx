import * as React from 'react'
import { SegmentLineItem } from '../../../../lib/collections/SegmentLineItems'
import { SplitsContent, SourceLayerType } from 'tv-automation-sofie-blueprints-integration/dist/content'

// @todo: use colours from the scss
// @todo: split can use any source (rather than cam + live)
export default class SplitInputIcon extends React.Component<{ abbreviation?: string, segmentLineItem?: SegmentLineItem }> {
	getCameraLabel (c: SplitsContent) {
		const camera = c.boxSourceConfiguration.find(i => i.type === SourceLayerType.CAMERA)
		if (camera) {
			const label = camera.studioLabel.match(/([a-zA-Z]+)?(\d+)/)
			return <React.Fragment>
						{label ? label[1] + ' ' : camera.studioLabel}
						<tspan style={{ 'fontFamily': 'Roboto', 'fontWeight': 'normal' }}>{ label ? label[2] : '' }</tspan>
					</React.Fragment>
		} else {
			return this.props.abbreviation ? this.props.abbreviation : 'Spl'
		}
	}

	getSourceType (type: SourceLayerType): string {
		switch (type) {
			case SourceLayerType.CAMERA:
				return 'camera'
			case SourceLayerType.REMOTE:
				return 'remote'
			case SourceLayerType.VT:
				return 'vt'
		}
		return ''
	}

	getLeftSourceType (c: SplitsContent): string {
		const left = (c.boxSourceConfiguration[0] || {}).type || SourceLayerType.CAMERA
		return this.getSourceType(left)
	}

	getRightSourceType (c: SplitsContent): string {
		const right = (c.boxSourceConfiguration[1] || {}).type || SourceLayerType.REMOTE
		return this.getSourceType(right) + (this.getLeftSourceType(c) === this.getSourceType(right) ? ' second' : '')
	}

	render () {
		return (
			<svg className='segment_line_item_icon' version='1.1' viewBox='0 0 126.5 89' xmlns='http://www.w3.org/2000/svg'>
				<rect width='63.25' height='89' className={this.props.segmentLineItem && this.props.segmentLineItem.content ? this.getLeftSourceType(this.props.segmentLineItem.content as SplitsContent) : 'camera'} />
				<rect width='63.25' height='89' x='63.25' className={this.props.segmentLineItem && this.props.segmentLineItem.content ? this.getLeftSourceType(this.props.segmentLineItem.content as SplitsContent) : 'remote'} />
				<text x='9.6414976' textLength='106.5' y='71.513954' textAnchor='middle' style={{ fill: '#ffffff', 'fontFamily': 'open-sans', 'fontSize': '40px', 'letterSpacing': '0px', 'lineHeight': '1.25', 'wordSpacing': '0px', 'textShadow': '0 2px 9px rgba(0, 0, 0, 0.5)' }} xmlSpace='preserve'>
					<tspan x='63.25' y='71.513954' style={{ fill: '#ffffff', 'fontFamily': 'Roboto', 'fontSize': '75px', 'fontWeight': 100 }}>{this.props.segmentLineItem && this.props.segmentLineItem.content ?
							this.getCameraLabel(this.props.segmentLineItem.content as SplitsContent)
							: this.props.abbreviation ? this.props.abbreviation : 'Spl'}</tspan>
				</text>
			</svg>
		)
	}
}
