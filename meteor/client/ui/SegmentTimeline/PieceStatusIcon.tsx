import { CriticalIconSmall, WarningIconSmall } from '../../lib/notificationIcons'
import { NoticeLevel } from '../../lib/notifications/notifications'

export interface IProps {
	noticeLevel: NoticeLevel
}

export function PieceStatusIcon(props: IProps) {
	return (
		<div className="piece__status-icon">
			{props.noticeLevel === NoticeLevel.CRITICAL ? (
				<CriticalIconSmall />
			) : props.noticeLevel === NoticeLevel.WARNING ? (
				<WarningIconSmall />
			) : null}
		</div>
	)
}
