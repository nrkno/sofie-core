import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { translate } from 'react-i18next'
import * as React from 'react'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { KeyboardPreview, KeyboardLayouts } from './KeyboardPreview'

interface IProps {
	visible?: boolean
	showStyleBase: ShowStyleBase
}

const _isMacLike = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? true : false

export const KeyboardPreviewPanel = translate()(class KeyboardPreviewPanel extends React.Component<Translated<IProps>> {
	constructor (props: Translated<IProps>) {
		super(props)
	}

	render () {
		if (this.props.visible) {
			return (
				<div className='adlib-panel super-dark adlib-panel--keyboard-preview'>
					<KeyboardPreview
						physicalLayout={KeyboardLayouts.STANDARD_102_TKL}
						showStyleBase={this.props.showStyleBase}
					/>
				</div>
			)
		} else {
			return null
		}
	}
})
