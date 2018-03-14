import { Meteor }            from 'meteor/meteor';
import * as React            from 'react';
import * as ReactDOM         from 'react-dom';
import {withTracker}         from '../lib/ReactMeteorData/react-meteor-data';

import * as ClassNames       from 'classnames';
import {Time}                from '../../lib/lib';
import {StudioInstallation,
        ISourceLayer,
        ILayerOutput}        from '../../lib/collections/StudioInstallations';
import {SegmentLine}         from '../../lib/collections/SegmentLines';
import {ISegmentLineItem}    from '../../lib/collections/SegmentLineItems';
import {Segment}             from '../../lib/collections/Segments';

export interface ISegmentLineItemPropsHeader {
	key: string,
	segmentLineItem: ISegmentLineItem,
	installation: StudioInstallation
}
export class SegmentLineItem extends React.Component<ISegmentLineItemPropsHeader> {
	render() {
    return (
			<div className="segment-line-item">

			</div>
		)
	}
}

interface ISegmentTimelinePropsHeader {
	key: string,
	segment: Segment,
	installation: StudioInstallation
	isLive: Boolean,
	isNext: Boolean
}
export class SegmentBox extends React.Component<ISegmentTimelinePropsHeader> {
	render() {
    return (
			<div className="segment">

			</div>
		)
	}
}

interface ILayerOutputGroupPropsHeader {
	key: string,
	layerOutput: ILayerOutput,
	installation: StudioInstallation,
	segmentLines: Array<SegmentLine>
	collapsed?: Boolean,
}
export class LayerOutputGroup extends React.Component<ILayerOutputGroupPropsHeader> {
	render() {
    return (
			<div className="layer-output-group">

			</div>
		)
	}
}


interface IInputLayerTimelinePropsHeader {
	key: string,
	layer: ISourceLayer,
	segmentLines: Array<SegmentLine>
	collapsed?: Boolean,
}
export class InputLayerTimeline extends React.Component<IInputLayerTimelinePropsHeader> {
	render() {
    return (
			<div className="input-layer-timeline">

			</div>
		)
	}
}
