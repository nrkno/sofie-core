import { Meteor } from 'meteor/meteor'
import { ShowStyles } from '../../lib/collections/ShowStyles'
import { StudioInstallations,
	Mappings,
	MappingCasparCG,
	MappingAtem,
	MappingAtemType,
	MappingLawo,
	Mapping
} from '../../lib/collections/StudioInstallations'
import { literal } from '../../lib/lib'
import { RundownAPI } from '../../lib/api/rundown'
import { PeripheralDevices, PlayoutDeviceType } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// Imports from TSR (TODO make into an import)
// export interface Mappings {
// 	[layerName: string]: Mapping
// }
// export interface Mapping {
// 	device: PlayoutDeviceType,
// 	deviceId: string,
// 	channel?: number,
// 	layer?: number
// 	// [key: string]: any
// }

// export enum MappingAtemType {
// 	MixEffect,
// 	DownStreamKeyer,
// 	SuperSourceBox,
// 	Auxilliary,
// 	MediaPlayer
// }
// export enum PlayoutDeviceType { // moved to PlayoutDeviceType in PeripheripheralDevices
// 	ABSTRACT = 0,
// 	CASPARCG = 1,
// 	ATEM = 2,
// 	LAWO = 3,
// 	HTTPSEND = 4
// }
// const literal = <T>(o: T) => o

Meteor.methods({
	'initDB': (really) => {

		if (!really) {
			return 'Do you really want to do this? You chould only do it when initializing a new database. Confirm with initDB(true).'
		}
		console.log('initDB')
		// Initiate database:
		StudioInstallations.upsert('studio0', {$set: {
			name: 'DKSL',
			studioInstallation: 'show0',
			outputLayers: [],
			config: [
				{_id: 'nora_group', value: 'dksl'},
				{_id: 'nora_apikey', value: 'sofie-prod-wug52h'}
			],
		}})

		// Create outputLayers:
		StudioInstallations.update('studio0', {$set: {
			outputLayers: [
				{
					_id: 'pgm0',
					name: 'PGM',
					isPGM: true,
				},
				{
					_id: 'monitor0',
					name: 'Bakskjerm',
					isPGM: false,
				}
			],
		}})
		// Create sourceLayers:
		StudioInstallations.update('studio0', {$set: {
			sourceLayers: [
				{
					_id: 'studio0_vignett',
					_rank: 40,
					name: 'Vignett',
					type: RundownAPI.SourceLayerType.VT,
					onPGMClean: true
				},
				{
					_id: 'studio0_vb',
					_rank: 45,
					name: 'VB',
					type: RundownAPI.SourceLayerType.VT,
					onPGMClean: true
				},
				{
					_id: 'studio0_live_speak0',
					_rank: 50,
					name: 'STK',
					type: RundownAPI.SourceLayerType.LIVE_SPEAK,
					onPGMClean: true
				},
				{
					_id: 'studio0_graphics0',
					_rank: 100,
					name: 'Super',
					type: RundownAPI.SourceLayerType.GRAPHICS,
					onPGMClean: false,
					activateKeyboardHotkeys: 'a,s,d,f,g,h',
					clearKeyboardHotkey: 'l'
				},
				// {
				// 	_id: 'studio0_lower_third0',
				// 	_rank: 10,
				// 	name: 'Super',
				// 	type: RundownAPI.SourceLayerType.LOWER_THIRD,
				// 	onPGMClean: false
				// },
				// {
				// 	_id: 'studio0_split0',
				// 	_rank: 15,
				// 	name: 'Split',
				// 	type: RundownAPI.SourceLayerType.SPLITS,
				// 	onPGMClean: true,
				// },
				// {
				// {
				// 	_id: 'studio0_remote0',
				// 	_rank: 60,
				// 	name: 'RM1',
				// 	type: RundownAPI.SourceLayerType.REMOTE,
				// 	onPGMClean: true,
				// 	isRemoteInput: true
				// },
				// {
				// 	_id: 'studio0_vt0',
				// 	_rank: 80,
				// 	name: 'VB',
				// 	type: RundownAPI.SourceLayerType.VT,
				// 	onPGMClean: true,
				// },
				// {
				// 	_id: 'studio0_mic0',
				// 	_rank: 90,
				// 	name: 'Mic',
				// 	type: RundownAPI.SourceLayerType.MIC,
				// 	onPGMClean: true,
				// },
				{
					_id: 'studio0_camera0',
					_rank: 100,
					name: 'Kam',
					type: RundownAPI.SourceLayerType.CAMERA,
					onPGMClean: true,
					activateKeyboardHotkeys: '1,2,3,4,5,6',
					assignHotkeysToGlobalAdlibs: true
				},
				{
					_id: 'studio0_live_transition0',
					_rank: 100,
					name: 'Transition',
					type: RundownAPI.SourceLayerType.UNKNOWN,
					onPGMClean: true,
					activateKeyboardHotkeys: '',
					assignHotkeysToGlobalAdlibs: false
				},
			],
		}})
		// Create Timeline mappings:
		const mappings: Mappings = { // Logical layers and their mappings
			'core_abstract': literal<Mapping>({
				device: PlayoutDeviceType.ABSTRACT,
				deviceId: 'abstract0',
			}),
			'casparcg_player_wipe': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 5,
				layer: 199
			}),
			'casparcg_player_vignett': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 5,
				layer: 140
			}),
			'casparcg_player_soundeffect': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 5,
				layer: 130
			}),
			'casparcg_player_clip': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 1,
				layer: 110
			}),
			'casparcg_cg_graphics': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 4,
				layer: 120
			}),
			'casparcg_cg_graphics_ctrl': literal<Mapping>({
				device: PlayoutDeviceType.HTTPSEND,
				deviceId: 'http0'
			}),
			'casparcg_cg_countdown': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 7,
				layer: 120
			}),
			'casparcg_cg_logo': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 4,
				layer: 121
			}),
			'casparcg_cg_logo_ctrl': literal<Mapping>({
				device: PlayoutDeviceType.HTTPSEND,
				deviceId: 'http0'
			}),
			'casparcg_cg_studiomonitor': literal<MappingCasparCG>({
				device: PlayoutDeviceType.CASPARCG,
				deviceId: 'casparcg0',
				channel: 3,
				layer: 120
			}),
			'casparcg_cg_studiomonitor_ctrl': literal<Mapping>({
				device: PlayoutDeviceType.HTTPSEND,
				deviceId: 'http0'
			}),
			'atem_me_program': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.MixEffect,
				index: 0 // 0 = ME1
			}),
			'atem_me_studiomonitor': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.MixEffect,
				index: 1 // 1 = ME2
			}),
			'atem_aux_clean': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.Auxilliary,
				index: 1
			}),
			'atem_aux_preview': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.Auxilliary,
				index: 2
			}),
			'atem_dsk_graphics': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.DownStreamKeyer,
				index: 0 // 0 = DSK1
			}),
			'atem_dsk_effect': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.DownStreamKeyer,
				index: 1 // 1 = DSK2
			}),
			'atem_supersource_default': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.SuperSourceBox,
				index: 0 // 0 = SS
			}),
			'atem_supersource_override': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.SuperSourceBox,
				index: 0 // 0 = SS
			}),
			'atem_usk_effect_default': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.MixEffect,
				index: 0 // 0 = ME1
			}),
			'atem_usk_effect_override': literal<MappingAtem>({
				device: PlayoutDeviceType.ATEM,
				deviceId: 'atem0',
				mappingType: MappingAtemType.MixEffect,
				index: 0 // 0 = ME1
			}),
			'lawo_source_automix': literal<MappingLawo>({
				device: PlayoutDeviceType.LAWO,
				deviceId: 'lawo0',
				channelName: 'Automiks',
				path: '1.1.71.3.2'
			}),
			'lawo_source_clip': literal<MappingLawo>({
				device: PlayoutDeviceType.LAWO,
				deviceId: 'lawo0',
				channelName: 'Innslag',
				path: '1.1.79.3.2'
			}),
			'lawo_source_effect': literal<MappingLawo>({
				device: PlayoutDeviceType.LAWO,
				deviceId: 'lawo0',
				channelName: 'Effekter',
				path: '1.1.75.3.2'
			}),
			'lawo_source_preview': literal<MappingLawo>({
				device: PlayoutDeviceType.LAWO,
				deviceId: 'lawo0',
				channelName: 'Forlytt',
				path: ''
			}),
			'lawo_source_rm1': literal<MappingLawo>({
				device: PlayoutDeviceType.LAWO,
				deviceId: 'lawo0',
				channelName: 'RM 1',
				path: '1.1.2.3.2'
			}),
			'lawo_source_rm2': literal<MappingLawo>({
				device: PlayoutDeviceType.LAWO,
				deviceId: 'lawo0',
				channelName: 'RM 2',
				path: '1.1.8.3.2'
			}),
			'lawo_source_rm3': literal<MappingLawo>({
				device: PlayoutDeviceType.LAWO,
				deviceId: 'lawo0',
				channelName: 'RM 3',
				path: '1.1.7.3.2'
			})
		}
		StudioInstallations.update('studio0', {$set: {
			mappings: mappings
		}})

		ShowStyles.upsert('show0', {$set: {
			name: 'Distriktsnyheter Sørlandet',
			templateMappings: [],
			baselineTemplate: 'sorlandetTemplate'
		}})

		PeripheralDevices.find({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).forEach((pd) => {
			PeripheralDevices.update(pd._id, {$set: {
				'settings.devices.casparcg0': ((pd['settings'] || {})['devices'] || {})['casparcg0'] || {
					type: PlayoutDeviceType.CASPARCG,
					options: {
						host: '160.68.32.30',
						port: 5250
					}
				},
				'settings.devices.atem0': ((pd['settings'] || {})['devices'] || {})['atem0'] || {
					type: PlayoutDeviceType.ATEM,
					options: {
						host: '10.182.132.140',
						port: 9910
					}
				},
				'settings.devices.lawo0': ((pd['settings'] || {})['devices'] || {})['lawo0'] || {
					type: PlayoutDeviceType.LAWO,
					options: {
						host: '10.182.132.203',
						port: 9000
					}
				},
				'settings.devices.abstract0': ((pd['settings'] || {})['devices'] || {})['abstract0'] || {
					type: PlayoutDeviceType.ABSTRACT,
					options: {
					}
				},
				'settings.devices.http0': ((pd['settings'] || {})['devices'] || {})['http0'] || {
					type: PlayoutDeviceType.HTTPSEND,
					options: {
					}
				}
			}})
			// PeripheralDevices.update(pd._id, {$set: {
			// 	mappings: mappings
			// }})
		})

		PeripheralDevices.find({
			type: PeripheralDeviceAPI.DeviceType.MOSDEVICE
		}).forEach((pd) => {
			PeripheralDevices.update(pd._id, {$set: {
				'settings.mosId': 'SOFIE1.DKSL.MOS',
				'settings.devices.enps0': ((pd['settings'] || {})['devices'] || {})['enps0'] || {
					primary: {
						id: 'SLENPS01',
						host: '160.68.132.15'
					},
					secondary: {
						id: 'DRENPSSL01',
						host: '160.67.149.94'
					}
				},
			}})
			// PeripheralDevices.update(pd._id, {$set: {
			// 	mappings: mappings
			// }})
		})
	}
})
