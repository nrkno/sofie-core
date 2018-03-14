import { Meteor }            from 'meteor/meteor';
import * as React            from 'react';
import * as ReactDOM         from 'react-dom';
import {withTracker}         from '../lib/ReactMeteorData/react-meteor-data';

import * as ClassNames       from 'classnames';
import {Time}                from '../../lib/lib';

/** The type of the source layer, used to enable specific functions for special-type layers */
export enum SourceLayerType {
	        UNKNOWN = 0,
	         CAMERA = 1,
	             VT = 2,
	         REMOTE = 3,
	         SCRIPT = 4,
	       GRAPHICS = 5,
	CAMERA_MOVEMENT = 6,
	          AUDIO = 7,
	       METADATA = 8
}

/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayer {
	_id: String,
	/** User-presentable name for the source layer */
	name: String,
	type: SourceLayerType
}

/** A layer group, f.g. PGM, Studio Monitor 1, etc. */
export interface ILayerOutputGroup {
	_id: String,
	/** User-presentable name for the layer output group */
	name: String,
	/** A utility flag to make sure that the PGM channel is always on top */
	isPGM: Boolean,
	expanded: Boolean
}

/** A set of available layer groups in a given installation */
export interface IStudioInstallation {
	_id: String,
	/** All available layer groups in a given installation */
	layerGroups: Array<ILayerOutputGroup>
}

/** This is a very uncomplete mock-up of the Rundown object */
export interface IRundown {
	_id: String,
	name: String,
	created: Time,
	segments: Array<ISegment>,
	liveSegment: ISegment,
	nextSegment: ISegment,
	// There should be something like a Owner user here somewhere?
}

/** A "Title" in ENPS Lingo. */
export interface ISegment {
	_id: String,
	name: String,
	isLive: Boolean,
	isNext: Boolean,
	timeline: ITimeline
}

/** A timeline of the events within a Segment */
export interface ITimeline {
	objects: Array<ITimelineItem>,
	currentTime: Number,
	/** If nextItem is null, the timeline should be considered "ending" and next Segment should be played afterwards */
	nextItem: ITimelineItem,
}

/** A trigger interface compatible with that of supertimeline */
export interface ITimelineTrigger {
	type: number,
	value: number|string
}

/** A generic list of playback availability statuses for a source layer */
export enum TimelineItemStatusCode {
	/** No fault with item, can be played */
	            OK = 0,
	/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
	SOURCE_MISSING = 1,
	/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
	 SOURCE_BROKEN = 2,
	/** The item has been manually marked as faulty */
	   DEACTIVATED = 3
}

/** An item in the timeline */
export interface ITimelineItem {
	_id: String,
	/** User-presentable name for the timeline item */
	name: String,
	/** Timeline item trigger. Possibly, most of these will be manually triggered as next, but maybe some will be automatic. */
	trigger: ITimelineTrigger,
	/** Playback availability status */
	status: TimelineItemStatusCode,
	/** Source layer the timeline item belongs to */
	sourceLayer: ISourceLayer
	/** Expected duration of the item as planned or as estimated by the system (in case of Script layers), in seconds. */
	expectedDuration: Number,
	/** Actual duration of the item, in seconds. This value will be updated during playback for some types of items. */
	duration: Number
}

export interface ISegmentItemPropsHeader {
	key: string,
	segment: ISegment,
	installation: IStudioInstallation
}
export class SegmentItem extends React.Component<ISegmentItemPropsHeader> {
	render() {
    return (
			<div className="segment-item">

			</div>
		)
	}
}

interface ISegmentTimelinePropsHeader {
	key: string,
	segment: ISegment,
	installation: IStudioInstallation
}
export class SegmentTimeline extends React.Component<ISegmentTimelinePropsHeader> {
	render() {
    return (
			<div className="segment-timeline">

			</div>
		)
	}
}

interface ILayerOutputGroupPropsHeader {
	key: string,
	layerOutput: ILayerOutputGroup
}
export class LayerOutputGroup extends React.Component<ILayerOutputGroupPropsHeader> {
	render() {
    return (
			<div className="layer-output-group">

			</div>
		)
	}
}


interface ITimelineLayerPropsHeader {
	key: string,
	layer: ISourceLayer,
	collapsed?: Boolean
}
export class TimelineLayer extends React.Component<ITimelineLayerPropsHeader> {
	render() {
    return (
			<div className="timeline-layer">

			</div>
		)
	}
}
