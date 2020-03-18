import * as React from 'react'
import { PieceGeneric } from '../../../../../lib/collections/Pieces'
import { NoraContent } from 'tv-automation-sofie-blueprints-integration'
import { IModalAttributes, Modal } from '../../../../lib/ui/containers/modals/Modal'
import { NoraItemEditor } from './NoraItemEditor'

export { NoraItemRenderer, isNoraItem }

interface INoraSuperRendererProps {
	piece: PieceGeneric
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

	setEditMode (enabled: boolean) {
		this.setState({ editMode: enabled === true })
	}

	render () {
		const { piece } = this.props

		const modalProps: IModalAttributes = {
			title: piece.name,
			show: this.state.editMode,
			onDiscard: () => {
				this.setEditMode(false)
			}
		}

		return (
			<div className="shelf-inspector">
				<h2>{this.props.piece.name}</h2>
				<button className="btn btn-primary" disabled={this.state.editMode} onClick={() => { this.setEditMode(true) }}>Edit</button>
				<Modal {...modalProps}>
					<NoraItemEditor piece={this.props.piece} />
				</Modal>
			</div>
		)
	}
}

function isNoraItem (item: PieceGeneric): boolean {
	const content = item.content as NoraContent

	if (!content || !content.payload || !content.payload.template) {
		return false
	}

	// return [ 'super', 'bakskjerm' ].indexOf(content.payload.template.layer) > -1
	return true
}