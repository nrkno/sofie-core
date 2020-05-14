import * as React from 'react'
import { IBlueprintPieceGeneric, NoraContent } from 'tv-automation-sofie-blueprints-integration'
import { IModalAttributes, Modal } from '../../../../lib/ui/containers/modals/Modal'
import { NoraItemEditor } from './NoraItemEditor'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'

export { NoraItemRenderer, isNoraItem }

interface INoraSuperRendererProps {
	piece: AdLibPieceUi | PieceUi
}

interface INoraSuperRendererState {
	editMode: boolean
}

class NoraItemRenderer extends React.Component<INoraSuperRendererProps, INoraSuperRendererState> {
	constructor(props: INoraSuperRendererProps) {
		super(props)

		this.state = {
			editMode: false
		}
	}

	setEditMode(enabled: boolean) {
		this.setState({ editMode: enabled === true })
	}

	render() {
		const { piece } = this.props

		const actualPiece = RundownUtils.isAdLibPiece(piece) ?
			piece :
			piece.instance.piece

		const modalProps: IModalAttributes = {
			title: actualPiece.name,
			show: this.state.editMode,
			onDiscard: () => {
				this.setEditMode(false)
			}
		}

		return (
			<div className='shelf-inspector__content'>
				<h2>{actualPiece.name}</h2>
				<button className='btn btn-primary' disabled={this.state.editMode} onClick={() => { this.setEditMode(true) }}>Edit</button>
				<Modal {...modalProps}>
					<NoraItemEditor piece={actualPiece} />
				</Modal>
			</div>
		)
	}
}

function isNoraItem(item: AdLibPieceUi | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item) ?
		item.content as NoraContent :
		item.instance.piece.content as NoraContent

	if (!content || !content.payload || !content.payload.template) {
		return false
	}

	return true
}
