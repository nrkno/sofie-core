import * as React from 'react'
import { SegmentLineItem } from '../../../../lib/collections/SegmentLineItems'
import { SplitsContent, SourceLayerType } from 'tv-automation-sofie-blueprints-integration'

// @todo: use colours from the scss
// @todo: split can use any source (rather than cam + live)
export default class SplitInputIcon extends React.Component<{ abbreviation?: string, segmentLineItem?: SegmentLineItem }> {
	getCameraLabel (segmentLineItem: SegmentLineItem | undefined) {
		if (segmentLineItem && segmentLineItem.content) {
			let c = segmentLineItem.content as SplitsContent
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

	getLeftSourceType (segmentLineItem: SegmentLineItem | undefined): string {
		if (segmentLineItem && segmentLineItem.content) {
			let c = segmentLineItem.content as SplitsContent
			const left = (c.boxSourceConfiguration[0] || {}).type || SourceLayerType.CAMERA
			return this.getSourceType(left)
		}
		return 'camera'
	}

	getRightSourceType (segmentLineItem: SegmentLineItem | undefined): string {
		if (segmentLineItem && segmentLineItem.content) {
			let c = segmentLineItem.content as SplitsContent
			const right = (c.boxSourceConfiguration[1] || {}).type || SourceLayerType.REMOTE
			const sourceType = this.getSourceType(right)
			return sourceType + (this.getLeftSourceType(segmentLineItem) === sourceType ? ' second' : '')
		}
		return 'remote'
	}

	render () {
		return (
			<svg className='segment_line_item_icon' version='1.1' viewBox='0 0 126.5 89' xmlns='http://www.w3.org/2000/svg'>
				<rect width='126.5' height='44.5' className={this.getLeftSourceType(this.props.segmentLineItem)} />
				<rect width='126.5' height='44.5' y='44.5' className={this.getRightSourceType(this.props.segmentLineItem)} />
				<text x='9.6414976' textLength='106.5' lengthAdjust="spacing" y='71.513954' textAnchor='middle' style={{ fill: '#ffffff', 'fontFamily': 'open-sans', 'fontSize': '40px', 'letterSpacing': '0px', 'lineHeight': '1.25', 'wordSpacing': '0px', 'textShadow': '0 2px 9px rgba(0, 0, 0, 0.5)' }} xmlSpace='preserve'>
					<tspan x='63.25' y='71.513954' textLength='106.5' lengthAdjust="spacing" style={{ fill: '#ffffff', 'fontFamily': 'Roboto', 'fontSize': '75px', 'fontWeight': 100 }}>{
						this.getCameraLabel(this.props.segmentLineItem)
					}</tspan>
				</text>
			</svg>
		)
	}
}
