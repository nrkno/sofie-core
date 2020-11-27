import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { withTranslation } from 'react-i18next'
import * as React from 'react'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { KeyboardPreview } from './KeyboardPreview'
import { Settings } from '../../../lib/Settings'
import { KeyboardLayouts } from '../../../lib/keyboardLayout'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import * as _ from 'underscore'
import {
	RundownLayoutBase,
	RundownLayoutKeyboardPreview,
	DashboardLayoutKeyboardPreview,
} from '../../../lib/collections/RundownLayouts'

interface IProps {
	visible?: boolean
	layout?: RundownLayoutBase
	panel?: RundownLayoutKeyboardPreview
	showStyleBase: ShowStyleBase
}

const _isMacLike = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? true : false

export const KeyboardPreviewPanel = withTranslation()(
	class KeyboardPreviewPanel extends React.Component<Translated<IProps>> {
		constructor(props: Translated<IProps>) {
			super(props)
		}

		render() {
			if (this.props.visible) {
				return (
					<div
						className="adlib-panel super-dark adlib-panel--keyboard-preview"
						style={_.extend(
							this.props.layout && RundownLayoutsAPI.isDashboardLayout(this.props.layout)
								? dashboardElementPosition(this.props.panel as DashboardLayoutKeyboardPreview)
								: {},
							{
								visibility: this.props.visible ? 'visible' : 'hidden',
							}
						)}>
						<KeyboardPreview
							physicalLayout={KeyboardLayouts.nameToPhysicalLayout(Settings.keyboardMapLayout)}
							showStyleBase={this.props.showStyleBase}
						/>
					</div>
				)
			} else {
				return null
			}
		}
	}
)
