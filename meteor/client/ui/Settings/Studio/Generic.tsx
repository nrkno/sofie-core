import * as React from 'react'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { withTranslation } from 'react-i18next'
import { EditAttribute } from '../../../lib/EditAttribute'
import { StudioBaselineStatus } from './Baseline'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { Studios } from '../../../collections'
import { useHistory } from 'react-router-dom'
import { MeteorCall } from '../../../../lib/api/methods'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'
import { catchError } from '../../../lib/lib'

interface IStudioGenericPropertiesProps {
	studio: DBStudio
	availableShowStyleBases: Array<{
		name: string
		value: ShowStyleBaseId
		showStyleBase: DBShowStyleBase
	}>
}
interface IStudioGenericPropertiesState {}
export const StudioGenericProperties = withTranslation()(
	class StudioGenericProperties extends React.Component<
		Translated<IStudioGenericPropertiesProps>,
		IStudioGenericPropertiesState
	> {
		constructor(props: Translated<IStudioGenericPropertiesProps>) {
			super(props)
		}

		renderShowStyleEditButtons() {
			const buttons: JSX.Element[] = []
			if (this.props.studio) {
				for (const showStyleBaseId of this.props.studio.supportedShowStyleBase) {
					const showStyleBase = this.props.availableShowStyleBases.find(
						(base) => base.showStyleBase._id === showStyleBaseId
					)
					if (showStyleBase) {
						buttons.push(
							<RedirectToShowStyleButton
								key={'settings-nevigation-' + showStyleBase.showStyleBase._id}
								name={showStyleBase.showStyleBase.name}
								id={showStyleBase.showStyleBase._id}
							/>
						)
					}
				}
			}
			return buttons
		}

		render(): JSX.Element {
			const { t } = this.props
			return (
				<div className="properties-grid">
					<h2 className="mhn mtn">{t('Generic Properties')}</h2>
					<label className="field">
						<LabelActual label={t('Studio Name')} />
						{!this.props.studio.name ? (
							<div className="error-notice">
								{t('No name set')} <FontAwesomeIcon icon={faExclamationTriangle} />
							</div>
						) : null}
						<div className="mdi">
							<EditAttribute
								modifiedClassName="bghl"
								attribute="name"
								obj={this.props.studio}
								type="text"
								collection={Studios}
								className="mdinput"
							/>
							<span className="mdfx"></span>
						</div>
					</label>
					<div className="field">
						{t('Select Compatible Show Styles')}
						<div className="mdi">
							<EditAttribute
								attribute="supportedShowStyleBase"
								obj={this.props.studio}
								options={this.props.availableShowStyleBases}
								label={t('Click to show available Show Styles')}
								type="multiselect"
								collection={Studios}
							/>
							{this.renderShowStyleEditButtons()}
							<NewShowStyleButton />
						</div>
						{!this.props.studio.supportedShowStyleBase.length ? (
							<div className="error-notice">
								{t('Show style not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
							</div>
						) : null}
					</div>
					<label className="field">
						<LabelActual label={t('Frame Rate')} />
						<div className="mdi">
							<EditAttribute
								modifiedClassName="bghl"
								attribute="settings.frameRate"
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="mdinput"
							/>
							<span className="mdfx"></span>
						</div>
					</label>
					<label className="field">
						<LabelActual label={t('Minimum Take Span')} />
						<div className="mdi">
							<EditAttribute
								modifiedClassName="bghl"
								attribute="settings.minimumTakeSpan"
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="mdinput"
							/>
							<span className="mdfx"></span>
						</div>
					</label>
					<label className="field">
						<LabelActual label={t('Enable "Play from Anywhere"')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute="settings.enablePlayFromAnywhere"
							obj={this.props.studio}
							type="checkbox"
							collection={Studios}
						/>
					</label>
					<label className="field">
						<LabelActual label={t('Media Preview URL')} />
						<div className="mdi">
							<EditAttribute
								modifiedClassName="bghl"
								attribute="settings.mediaPreviewsUrl"
								obj={this.props.studio}
								type="text"
								collection={Studios}
								className="mdinput"
							/>
							<span className="mdfx"></span>
						</div>
					</label>
					<label className="field">
						<LabelActual label={t('Slack Webhook URLs')} />
						<div className="mdi">
							<EditAttribute
								modifiedClassName="bghl"
								attribute="settings.slackEvaluationUrls"
								obj={this.props.studio}
								type="text"
								collection={Studios}
								className="mdinput"
							/>
							<span className="mdfx"></span>
						</div>
					</label>
					<label className="field">
						<LabelActual label={t('Supported Media Formats')} />
						<div className="mdi">
							<EditAttribute
								modifiedClassName="bghl"
								attribute="settings.supportedMediaFormats"
								obj={this.props.studio}
								type="text"
								collection={Studios}
								className="mdinput"
							/>
							<span className="mdfx"></span>
						</div>
					</label>
					<label className="field">
						<LabelActual label={t('Supported Audio Formats')} />
						<div className="mdi">
							<EditAttribute
								modifiedClassName="bghl"
								attribute="settings.supportedAudioStreams"
								obj={this.props.studio}
								type="text"
								collection={Studios}
								className="mdinput"
							/>
							<span className="mdfx"></span>
						</div>
					</label>
					<label className="field">
						<LabelActual label={t('Force the Multi-gateway-mode')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute="settings.forceMultiGatewayMode"
							obj={this.props.studio}
							type="checkbox"
							collection={Studios}
						/>
					</label>
					<label className="field">
						<LabelActual label={t('Multi-gateway-mode delay time')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute="settings.multiGatewayNowSafeLatency"
							obj={this.props.studio}
							type="int"
							collection={Studios}
							className="mdinput"
						/>
					</label>
					<label className="field">
						<LabelActual label={t('Allow Rundowns to be reset while on-air')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute="settings.allowRundownResetOnAir"
							obj={this.props.studio}
							type="checkbox"
							collection={Studios}
						/>
					</label>
					<label className="field">
						<LabelActual label={t('Preserve position of segments when unsynced relative to other segments')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute="settings.preserveOrphanedSegmentPositionInRundown"
							obj={this.props.studio}
							type="checkbox"
							collection={Studios}
						/>
						<span className="text-s dimmed field-hint">{t('This has only been tested for the iNews gateway')}</span>
					</label>

					<label className="field">
						<LabelActual label={t('Enable Scratchpad mode, for testing adlibs before taking the first Part')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute="settings.allowScratchpad"
							obj={this.props.studio}
							type="checkbox"
							collection={Studios}
						/>
					</label>

					<StudioBaselineStatus studioId={this.props.studio._id} />
				</div>
			)
		}
	}
)

const NewShowStyleButton = React.memo(function NewShowStyleButton() {
	const history = useHistory()

	const onShowStyleAdd = () => {
		MeteorCall.showstyles
			.insertShowStyleBase()
			.then((showStyleBaseId) => {
				history.push('/settings/showStyleBase/' + showStyleBaseId)
			})
			.catch(catchError('showstyles.insertShowStyleBase'))
	}

	return (
		<button className="btn btn-primary mts" onClick={onShowStyleAdd}>
			New Show Style
		</button>
	)
})

const RedirectToShowStyleButton = React.memo(function RedirectToShowStyleButton(props: {
	id: ShowStyleBaseId
	name: string
}) {
	const history = useHistory()

	const doRedirect = () => history.push('/settings/showStyleBase/' + props.id)

	return (
		<button className="btn mrs mts" onClick={doRedirect}>
			Edit {props.name}
		</button>
	)
})
