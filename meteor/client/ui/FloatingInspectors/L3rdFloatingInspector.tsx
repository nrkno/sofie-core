import React from 'react'
import * as _ from 'underscore'
import { useTranslation } from 'react-i18next'

import { RundownUtils } from '../../lib/rundown'
import Moment from 'react-moment'

import { PieceLifespan, NoraContent } from '@sofie-automation/blueprints-integration'

import { NoraFloatingInspector } from './NoraFloatingInspector'
import { FloatingInspector } from '../FloatingInspector'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { Time } from '../../../lib/lib'

interface IProps {
	piece: PieceUi
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	content: NoraContent | undefined
	floatingInspectorStyle: React.CSSProperties
	typeClass?: string
}

type KeyValue = { key: string; value: string }

export const L3rdFloatingInspector: React.FunctionComponent<IProps> = ({
	content: noraContent,
	floatingInspectorStyle,
	showMiniInspector,
	itemElement,
	piece,
	typeClass,
}) => {
	const { t } = useTranslation()
	const innerPiece = piece.instance.piece

	let properties: Array<KeyValue> = []
	if (noraContent && noraContent.payload && noraContent.payload.content) {
		properties = _.compact(
			_.map(noraContent.payload.content, (value, key: string):
				| {
						key: string
						value: string
				  }
				| undefined => {
				let str: string
				if (key.startsWith('_') || key.startsWith('@') || value === '') {
					return undefined
				} else {
					if (_.isObject(value)) {
						// @ts-ignore
						str = JSON.stringify(value, '', 2)
					} else {
						str = value + ''
					}
					return {
						key: key,
						value: str,
					}
				}
			})
		) as Array<KeyValue>
	}

	let changed: Time | undefined = undefined
	if (noraContent && noraContent.payload && noraContent.payload.changed) {
		changed = noraContent.payload.changed
	}

	let templateName
	let templateVariant

	if (noraContent && noraContent.payload && noraContent.payload.metadata && noraContent.payload.metadata.templateName) {
		templateName = noraContent.payload.metadata.templateName
	}

	if (
		noraContent &&
		noraContent.payload &&
		noraContent.payload.metadata &&
		noraContent.payload.metadata.templateVariant
	) {
		templateVariant = noraContent.payload.metadata.templateVariant
	}

	return noraContent && noraContent.payload && noraContent.previewRenderer ? (
		showMiniInspector && !!itemElement ? (
			<NoraFloatingInspector noraContent={noraContent} style={floatingInspectorStyle} />
		) : null
	) : (
		<FloatingInspector shown={showMiniInspector && !!itemElement}>
			<div className={'segment-timeline__mini-inspector ' + typeClass} style={floatingInspectorStyle}>
				{templateName && (
					<div className="mini-inspector__header">
						{templateName}
						{templateVariant && <span className="mini-inspector__sub-header">{templateVariant}</span>}
					</div>
				)}
				<table>
					<tbody>
						{properties.map((item) => (
							<tr key={item.key}>
								<td className="mini-inspector__label">{item.key}</td>
								<td className="mini-inspector__value">{item.value}</td>
							</tr>
						))}
						<tr>
							<td className="mini-inspector__row--timing"></td>
							<td className="mini-inspector__row--timing">
								<span className="mini-inspector__in-point">
									{RundownUtils.formatTimeToShortTime(piece.renderedInPoint || 0)}
								</span>
								{innerPiece.lifespan ? (
									(innerPiece.lifespan === PieceLifespan.WithinPart && (
										<span className="mini-inspector__duration">{t('Until next take')}</span>
									)) ||
									(innerPiece.lifespan === PieceLifespan.OutOnSegmentChange && (
										<span className="mini-inspector__duration">{t('Until next segment')}</span>
									)) ||
									(innerPiece.lifespan === PieceLifespan.OutOnSegmentEnd && (
										<span className="mini-inspector__duration">{t('Until end of segment')}</span>
									)) ||
									(innerPiece.lifespan === PieceLifespan.OutOnRundownChange && (
										<span className="mini-inspector__duration">{t('Until next rundown')}</span>
									)) ||
									(innerPiece.lifespan === PieceLifespan.OutOnRundownEnd && (
										<span className="mini-inspector__duration">{t('Until end of rundown')}</span>
									))
								) : (
									<span className="mini-inspector__duration">
										{RundownUtils.formatTimeToShortTime(
											piece.renderedDuration ||
												(_.isNumber(innerPiece.enable.duration)
													? parseFloat((innerPiece.enable.duration as any) as string)
													: 0)
										)}
									</span>
								)}
								{changed && (
									<span className="mini-inspector__changed">
										<Moment date={changed} calendar={true} />
									</span>
								)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</FloatingInspector>
	)
}
