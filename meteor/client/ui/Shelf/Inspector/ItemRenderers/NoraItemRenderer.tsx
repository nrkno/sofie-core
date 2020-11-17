import * as React from 'react'
import { IBlueprintPieceGeneric, NoraContent } from '@sofie-automation/blueprints-integration'
import { IModalAttributes, Modal } from '../../../../lib/ui/containers/modals/Modal'
import { NoraItemEditor } from './NoraItemEditor'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { withTranslation, WithTranslation } from 'react-i18next'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import InspectorTitle from './InspectorTitle'
import { ErrorBoundary } from '../../../../lib/ErrorBoundary'
import { Studio } from '../../../../../lib/collections/Studios'
import { BucketAdLibItem } from '../../RundownViewBuckets'

export { isNoraItem }

interface INoraSuperRendererProps {
	piece: AdLibPieceUi | PieceUi
	showStyleBase: ShowStyleBase
	studio: Studio
}

interface INoraSuperRendererState {
	editMode: boolean
}

export default withTranslation()(
	class NoraItemRenderer extends React.Component<INoraSuperRendererProps & WithTranslation, INoraSuperRendererState> {
		constructor(props: INoraSuperRendererProps & WithTranslation) {
			super(props)

			this.state = {
				editMode: false,
			}
		}

		setEditMode(enabled: boolean) {
			this.setState({ editMode: enabled === true })
		}

		render() {
			const { piece, t } = this.props

			const actualPiece = RundownUtils.isAdLibPiece(piece) ? piece : piece.instance.piece

			const modalProps: IModalAttributes = {
				title: actualPiece.name,
				show: this.state.editMode,
				onDiscard: () => {
					this.setEditMode(false)
				},
			}

			return (
				<ErrorBoundary>
					<InspectorTitle
						piece={this.props.piece}
						showStyleBase={this.props.showStyleBase}
						studio={this.props.studio}
					/>
					<div className="shelf-inspector__content">
						<h2>{actualPiece.name}</h2>
						<button
							className="btn btn-primary"
							disabled={this.state.editMode}
							onClick={() => {
								this.setEditMode(true)
							}}>
							{t('Edit')}
						</button>
						<Modal {...modalProps}>
							<NoraItemEditor piece={actualPiece} />
						</Modal>
					</div>
				</ErrorBoundary>
			)
		}
	}
)

function isNoraItem(item: AdLibPieceUi | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item)
		? (item.content as NoraContent)
		: (item.instance.piece.content as NoraContent)

	if (!content || !content.payload || !content.payload.template) {
		return false
	}

	return true
}
