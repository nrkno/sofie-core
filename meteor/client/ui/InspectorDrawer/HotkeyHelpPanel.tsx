import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { translate } from 'react-i18next'
import * as React from 'react'

interface IProps {
	visible?: boolean

	hotkeys: Array<{
		key: string
		label: string
	}>
}

export const HotkeyHelpPanel = translate()(class BaseHotkeyHelpPanel extends React.Component<Translated<IProps>> {
	private _isMacLike: boolean = false

	constructor (props: Translated<IProps>) {
		super(props)

		this._isMacLike = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? true : false
	}

	render () {
		if (this.props.visible) {
			return (
				<div className='adlib-panel super-dark'>
					<div className='adlib-panel__hotkeys'>
						{this.props.hotkeys.map((hotkey) =>
							<div className='adlib-panel__hotkeys__hotkey' key={hotkey.key}>
								<div className='adlib-panel__hotkeys__hotkey__keys'>
									{this.shortcutProcessor(hotkey.key)}
								</div>
								<div className='adlib-panel__hotkeys__hotkey__action'>
									{hotkey.label}
								</div>
							</div>
						)}
					</div>
				</div>
			)
		} else {
			return null
		}
	}

	private shortcutProcessor (hotkey: string): string {
		if (this._isMacLike) {
			hotkey = hotkey.replace(/mod/i, '\u2318')
		} else {
			hotkey = hotkey.replace(/mod/i, 'Ctrl')
		}
		// capitalize first letter of each combo key
		hotkey = hotkey.replace(/(\w)\w*/ig, (substring: string) => {
			return substring.substr(0, 1).toUpperCase() + substring.substr(1)
		})

		return hotkey
	}
})
