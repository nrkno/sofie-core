import * as React from 'react'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { ClipTrimPanel } from './ClipTrimPanel'
import { VTContent, VTEditableParameters } from 'tv-automation-sofie-blueprints-integration'
import { Studio } from '../../../lib/collections/Studios'
import { Piece } from '../../../lib/collections/Pieces'
import { ModalDialog } from '../../lib/ModalDialog'
import { doUserAction, UserAction } from '../../lib/userAction'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'
import { AdLibPieceUi } from '../Shelf/AdLibPanel'

export interface IProps {
	playlistId: RundownPlaylistId
	studio: Studio
	selectedPiece: Piece

	onClose?: () => void
}

interface IState {
	inPoint: number
	duration: number
}

export const ClipTrimDialog = translate()(class ClipTrimDialog extends React.Component<IProps & InjectedTranslateProps, IState> {
	constructor(props: IProps & InjectedTranslateProps) {
		super(props)

		this.state = {
			inPoint: ((this.props.selectedPiece.content as VTContent).editable as VTEditableParameters).editorialStart,
			duration: ((this.props.selectedPiece.content as VTContent).editable as VTEditableParameters).editorialDuration,
		}
	}
	handleChange = (inPoint: number, duration: number) => {
		this.setState({
			inPoint,
			duration
		})
	}
	handleAccept = (e) => {
		this.props.onClose && this.props.onClose()
		doUserAction(this.props.t, e, UserAction.SET_IN_OUT_POINTS, (e) => MeteorCall.userAction.setInOutPoints(e,
			this.props.playlistId,
			this.props.selectedPiece.partId,
			this.props.selectedPiece._id,
			this.state.inPoint,
			this.state.duration
		))
	}
	render() {
		const { t } = this.props
		return (
			<ModalDialog title={t('Trim "{{name}}"', { name: this.props.selectedPiece.name })} show={true} acceptText={t('OK')} secondaryText={t('Cancel')}
				onAccept={this.handleAccept} onDiscard={(e) => this.props.onClose && this.props.onClose()} onSecondary={(e) => this.props.onClose && this.props.onClose()}>
				<ClipTrimPanel
					studioId={this.props.studio._id}
					playlistId={this.props.playlistId}
					pieceId={this.props.selectedPiece._id}
					partId={this.props.selectedPiece.partId}
					inPoint={this.state.inPoint}
					duration={this.state.duration}
					onChange={this.handleChange}
				/>
			</ModalDialog>
		)
	}
})
