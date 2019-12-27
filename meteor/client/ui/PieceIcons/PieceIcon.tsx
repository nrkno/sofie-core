import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData';
import { MeteorReactComponent } from '../../lib/MeteorReactComponent';
import * as React from 'react';
import { Piece, Pieces } from '../../../lib/collections/Pieces';
import {
	SourceLayerType,
	ISourceLayer
} from 'tv-automation-sofie-blueprints-integration';
import { normalizeArray } from '../../../lib/lib';
import * as _ from 'underscore';

import CamInputIcon from './Renderers/CamInput';
import VTInputIcon from './Renderers/VTInput';
import SplitInputIcon from './Renderers/SplitInput';
import RemoteInputIcon from './Renderers/RemoteInput';
import LiveSpeakInputIcon from './Renderers/LiveSpeakInput';
import GraphicsInputIcon from './Renderers/GraphicsInput';
import { Meteor } from 'meteor/meteor';
import { ShowStyleBases } from '../../../lib/collections/ShowStyleBases';
import { PubSub } from '../../../lib/api/pubsub';

interface IPropsHeader {
	partId: string;
	rundownId: string;
	showStyleBaseId: string;
}

interface INamePropsHeader extends IPropsHeader {
	partSlug: string;
}

export const PieceNameContainer = withTracker((props: INamePropsHeader) => {
	let pieces = Pieces.find({ partId: props.partId }).fetch();

	let showStyleBase = ShowStyleBases.findOne(props.showStyleBaseId);

	let sourceLayers = showStyleBase
		? normalizeArray<ISourceLayer>(
				showStyleBase.sourceLayers.map((layer) => {
					return _.clone(layer);
				}),
				'_id'
		  )
		: {};
	let foundSourceLayer: ISourceLayer | undefined;
	let foundPiece: Piece | undefined;
	const supportedLayers = new Set([
		SourceLayerType.GRAPHICS,
		SourceLayerType.LIVE_SPEAK,
		SourceLayerType.VT
	]);

	for (const piece of pieces) {
		let layer = sourceLayers[piece.sourceLayerId];
		if (!layer) continue;
		if (foundSourceLayer && foundPiece) {
			if (
				layer.onPresenterScreen &&
				foundSourceLayer._rank >= layer._rank &&
				supportedLayers.has(layer.type)
			) {
				foundSourceLayer = layer;
				if (
					piece.enable &&
					foundPiece.enable &&
					(piece.enable.start || 0) > (foundPiece.enable.start || 0) // TODO: look into this, what should the do, really?
				) {
					foundPiece = piece;
				}
			}
		} else if (layer.onPresenterScreen && supportedLayers.has(layer.type)) {
			foundSourceLayer = layer;
			foundPiece = piece;
		}
	}

	return {
		sourceLayer: foundSourceLayer,
		piece: foundPiece
	};
})(
	class extends MeteorReactComponent<
		INamePropsHeader & { sourceLayer: ISourceLayer; piece: Piece }
	> {
		_pieceSubscription: Meteor.SubscriptionHandle;

		componentWillMount() {
			this.subscribe(PubSub.piecesSimple, {
				rundownId: this.props.rundownId
			});
			this.subscribe(PubSub.showStyleBases, {
				_id: this.props.showStyleBaseId
			});
		}

		render() {
			if (this.props.sourceLayer) {
				switch (this.props.sourceLayer.type) {
					case SourceLayerType.GRAPHICS:
					case SourceLayerType.LIVE_SPEAK:
					case SourceLayerType.VT:
						return this.props.piece.name;
				}
			}
			return this.props.partSlug.split(';')[1] || '';
		}
	}
);

export const PieceIconContainer = withTracker((props: IPropsHeader) => {
	// console.log(props)
	let pieces = Pieces.find({ partId: props.partId }).fetch();
	let showStyleBase = ShowStyleBases.findOne(props.showStyleBaseId);

	let sourceLayers = showStyleBase
		? normalizeArray<ISourceLayer>(
				showStyleBase.sourceLayers.map((layer) => {
					return _.clone(layer);
				}),
				'_id'
		  )
		: {};
	let foundSourceLayer: ISourceLayer | undefined;
	let foundPiece: Piece | undefined;
	const supportedLayers = new Set([
		SourceLayerType.GRAPHICS,
		SourceLayerType.LIVE_SPEAK,
		SourceLayerType.REMOTE,
		SourceLayerType.SPLITS,
		SourceLayerType.VT,
		SourceLayerType.CAMERA
	]);

	for (const piece of pieces) {
		let layer = sourceLayers[piece.sourceLayerId];
		if (!layer) continue;
		if (layer.onPresenterScreen && supportedLayers.has(layer.type)) {
			if (foundSourceLayer && foundPiece) {
				if (foundSourceLayer._rank >= layer._rank) {
					foundSourceLayer = layer;
					if (
						piece.enable &&
						foundPiece.enable &&
						(piece.enable.start || 0) >
							(foundPiece.enable.start || 0) // TODO: look into this, what should the do, really?
					) {
						foundPiece = piece;
					}
				}
			} else {
				foundSourceLayer = layer;
				foundPiece = piece;
			}
		}
	}

	return {
		sourceLayer: foundSourceLayer,
		piece: foundPiece
	};
})(
	class extends MeteorReactComponent<
		IPropsHeader & { sourceLayer: ISourceLayer; piece: Piece }
	> {
		_pieceSubscription: Meteor.SubscriptionHandle;

		componentWillMount() {
			this.subscribe(PubSub.piecesSimple, {
				rundownId: this.props.rundownId
			});
			this.subscribe(PubSub.showStyleBases, {
				_id: this.props.showStyleBaseId
			});
		}

		render() {
			if (this.props.sourceLayer) {
				switch (this.props.sourceLayer.type) {
					case SourceLayerType.GRAPHICS:
						return (
							<GraphicsInputIcon
								abbreviation={
									this.props.sourceLayer.abbreviation
								}
							/>
						);
					case SourceLayerType.LIVE_SPEAK:
						return (
							<LiveSpeakInputIcon
								abbreviation={
									this.props.sourceLayer.abbreviation
								}
							/>
						);
					case SourceLayerType.REMOTE:
						return (
							<RemoteInputIcon
								inputIndex={parseInt(
									(this.props.piece || {}).name
										.toString()
										.split(' ')
										.slice(-1)[0],
									10
								)}
								abbreviation={
									this.props.sourceLayer.abbreviation
								}
							/>
						);
					case SourceLayerType.SPLITS:
						return (
							<SplitInputIcon
								abbreviation={
									this.props.sourceLayer.abbreviation
								}
								piece={this.props.piece}
							/>
						);
					case SourceLayerType.VT:
						return (
							<VTInputIcon
								abbreviation={
									this.props.sourceLayer.abbreviation
								}
							/>
						);
					case SourceLayerType.CAMERA:
						return (
							<CamInputIcon
								inputIndex={parseInt(
									(this.props.piece || {}).name
										.toString()
										.split(' ')
										.slice(-1)[0],
									10
								)}
								abbreviation={
									this.props.sourceLayer.abbreviation
								}
							/>
						);
				}
			}
			return null;
		}
	}
);
