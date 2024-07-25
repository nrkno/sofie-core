import * as React from 'react'
import { NoraContent } from '@sofie-automation/blueprints-integration'
import { IModalAttributes, Modal } from '../../../../lib/ui/containers/modals/Modal'
import { NoraItemEditor } from './NoraItemEditor'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { RundownUtils } from '../../../../lib/rundown'
import { withTranslation, WithTranslation } from 'react-i18next'
import InspectorTitle from './InspectorTitle'
import { ErrorBoundary } from '../../../../lib/ErrorBoundary'
import { IAdLibListItem } from '../../AdLibListItem'
import { UIShowStyleBase } from '../../../../../lib/api/showStyles'
import { UIStudio } from '../../../../../lib/api/studios'

export { isNoraItem }

interface INoraSuperRendererProps {
	piece: IAdLibListItem | PieceUi
	showStyleBase: UIShowStyleBase
	studio: UIStudio
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

		render(): JSX.Element {
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
						<h2 className="mod mas">{actualPiece.name}</h2>
						<div className="mod mas">
							<button
								className="btn btn-primary"
								disabled={this.state.editMode}
								onClick={() => {
									this.setEditMode(true)
								}}
							>
								{t('Edit in Nora')}
							</button>
						</div>
						<Modal {...modalProps}>
							<NoraItemEditor piece={actualPiece} />
						</Modal>
					</div>
				</ErrorBoundary>
			)
		}
	}
)

function isNoraItem(item: IAdLibListItem | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item)
		? (item.content as NoraContent)
		: (item.instance.piece.content as NoraContent)

	if (!content || !content.payload || !content.payload.template) {
		return false
	}

	return true
}
