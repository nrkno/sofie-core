import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'

export interface ISettings {
	frameRate: number,
	defaultToCollapsedSegments: boolean,
	autoExpandCurrentNextSegment: boolean,
	autoRewindLeavingSegment: boolean,
	defaultTimeScale: number
}

export let Settings: ISettings

const DEFAULT_SETTINGS: ISettings = {
	'frameRate': 25,
	'defaultToCollapsedSegments': false,
	'autoExpandCurrentNextSegment': false,
	'autoRewindLeavingSegment': false,
	'defaultTimeScale': 1
}

Settings = _.clone(DEFAULT_SETTINGS)

Meteor.startup(() => {
	Settings = _.extend(Settings, Meteor.settings.public)
})
