import { addMigrationStep, MigrationStep, addMigrationSteps, MigrationStepBase } from './databaseMigration'
import { StudioInstallation, StudioInstallations, DBStudioInstallation } from '../lib/collections/StudioInstallations'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { MigrationStepInput, MigrationStepInputFilteredResult } from '../lib/api/migration'
import { Collections, objectPathGet } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import { ShowStyles } from '../lib/collections/ShowStyles'
import { RunningOrderAPI } from '../lib/api/runningOrder'
import { PlayoutDeviceType } from '../lib/collections/PeripheralDevices'
import { LookaheadMode } from '../lib/api/playout'

/**
 * This file contains all system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */
function ensureCollectionProperty<T = any> (
	collectionName: string,
	selector: Mongo.Selector<T>,
	property: string,
	value: any | null, // null if manual
	inputType?: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch', // EditAttribute types
	label?: string,
	description?: string,
	defaultValue?: any
): MigrationStepBase {
	let collection: Mongo.Collection<T> = Collections[collectionName]
	if (!collection) throw new Meteor.Error(404, `Collection ${collectionName} not found`)

	return {
		id: `${collectionName}.${property}`,
		canBeRunAutomatically: (_.isNull(value) ? false : true),
		validate: () => {
			let objects = collection.find(selector).fetch()
			let propertyMissing: string | boolean = false
			_.each(objects, (obj: any) => {
				if (!objectPathGet(obj, property)) propertyMissing = `${property} is missing on ${obj._id}`
			})

			return propertyMissing
		},
		input: () => {
			let objects = collection.find(selector).fetch()

			let inputs: Array<MigrationStepInput> = []
			_.each(objects, (obj: any) => {

				let localLabel = (label + '').replace(/\$id/g, obj._id)
				let localDescription = (description + '').replace(/\$id/g, obj._id)
				if (inputType && !obj[property]) {
					inputs.push({
						label: localLabel,
						description: localDescription,
						inputType: inputType,
						attribute: obj._id,
						defaultValue: defaultValue
					})
				}
			})
			return inputs
		},
		migrate: (input: MigrationStepInputFilteredResult) => {

			if (value) {
				let objects = collection.find(selector).fetch()
				_.each(objects, (obj: any) => {
					let m = {}
					m[property] = value
					collection.update(obj._id,{$set: m })
				})
			} else {
				_.each(input, (value, objectId: string) => {
					let m = {}
					m[property] = value
					collection.update(objectId,{$set: m })
				})
			}
		}
	}
}

// 0.0.1: These are the "default" migration steps

addMigrationSteps( '1.0.0', [
	{
		id: 'studio exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!StudioInstallations.findOne()) return 'No StudioInstallation found'
			return false
		},
		migrate: () => {
			// create default studio
			StudioInstallations.insert({
				_id: 'studio0',
				name: 'Default studio',
				defaultShowStyle: 'show0',
				outputLayers: [
					{
						_id: 'studio0-pgm0',
						_rank: 0,
						name: 'PGM',
						isPGM: true,
					},
					{
						_id: 'studio0-monitor0',
						_rank: 1,
						name: 'Skjerm',
						isPGM: false,
					}
				],
				sourceLayers: [
					{
						_id: 'studio0-lower-third0',
						_rank: 10,
						name: 'Super',
						type: RunningOrderAPI.SourceLayerType.LOWER_THIRD,
						unlimited: true,
						onPGMClean: false
					},
					{
						_id: 'studio0-split0',
						_rank: 15,
						name: 'Split',
						type: RunningOrderAPI.SourceLayerType.SPLITS,
						unlimited: false,
						onPGMClean: true,
					},
					{
						_id: 'studio0-graphics0',
						_rank: 20,
						name: 'GFX',
						type: RunningOrderAPI.SourceLayerType.GRAPHICS,
						unlimited: true,
						onPGMClean: false
					},
					{
						_id: 'studio0-live-speak0',
						_rank: 50,
						name: 'STK',
						type: RunningOrderAPI.SourceLayerType.LIVE_SPEAK,
						unlimited: true,
						onPGMClean: false
					},
					{
						_id: 'studio0-remote0',
						_rank: 60,
						name: 'RM1',
						type: RunningOrderAPI.SourceLayerType.REMOTE,
						unlimited: false,
						onPGMClean: true,
						isRemoteInput: true
					},
					{
						_id: 'studio0-vt0',
						_rank: 80,
						name: 'VB',
						type: RunningOrderAPI.SourceLayerType.VT,
						unlimited: true,
						onPGMClean: true,
					},
					{
						_id: 'studio0-mic0',
						_rank: 90,
						name: 'Mic',
						type: RunningOrderAPI.SourceLayerType.MIC,
						unlimited: false,
						onPGMClean: true,
					},
					{
						_id: 'studio0-camera0',
						_rank: 100,
						name: 'Kam',
						type: RunningOrderAPI.SourceLayerType.CAMERA,
						unlimited: false,
						onPGMClean: true,
					},
				],
				mappings: {
					'layer0': {
						device: PlayoutDeviceType.CASPARCG,
						lookahead: LookaheadMode.NONE,
						deviceId: 'casparcg0'
					}
				},

				config: [
					{
						_id: 'nora_group',
						value: 'dksl'
					},
					{
						_id: 'nora_apikey',
						value: ''
					},
					{
						_id: 'slack_evaluation',
						value: ''
					}
				]
			})
		}
	},
	ensureCollectionProperty('StudioInstallations', {}, 'name', null, 'text', 'Studio $id: Name',
		'Enter the Name of the Studio "$id"'),
	ensureCollectionProperty('StudioInstallations', {}, 'defaultShowStyle', null, 'text', 'Studio $id: Default ShowStyle',
		'Enter the Default show style id for this Studio'),
	ensureCollectionProperty('StudioInstallations', {}, 'outputLayers', []),
	ensureCollectionProperty('StudioInstallations', {}, 'sourceLayers', []),
	ensureCollectionProperty('StudioInstallations', {}, 'mappings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'config', []),
	// Studio configs:
	ensureCollectionProperty('StudioInstallations', {}, 'config.media_previews_url', null, 'text', 'Studio $id config: media_previews_url',
		'Enter the url to the Media-previews endpoint (exposed by the CasparCG-Launcher), example: "http://192.168.0.1:8000/"', 'http://IP-ADDRESS:8000/'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.sofie_url', null, 'text', 'Studio $id config: sofie_url',
		'Enter the url to this Sofie-application (it\'s the url in your browser), example: "http://sofie01"', 'http://URL-TO-SOFIE'),

	// To be moved into Blueprints:
	ensureCollectionProperty('StudioInstallations', {}, 'config.atemSSrcBackground', null, 'text', 'Studio $id config: atemSSrcBackground',
		'Enter the file path to ATEM SuperSource Background, example: "/opt/playout-gateway/static/atem-mp/split_overlay.rgba"'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.atemSSrcBackground2', null, 'text', 'Studio $id config: atemSSrcBackground2',
		'Enter the file path to ATEM SuperSource Background 2, example: "/opt/playout-gateway/static/atem-mp/teknisk_feil.rgba"'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.nora_group', null, 'text', 'Studio $id config: nora_group',
		'Enter the nora_group paramter, example: "dksl"'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.nora_apikey', null, 'text', 'Studio $id config: nora_apikey',
		'Enter the nora_apikey parameter'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.metadata_url', null, 'text', 'Studio $id config: metadata_url',
		'Enter the URL to the send metadata to'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.sources_kam', null, 'text', 'Studio $id config: sources_kam',
		'Enter the sources_kam parameter (example: "1:1,2:2,3:3,4:4,8:11,9:12"'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.sources_kam_ptz', null, 'text', 'Studio $id config: sources_kam_ptz',
		'Enter the sources_kam_ptz parameter (example: "1:ptz0"'),
	ensureCollectionProperty('StudioInstallations', {}, 'config.sources_rm', null, 'text', 'Studio $id config: sources_rm',
		'Enter the sources_rm parameter (example: "1:5,2:6,3:7,4:8,5:9,6:10"'),

	/*
	{_id: 'nora_group', value: ''}, // Note: do not set to ensure that devs do not accidently use the live graphics channel
	{_id: 'nora_apikey', value: ''}, // Note: must not be set as apikey must be kept private
	{_id: 'media_previews_url', value: 'http://localhost:8000/'},
	{_id: 'sofie_url', value: 'http://sllxsofie01'},
	{_id: 'metadata_url', value: 'http://160.67.87.105'},
	{_id: 'atemSSrcBackground', value: '/opt/playout-gateway/static/atem-mp/split_overlay.rgba'},
	{_id: 'atemSSrcBackground2', value: '/opt/playout-gateway/static/atem-mp/teknisk_feil.rgba'},
	{_id: 'sources_kam', value: '1:1,2:2,3:3,4:4,8:11,9:12'},
	{_id: 'sources_kam_ptz', value: '1:ptz0'},
	{_id: 'sources_rm', value: '1:5,2:6,3:7,4:8,5:9,6:10'}

	atemSSrcBackground
	atemSSrcBackground2
	*/

	{
		id: 'showStyle exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!ShowStyles.findOne()) return 'No ShowStyle found'
			return false
		},
		migrate: () => {
			// create default ShowStyle:
			ShowStyles.insert({
				_id: 'show0',
				name: 'Default showstyle',
				templateMappings: {},
				baselineTemplate: '',
				messageTemplate: '',
				routerBlueprint: '',
				postProcessBlueprint: ''
			})
		}
	},
	ensureCollectionProperty('ShowStyles', {}, 'name', null, 'text', 'ShowStyle $id: Name', 'Enter the Name of the ShowStyles "$id"'),
	ensureCollectionProperty('ShowStyles', {}, 'templateMappings', []),
	// ensureCollectionProperty('ShowStyles', {}, 'baselineTemplate', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'messageTemplate', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'routerBlueprint', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'postProcessBlueprint', ''),
])
