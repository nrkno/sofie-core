import * as React from 'react'
import { IBlueprintPieceGeneric, NoraContent } from 'tv-automation-sofie-blueprints-integration'
import { IModalAttributes, Modal } from '../../../../lib/ui/containers/modals/Modal'
import { NoraItemEditor } from './NoraItemEditor'
import { InternalIBlueprintPieceGeneric } from '../../../../../lib/collections/Pieces'

export { NoraItemRenderer, isNoraItem }

interface INoraSuperRendererProps {
	item: InternalIBlueprintPieceGeneric
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
		const { item } = this.props
		const content = item.content as NoraContent
		const payload = content && content.payload

		const modalProps: IModalAttributes = {
			title: item ? item.name : '',
			show: this.state.editMode,
			onDiscard: () => {
				this.setEditMode(false)
			}
		}

		return (
			<div className='shelf-inspector'>
				<h2>{item.name}</h2>
				<button className='btn btn-primary' disabled={!item} onClick={() => { this.setEditMode(true) }}>Edit</button>
				<Modal {...modalProps}>
					<NoraItemEditor payload={payload} />
				</Modal>
			</div>
		)
	}
}

function isNoraItem(item: InternalIBlueprintPieceGeneric): boolean {
	const content = item.content as NoraContent

	if (!content || !content.payload || !content.payload.template) {
		return false
	}

	return ['super', 'bakskjerm'].indexOf(content.payload.template.layer) > -1
}