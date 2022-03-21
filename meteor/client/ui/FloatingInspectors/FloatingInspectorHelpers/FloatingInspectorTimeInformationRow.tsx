import React from 'react'
import { PieceInstancePiece } from '../../../../lib/collections/PieceInstances'
import { RundownUtils } from '../../../lib/rundown'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import * as _ from 'underscore'
import { useTranslation } from 'react-i18next'
import { Time } from '../../../../lib/lib'
import Moment from 'react-moment'

interface IProps {
	piece: Omit<PieceInstancePiece, 'timelineObjectsString'>
	pieceRenderedDuration: number | null
	pieceRenderedIn: number | null
	changed?: Time
}

export const FloatingInspectorTimeInformationRow: React.FunctionComponent<IProps> = (props: IProps) => {
	const durationText: string =
		!props.pieceRenderedDuration && !props.piece.enable.duration
			? getLifeSpanText(props.piece)
			: getDuration(props.piece, props.pieceRenderedDuration)

	return (
		<tr>
			<td className="mini-inspector__row--timing" />
			<td className="mini-inspector__row--timing">
				<span className="mini-inspector__in-point">
					{RundownUtils.formatTimeToShortTime(props.pieceRenderedIn || 0)}
				</span>
				<span className="mini-inspector__duration">{durationText}</span>

				{props.changed && (
					<span className="mini-inspector__changed">
						<Moment date={props.changed} calendar={true} />
					</span>
				)}
			</td>
		</tr>
	)
}

function getLifeSpanText(piece: Omit<PieceInstancePiece, 'timelineObjectsString'>): string {
	const { t } = useTranslation()
	switch (piece.lifespan) {
		case PieceLifespan.WithinPart:
			return t('Until next take')
		case PieceLifespan.OutOnSegmentChange:
			return t('Until next segment')
		case PieceLifespan.OutOnSegmentEnd:
			return t('Until end of segment')
		case PieceLifespan.OutOnRundownChange:
			return t('Until next rundown')
		case PieceLifespan.OutOnRundownEnd:
			return t('Until next rundown')
		case PieceLifespan.OutOnShowStyleEnd:
			return t('Until end of showstyle')
		default:
			return ''
	}
}

function getDuration(
	piece: Omit<PieceInstancePiece, 'timelineObjectsString'>,
	pieceRenderedDuration: number | null
): string {
	return RundownUtils.formatTimeToShortTime(
		pieceRenderedDuration ||
			(_.isNumber(piece.enable.duration) ? parseFloat(piece.enable.duration as any as string) : 0)
	)
}
