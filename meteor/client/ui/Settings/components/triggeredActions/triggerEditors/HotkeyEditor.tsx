import classNames from 'classnames'
import React, { useContext, useState } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DBBlueprintTrigger } from '../../../../../../lib/collections/TriggeredActions'
import { SorensenContext } from '../TriggeredActionsEditor'
import { codesToKeyLabels } from './HotkeyTrigger'

interface IProps {
	trigger: DBBlueprintTrigger
	onChange: (newVal: DBBlueprintTrigger) => void
}

export const HotkeyEditor = function HotkeyEditor({ trigger }: IProps) {
	const sorensen = useContext(SorensenContext)
	const [displayValue, setDisplayValue] = useState(trigger.keys)
	const [value, setValue] = useState(trigger.keys)
	const { t } = useTranslation()

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (sorensen) {
			const pressedKeys = sorensen.getPressedKeys().join('+')
			setValue(pressedKeys)
			setDisplayValue(codesToKeyLabels(pressedKeys, sorensen))
		}
		e.preventDefault()
	}

	function onBlur() {
		if (sorensen) {
			sorensen.poison()
		}
	}

	useEffect(() => {
		let processedKeys = trigger.keys
		if (sorensen) {
			processedKeys = codesToKeyLabels(processedKeys, sorensen)
		}
		setDisplayValue(processedKeys)
		setValue(trigger.keys)
	}, [trigger.keys, sorensen])

	return (
		<>
			<input
				type="text"
				className={classNames('form-control input text-input input-m', {
					bghl: value !== trigger.keys,
				})}
				value={displayValue}
				onKeyDown={onKeyDown}
				onBlur={onBlur}
				onChange={() => {}}
			/>
			<div className="mvs">
				<a
					className={classNames('switch-button', 'sb-nocolor', 'mrs', {
						'sb-on': trigger.up,
					})}
					role="button"
					onClick={() => (trigger.up = !trigger.up)}
					tabIndex={0}
				>
					<div className="sb-content">
						<div className="sb-label">
							<span className="mls">&nbsp;</span>
							<span className="mrs right">&nbsp;</span>
						</div>
						<div className="sb-switch"></div>
					</div>
				</a>
				<span>{t('On release')}</span>
			</div>
		</>
	)
}
