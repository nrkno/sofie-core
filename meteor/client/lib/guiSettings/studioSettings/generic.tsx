import React, { useCallback, useEffect, useState } from 'react'
import { TFunction } from 'react-i18next'
import { GUISetting, GUISettingsType, guiSettingId, guiSetting } from '../guiSettings'
import { Studio } from '../../../../lib/collections/Studios'
import { EditAttribute } from '../../EditAttribute'
import { ShowStyleBases } from '../../../collections'
import { RedirectToShowStyleButton } from '../lib'
import { useTracker } from '../../ReactMeteorData/ReactMeteorData'
import { useHistory } from 'react-router-dom'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { MeteorCall } from '../../../../lib/api/methods'
import { getDefaultEditAttributeProps } from './lib'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import Tooltip from 'rc-tooltip'
import { getHelpMode } from '../../localStorage'

export function genericProperties(props: { t: TFunction; studio: Studio; urlBase: string }): GUISetting<any>[] {
	const { t, studio, urlBase } = props
	const settings: GUISetting<any>[] = []

	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Studio Name'),
			description: t('Name of the studio'),
			id: guiSettingId(urlBase, 'name'),
			getWarning: () => {
				return !studio.name && t('No name set')
			}, // json {requires: []}, minLength: 1, maxLength: 255
			render: (renderProps: { studio: Studio }) => (
				<EditAttribute {...getDefaultEditAttributeProps(renderProps.studio)} attribute="name" type="text" />
			),
			renderProps: { studio },
			getSearchString: studio.name,
			// ui-widget: textEdit
		})
	)

	// Note: Non-reactive when called directly:
	const getAvailableShowStyleBases = () => {
		return ShowStyleBases.find(
			{},
			{
				projection: {
					_id: 1,
					name: 1,
				},
			}
		)
			.fetch()
			.map((showStyle) => {
				return {
					_id: showStyle._id,
					name: `${showStyle.name}`,
					value: showStyle._id,
				}
			})
	}
	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Compatible Show Styles'),
			description: t('Which Show Styles are compatible with this studio'),
			id: guiSettingId(urlBase, 'blueprint'),
			getWarning: () => {
				return studio.supportedShowStyleBase.length === 0 && t('Show style not set')
			},
			render: (renderProps: { studio: Studio }) => {
				const availableShowStyleBases = useTracker(() => getAvailableShowStyleBases(), [], [])
				return (
					<>
						<EditAttribute
							{...getDefaultEditAttributeProps(renderProps.studio)}
							type="multiselect"
							attribute="supportedShowStyleBase"
							options={availableShowStyleBases}
							label={t('Click to show available Show Styles')}
						/>
						{renderShowStyleEditButtons(renderProps.studio, availableShowStyleBases)}
						<NewShowStyleButton />
					</>
				)
			},
			renderProps: { studio },
			getSearchString: getAvailableShowStyleBases()
				.map((s) => s.name)
				.join(' '),
		})
	)

	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Frame rate'),
			description: t('What frame rate (fps) the studio is running at.'),
			id: guiSettingId(urlBase, 'settings.frameRate'),
			// getWarning: () => undefined,
			render: (renderProps: { studio: Studio }) => {
				return (
					<EditAttribute
						{...getDefaultEditAttributeProps(renderProps.studio)}
						type="int"
						attribute="settings.frameRate"
					/>
				)
			},
			renderProps: { studio },
			getSearchString: `${studio.settings.frameRate}`,
		})
	)
	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Enable "Play from Anywhere"'),
			description: t('When enabled, the "play from anywhere" option is available to the users in rundown-GUI'),
			id: guiSettingId(urlBase, 'settings.enablePlayFromAnywhere'),
			// getWarning: () => undefined,
			render: (renderProps: { studio: Studio }) => {
				return (
					<EditAttribute
						{...getDefaultEditAttributeProps(renderProps.studio)}
						type="checkbox"
						attribute="settings.enablePlayFromAnywhere"
					/>
				)
			},
			renderProps: { studio },
			getSearchString: '',
		})
	)
	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Media Preview URL'),
			description: t('URL to endpoint where media preview are exposed'),
			id: guiSettingId(urlBase, 'settings.mediaPreviewsUrl'),
			// getWarning: () => undefined,
			render: (renderProps: { studio: Studio }) => {
				return (
					<EditAttribute
						{...getDefaultEditAttributeProps(renderProps.studio)}
						type="text"
						attribute="settings.mediaPreviewsUrl"
					/>
				)
			},
			renderProps: { studio },
			getSearchString: studio.settings.mediaPreviewsUrl,
		})
	)
	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Slack Webhook URLs'),
			description: t('URLs for slack webhook to send evaluations'),
			id: guiSettingId(urlBase, 'settings.slackEvaluationUrls'),
			// getWarning: () => undefined,
			render: (renderProps: { studio: Studio }) => {
				return (
					<EditAttribute
						{...getDefaultEditAttributeProps(renderProps.studio)}
						type="text"
						attribute="settings.slackEvaluationUrls"
					/>
				)
			},
			renderProps: { studio },
			getSearchString: studio.settings.slackEvaluationUrls + '',
		})
	)
	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Supported Media Formats'),
			description: t(
				'Media Resolutions supported by the studio for media playback. Example: "1920x1080i5000,1920x1080i2500,1920x1080p2500,1920x1080p5000"'
			),
			id: guiSettingId(urlBase, 'settings.supportedMediaFormats'),
			// getWarning: () => undefined,
			render: (renderProps: { studio: Studio }) => {
				return (
					<EditAttribute
						{...getDefaultEditAttributeProps(renderProps.studio)}
						type="text"
						attribute="settings.supportedMediaFormats"
					/>
				)
			},
			renderProps: { studio },
			getSearchString: studio.settings.supportedMediaFormats + '',
		})
	)
	settings.push(
		guiSetting({
			type: GUISettingsType.SETTING,
			name: t('Audio Stream Formats supported by the studio for media playback. (Example: "2,4,8,16")'),
			description: t(
				'Media Resolutions supported by the studio for media playback. Example: "1920x1080i5000,1920x1080i2500,1920x1080p2500,1920x1080p5000"'
			),
			id: guiSettingId(urlBase, 'settings.supportedAudioStreams'),
			// getWarning: () => undefined,
			render: (renderProps: { studio: Studio }) => {
				return (
					<EditAttribute
						{...getDefaultEditAttributeProps(renderProps.studio)}
						type="text"
						attribute="settings.supportedAudioStreams"
					/>
				)
			},
			renderProps: { studio },
			getSearchString: studio.settings.supportedAudioStreams + '',
		})
	)
	// settings.forceMultiGatewayMode
	// settings.multiGatewayNowSafeLatency
	// settings.preserveUnsyncedPlayingSegmentContents
	// settings.allowRundownResetOnAir
	// settings.preserveOrphanedSegmentPositionInRundown

	settings.push(settingStudioBaselineStatus({ t, studio, urlBase }))

	return settings
}
function renderShowStyleEditButtons(studio: Studio, availableShowStyleBases: Pick<DBShowStyleBase, '_id' | 'name'>[]) {
	const buttons: JSX.Element[] = []

	for (const showStyleBaseId of studio.supportedShowStyleBase) {
		const showStyleBase = availableShowStyleBases.find((showStyleBase) => showStyleBase._id === showStyleBaseId)
		if (showStyleBase) {
			buttons.push(
				<RedirectToShowStyleButton
					key={'settings-nevigation-' + showStyleBase._id}
					name={showStyleBase.name}
					id={showStyleBase._id}
				/>
			)
		}
	}

	return buttons
}
const NewShowStyleButton = React.memo(function NewShowStyleButton() {
	const history = useHistory()

	const onShowStyleAdd = () => {
		MeteorCall.showstyles
			.insertShowStyleBase()
			.then((showStyleBaseId) => {
				history.push('/settings/showStyleBase/' + showStyleBaseId)
			})
			.catch(console.error)
	}

	return (
		<button className="btn btn-primary btn-add-new" onClick={onShowStyleAdd}>
			New Show Style
		</button>
	)
})
// Yes, this is a terrible hack..
// But because settingStudioBaselineStatus can't use any React hooks, this should do for now..
const hackStudioBaseLineNeedsUpdate = new Set<StudioId>()

function settingStudioBaselineStatus(props: { t: TFunction; studio: Studio; urlBase: string }): GUISetting<any> {
	return guiSetting({
		type: GUISettingsType.SETTING,
		name: props.t('Update Studio Baseline'),
		description: props.t('The Studio Baseline is the Timeline running in the background when no Rundown is active.'),
		id: guiSettingId(props.urlBase, 'studio-baseline'),
		getWarning: () => hackStudioBaseLineNeedsUpdate.has(props.studio._id) && props.t('Studio Baseline needs update'),
		render: (renderProps: { t: TFunction; studioId: StudioId }) => {
			const { t } = renderProps

			const history = useHistory()

			const [needsUpdate, setNeedsUpdate] = useState(hackStudioBaseLineNeedsUpdate.has(renderProps.studioId))

			const updateNeedsUpdate = useCallback((newValue: boolean) => {
				setNeedsUpdate((prevValue) => {
					if (newValue !== prevValue) {
						if (newValue) {
							hackStudioBaseLineNeedsUpdate.add(props.studio._id)
						} else {
							hackStudioBaseLineNeedsUpdate.delete(props.studio._id)
						}
						return newValue
					} else return prevValue
				})
			}, [])

			const updateStatus = useCallback((studioId: StudioId) => {
				MeteorCall.playout
					.shouldUpdateStudioBaseline(studioId)
					.then((result) => {
						updateNeedsUpdate(!!result)
					})
					.catch((err) => {
						console.error('Failed to update studio baseline status', err)
						updateNeedsUpdate(false)
					})
			}, [])

			useEffect(() => {
				updateStatus(props.studio._id)
			}, [props.studio])

			useEffect(() => {
				const UPDATE_PERIOD = 30000 // every 30s
				const updateInterval = Meteor.setInterval(() => updateStatus(props.studio._id), UPDATE_PERIOD)
				return () => Meteor.clearInterval(updateInterval)
			}, [props.studio._id])

			return (
				<>
					<p className="mhn">
						{/* <StudioBaselineStatus studioId={renderProps.studioId} /> */}
						{t('Studio Baseline needs update: ')}&nbsp;
						{needsUpdate ? (
							<>
								<Tooltip
									overlay={t('Baseline needs reload, this studio may not work until reloaded')}
									visible={getHelpMode()}
									placement="right"
								>
									<span>{t('Yes')}</span>
								</Tooltip>
							</>
						) : (
							t('No')
						)}
					</p>
					<p className="mhn">
						<button
							className="btn btn-primary"
							onClick={() => {
								MeteorCall.playout
									.updateStudioBaseline(renderProps.studioId)
									.then((result) => {
										updateNeedsUpdate(!!result)
										// "Reload page", to get the GUI to display the new baseline needsUpdate-status:
										history.goBack()
										history.goForward()
									})
									.catch((err) => {
										console.error('Failed to update studio baseline', err)
										updateNeedsUpdate(true)
									})
							}}
						>
							{t('Reload Baseline')}
						</button>
					</p>
				</>
			)
		},
		renderProps: {
			t: props.t,
			studioId: props.studio._id,
		},
		getSearchString: '',
	})
}
