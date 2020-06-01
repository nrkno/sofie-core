import * as React from 'react'
import { IBlueprintPieceGeneric } from 'tv-automation-sofie-blueprints-integration'
import { IModalAttributes, Modal } from '../../../lib/ui/containers/modals/Modal'
import renderItem from './ItemRenderers/ItemRendererFactory'
import { PieceUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../AdLibPanel'

export { ShelfInspector }

interface IShelfInspectorProps {
	selected: AdLibPieceUi | PieceUi | undefined
}

class ShelfInspector extends React.Component<IShelfInspectorProps> {
	constructor(props: IShelfInspectorProps) {
		super(props)
	}

	render() {
		const { selected } = this.props
		const content = selected && renderItem(selected)

		return <div className="shelf-inspector">{content}</div>
	}
}
