import React from 'react'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { WarningIconSmall, HourglassIconSmall, OKIconSmall } from '../../lib/ui/icons/notifications'

export function MediaStatusIndicator({
	status,
}: {
	status: PieceStatusCode | undefined
	overlay: string | undefined
}): JSX.Element | null {
	switch (status) {
		case PieceStatusCode.OK:
			return <OKIconSmall />
		case PieceStatusCode.SOURCE_NOT_READY:
			return <HourglassIconSmall />
		case PieceStatusCode.SOURCE_BROKEN:
		case PieceStatusCode.SOURCE_HAS_ISSUES:
		case PieceStatusCode.SOURCE_MISSING:
		case PieceStatusCode.SOURCE_NOT_SET:
		case PieceStatusCode.UNKNOWN:
		case undefined:
		case PieceStatusCode.SOURCE_UNKNOWN_STATE:
			return <WarningIconSmall />
		default:
			assertNever(status)
			return <>Unknown: {status}</>
	}
}
