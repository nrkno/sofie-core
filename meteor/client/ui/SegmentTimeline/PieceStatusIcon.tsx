import * as React from 'react'
import { NoticeLevel } from '../../lib/notifications/notifications'
import { WarningIcon, CriticalIcon } from '../../lib/notificationIcons'

export interface IProps {
	noticeLevel: NoticeLevel
}

export function PieceStatusIcon(props: IProps) {
	return (
		<div className="piece__status-icon">
			{props.noticeLevel === NoticeLevel.CRITICAL ? (
				<CriticalIcon />
			) : props.noticeLevel === NoticeLevel.WARNING ? (
				<WarningIcon />
			) : null}
		</div>
	)
}
