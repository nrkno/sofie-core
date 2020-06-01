import * as React from 'react'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { PieceGeneric } from '../../../../../lib/collections/Pieces'

export default function DefaultItemRenderer(props: { piece: PieceGeneric }): JSX.Element {
	const { externalId, name, partId, sourceLayerId, outputLayerId, metaData } = props.piece

	return (
		<dl>
			<dd>name</dd>
			<dt>{name}</dt>
			<dd>externalId</dd>
			<dt>{externalId}</dt>
			<dd>partId</dd>
			<dt>{partId}</dt>
			<dd>sourceLayerId</dd>
			<dt>{sourceLayerId}</dt>
			<dd>outputLayerId</dd>
			<dt>{outputLayerId}</dt>
			<dd>metaData</dd>
			<dt>{JSON.stringify(metaData || {})}</dt>
		</dl>
	)
}
