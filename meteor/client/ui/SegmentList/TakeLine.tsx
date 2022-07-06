import classNames from 'classnames'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface IProps {
	isNext: boolean
	autoNext: boolean
}

export const TakeLine: React.FC<IProps> = function TakeLine({ isNext, autoNext }) {
	const { t } = useTranslation()

	return (
		<div
			className={classNames('segment-opl__timeline-flag', 'segment-opl__take-line', {
				next: isNext,
				auto: autoNext,
			})}
		>
			{isNext && <div className="segment-opl__timeline-flag__label">{autoNext ? t('Auto') : t('Next')}</div>}
			{!isNext && autoNext && <div className="segment-opl__timeline-flag__auto">{t('Auto')}</div>}
		</div>
	)
}
