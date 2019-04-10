import * as React from 'react'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as Escape from 'react-escape'
import * as VelocityReact from 'velocity-react'
import { ClipTrimPanel } from './ClipTrimPanel'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { VTContent, VTEditableParameters } from 'tv-automation-sofie-blueprints-integration'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { SegmentLineItem } from '../../../lib/collections/SegmentLineItems'
import { ModalDialog } from '../../lib/ModalDialog';
import { doUserAction } from '../../lib/userAction';
import { UserActionAPI } from '../../../lib/api/userActions';

export interface IProps {
	runningOrderId: string
	studioInstallation: StudioInstallation
	selectedSegmentLineItem: SegmentLineItem

	onClose?: () => void
}

interface IState {
	inPoint: number
	duration: number
}

export const ClipTrimDialog = translate()(class ClipTrimDialog extends React.Component<IProps & InjectedTranslateProps, IState> {
	constructor (props: IProps & InjectedTranslateProps) {
		super(props)

		this.state = {
			inPoint: ((this.props.selectedSegmentLineItem.content as VTContent).editable as VTEditableParameters).editorialStart,
			duration: ((this.props.selectedSegmentLineItem.content as VTContent).editable as VTEditableParameters).editorialDuration
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
		doUserAction(this.props.t, e, UserActionAPI.methods.setInOutPoints, [
			this.props.runningOrderId,
			this.props.selectedSegmentLineItem.segmentLineId,
			this.props.selectedSegmentLineItem._id,
			this.state.inPoint,
			this.state.duration
		])
	}
	render () {
		const { t } = this.props
		return (
			<ModalDialog title={t('Edit "{{name}}"', { name: this.props.selectedSegmentLineItem.name })} show={true} acceptText={t('OK')} secondaryText={t('Cancel')}
			onAccept={this.handleAccept} onDiscard={(e) => this.props.onClose && this.props.onClose()} onSecondary={(e) => this.props.onClose && this.props.onClose()}>
				<ClipTrimPanel
					studioInstallationId={this.props.studioInstallation._id}
					runningOrderId={this.props.runningOrderId}
					segmentLineItemId={this.props.selectedSegmentLineItem._id}
					segmentLineId={this.props.selectedSegmentLineItem.segmentLineId}
					inPoint={this.state.inPoint}
					duration={this.state.duration}
					onChange={this.handleChange}
				/>
			</ModalDialog>
		)
	}
})
