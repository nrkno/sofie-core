import { Meteor } from 'meteor/meteor'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { RundownAPI } from '../../lib/api/rundown'
import { Segment, Segments } from '../../lib/collections/Segments'

// These are temporary method to fill the rundown database with some sample data
// for development

Meteor.methods({
	'debug_sampleSetup' () {
		StudioInstallations.insert({
			_id: "studio0",
			name: "Dummy studio",
			layerGroups: [
				{
					_id: "studio0-pgm0",
					name: "PGM",
					isPGM: true,
				},
				{
					_id: "studio0-monitor0",
					name: "Studio 1",
					isPGM: false,
				}
			],
			sourceLayers: [
				{
					_id: "studio0-camera0",
					name: "Cams",
					type: RundownAPI.SourceLayerType.CAMERA,
					unlimited: false,
					onPGMClean: true,
				},
				{
					_id: "studio0-vt0",
					name: "VB",
					type: RundownAPI.SourceLayerType.VT,
					unlimited: true,
					onPGMClean: true,
				},
				{
					_id: "studio0-graphics0",
					name: "GFX",
					type: RundownAPI.SourceLayerType.GRAPHICS,
					unlimited: true,
					onPGMClean: false
				},
				{
					_id: "studio0-remote0",
					name: "RM1",
					type: RundownAPI.SourceLayerType.REMOTE,
					unlimited: false,
					onPGMClean: true
				}
			],
		});

		// Set all running orders without a studio installation to use the dummy one
		RunningOrders.update({studioInstallationId: { $not: { $exists: true } }}, {$set: { studioInstallationId: "studio0" }});
	},

	'debug_emptyDatabase' () {
		console.log("Clear the database");
		
		SegmentLineItems.remove({});
		SegmentLines.remove({});
		Segments.remove({});
		RunningOrders.remove({});
		ShowStyles.remove({});
		StudioInstallations.remove({});
	},

	'debug_sampleShowStyle' () {
		ShowStyles.insert({
			_id: "dummyShow0",
			name: "Dummy show style",
			splitConfigurations: [
				{
					// a still undefined split configuration object
				}
			],
			graphicsTemplates: [
				{
					// a still undefined graphics template object
				}
			],
			wipesAndBumpers: [
				{
					// a still undefined wipes and bumpers object
				}
			],
			logicalSegmentLineItems: [
				{
					// a still undefined logical objects definition object
				}
			]
		});

		RunningOrders.update({showStyleId: { $not: { $exists: true }}}, { $set: { showStyleId: "dummyShow0" }});
	}
})
