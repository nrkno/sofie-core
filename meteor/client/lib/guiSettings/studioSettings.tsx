import React from 'react'
import { TFunction } from 'react-i18next'
import { GUISetting, GUISettings, GUISettingsType } from './guiSettings'
import { Studio } from '../../../lib/collections/Studios'
import { EditAttribute, IEditAttribute } from '../EditAttribute'
import { ShowStyleBases, Studios } from '../../collections'
import { RedirectToShowStyleButton, defaultEditAttributeProps } from './lib'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { useTracker } from '../ReactMeteorData/ReactMeteorData'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { StudioBaselineStatus } from '../../ui/Settings/Studio/Baseline'
import { useHistory } from 'react-router-dom'
import { MeteorCall } from '../../../lib/api/methods'

export function generateStudioSettings(t: TFunction, studio: Studio): GUISettings {
	const settings: GUISettings = { list: [] }

	settings.list.push({
		type: GUISettingsType.SECTION,
		name: 'Generic Properties',
		id: 'generic',

		getList: () => genericProperties(t, studio, 'generic'),
		getSearchString: '',
		// renderSummary?: () => JSX.Element
	})

	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Attached Devices',

	// 	getList: () => (GUISetting | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })

	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Blueprint Configuration',

	// 	getList: () => (GUISetting | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })

	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Layer mappings',

	// 	getList: () => (GUISetting | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })
	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Route sets',

	// 	getList: () => (GUISetting | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })

	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Package Manager',

	// 	getList: () => (GUISetting | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })

	return settings
}

function getDefaultEditAttributeProps(studio: Studio) {
	return literal<Partial<IEditAttribute>>({
		...defaultEditAttributeProps,
		obj: studio,
		collection: Studios,
	})
}

function genericProperties(t: TFunction, studio: Studio, urlBase: string) {
	const settings: GUISetting[] = []

	const editAttributeProps = getDefaultEditAttributeProps(studio)

	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Studio Name'),
		description: t('Name of the studio'),
		id: `${urlBase}/name`,
		getWarning: () => {
			return !studio.name && t('No name set')
		}, // json {requires: []}, minLength: 1, maxLength: 255
		render: () => <EditAttribute {...editAttributeProps} attribute="name" type="text" />,
		getSearchString: studio.name,
		// ui-widget: textEdit
	})

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
	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Compatible Show Styles'),
		description: t('Which Show Styles are compatible with this studio'),
		id: `${urlBase}/blueprint`,
		getWarning: () => {
			return studio.supportedShowStyleBase.length === 0 && t('Show style not set')
		},
		render: () => {
			const availableShowStyleBases = useTracker(() => getAvailableShowStyleBases(), [], [])
			return (
				<>
					<EditAttribute
						{...editAttributeProps}
						type="multiselect"
						attribute="supportedShowStyleBase"
						options={availableShowStyleBases}
						label={t('Click to show available Show Styles')}
					/>
					{renderShowStyleEditButtons(studio, availableShowStyleBases)}
					<NewShowStyleButton />
				</>
			)
		},
		getSearchString: getAvailableShowStyleBases()
			.map((s) => s.name)
			.join(' '),
	})

	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Frame rate'),
		description: t('What frame rate (fps) the studio is running at.'),
		id: `${urlBase}/settings.frameRate`,
		// getWarning: () => undefined,
		render: () => {
			return <EditAttribute {...editAttributeProps} type="int" attribute="settings.frameRate" />
		},
		getSearchString: `${studio.settings.frameRate}`,
	})
	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Enable "Play from Anywhere"'),
		description: t('When enabled, the "play from anywhere" option is available to the users in rundown-GUI'),
		id: `${urlBase}/settings.enablePlayFromAnywhere`,
		// getWarning: () => undefined,
		render: () => {
			return <EditAttribute {...editAttributeProps} type="checkbox" attribute="settings.enablePlayFromAnywhere" />
		},
		getSearchString: '',
	})
	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Media Preview URL'),
		description: t('URL to endpoint where media preview are exposed'),
		id: `${urlBase}/settings.mediaPreviewsUrl`,
		// getWarning: () => undefined,
		render: () => {
			return <EditAttribute {...editAttributeProps} type="text" attribute="settings.mediaPreviewsUrl" />
		},
		getSearchString: studio.settings.mediaPreviewsUrl,
	})
	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Slack Webhook URLs'),
		description: t('URLs for slack webhook to send evaluations'),
		id: `${urlBase}/settings.slackEvaluationUrls`,
		// getWarning: () => undefined,
		render: () => {
			return <EditAttribute {...editAttributeProps} type="text" attribute="settings.slackEvaluationUrls" />
		},
		getSearchString: studio.settings.slackEvaluationUrls + '',
	})
	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Supported Media Formats'),
		description: t(
			'Media Resolutions supported by the studio for media playback. Example: "1920x1080i5000,1920x1080i2500,1920x1080p2500,1920x1080p5000"'
		),
		id: `${urlBase}/settings.supportedMediaFormats`,
		// getWarning: () => undefined,
		render: () => {
			return <EditAttribute {...editAttributeProps} type="text" attribute="settings.supportedMediaFormats" />
		},
		getSearchString: studio.settings.supportedMediaFormats + '',
	})
	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Audio Stream Formats supported by the studio for media playback. (Example: "2,4,8,16")'),
		description: t(
			'Media Resolutions supported by the studio for media playback. Example: "1920x1080i5000,1920x1080i2500,1920x1080p2500,1920x1080p5000"'
		),
		id: `${urlBase}/settings.supportedAudioStreams`,
		// getWarning: () => undefined,
		render: () => {
			return <EditAttribute {...editAttributeProps} type="text" attribute="settings.supportedAudioStreams" />
		},
		getSearchString: studio.settings.supportedAudioStreams + '',
	})
	// settings.forceMultiGatewayMode
	// settings.multiGatewayNowSafeLatency
	// settings.preserveUnsyncedPlayingSegmentContents
	// settings.allowRundownResetOnAir
	// settings.preserveOrphanedSegmentPositionInRundown

	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Studio Baseline needs update'),
		// description: t(''),
		id: `${urlBase}/studio-baseline-needs-update`,
		getWarning: () => undefined,
		render: () => {
			return (
				<>
					<StudioBaselineStatus studioId={studio._id} />
				</>
			)
		},
		getSearchString: '',
	})

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
