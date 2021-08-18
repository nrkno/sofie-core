import classNames from 'classnames'
import React from 'react'
import type Sorensen from 'sorensen'
import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { SorensenContext } from '../../../../../lib/SorensenContext'

function toTitleCase(input: string): string {
	const str = input.split(' ')
	for (let i = 0; i < str.length; i++) {
		str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1)
	}
	return str.join(' ')
}

export function codesToKeyLabels(keys: string, sorensen: typeof Sorensen) {
	return keys
		.split(/\s+/gi)
		.map((note) =>
			note
				.split(/\+/gi)
				.map((code) => toTitleCase(sorensen.getKeyForCode(code)))
				.join('+')
		)
		.join(' ')
}

export const HotkeyTrigger = ({
	keys,
	up,
	innerRef,
	selected,
	onClick,
}: {
	keys: string
	up: boolean
	innerRef?: React.Ref<HTMLDivElement>
	selected?: boolean
	onClick?: () => void
}) => {
	const Sorensen = useContext(SorensenContext)
	const { t } = useTranslation()

	if (Sorensen) {
		keys = codesToKeyLabels(keys, Sorensen)
	}

	return (
		<div
			ref={innerRef}
			className={classNames('triggered-action-entry__hotkey clickable', {
				selected: selected,
			})}
			onClick={onClick}
			tabIndex={0}
			role="button"
		>
			{keys ? keys : <i className="subtle">{t('Empty')}</i>}
			{up ? '⇪' : ''}
		</div>
	)
}
