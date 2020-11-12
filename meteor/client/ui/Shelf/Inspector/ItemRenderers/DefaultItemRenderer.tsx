import * as React from 'react'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'
import * as classNames from 'classnames'
import { RundownAPI } from '../../../../../lib/api/rundown'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import InspectorTitle from './InspectorTitle'
import { Studio } from '../../../../../lib/collections/Studios'
import { MediaObject } from '../../../../../lib/collections/MediaObjects'
import { BucketAdLibUi } from '../../RundownViewBuckets'

export default function DefaultItemRenderer(props: {
	piece: PieceUi | AdLibPieceUi | BucketAdLibUi
	showStyleBase: ShowStyleBase
	studio: Studio
}): JSX.Element {
	if (RundownUtils.isAdLibPiece(props.piece)) {
		const piece = props.piece as AdLibPieceUi
		// const layer = props.showStyleBase.sourceLayers.find((layer) => layer._id === piece.sourceLayerId)
		const metadata = piece.contentMetaData as MediaObject

		return (
			<>
				<InspectorTitle piece={props.piece} showStyleBase={props.showStyleBase} studio={props.studio} />
				{metadata && metadata.mediaId ? metadata.mediaId : null}
				<dl>
					<dd>name</dd>
					<dt>{piece.name}</dt>
					<dd>externalId</dd>
					<dt>{piece.externalId}</dt>
					<dd>partId</dd>
					<dt>{piece.partId}</dt>
					<dd>sourceLayerId</dd>
					<dt>{piece.sourceLayerId}</dt>
					<dd>outputLayerId</dd>
					<dt>{piece.outputLayerId}</dt>
					<dd>metaData</dd>
					<dt>{JSON.stringify(piece.metaData || {})}</dt>
				</dl>
			</>
		)
	} else {
		const piece = props.piece.instance.piece as Piece
		const metadata = props.piece.contentMetaData as MediaObject

		return (
			<>
				<InspectorTitle piece={props.piece} showStyleBase={props.showStyleBase} studio={props.studio} />
				{metadata && metadata.mediaId ? metadata.mediaId : null}
				<dl>
					<dd>name</dd>
					<dt>{piece.name}</dt>
					<dd>externalId</dd>
					<dt>{piece.externalId}</dt>
					<dd>startPartId</dd>
					<dt>{piece.startPartId}</dt>
					<dd>sourceLayerId</dd>
					<dt>{piece.sourceLayerId}</dt>
					<dd>outputLayerId</dd>
					<dt>{piece.outputLayerId}</dt>
					<dd>metaData</dd>
					<dt>{JSON.stringify(piece.metaData || {})}</dt>
				</dl>
			</>
		)
	}
}
