
import * as _ from 'underscore'

import { RundownAPI } from '../../../lib/api/rundown'
import { IOutputLayer } from '../../../lib/collections/StudioInstallations'
import { TemplateSet } from './templates'

import { NrkBreakTemplate } from './nrk-break'
import { NrkVignettTemplate } from './nrk-vignett'
import { NrkHeadTemplate } from './nrk-head'
import { NrkKamTemplate } from './nrk-kam'
import { NrkSorlandetBaseTemplate } from './nrk-sorlandetBase'
import { NrkFullTemplate } from './nrk-full'
import { NrkDirTemplate } from './nrk-dir'

const literal = <T>(o: T) => o

// ------------------------------
// Temporary notes:
// Layer setup:
/*
let outputLayers: Array<IOutputLayer> = [
	{
		_id: 'pgm0',
		name: 'PGM',
		isPGM: true,
	},
	{
		_id: 'monitor0',
		name: 'Skjerm',
		isPGM: false,
	}
]

/*
Caspar Channels:
1: [CServ1] Fill, Primary Video channel
	+ sound
2: [CServ_PVW] Fill, Video channel for preview (usage TBD)
	+ sound
3: [Serv2] Key + Fill, Studio-screen?
	+ no sound
4: [CG1] Fill + Key, Graphics (DSK1)
	+ no sound
5: [CG2] Fill + Key, Video / Graphics (DSK2)
	+ sound, effect sounds

Fill: Video (comes as a camera)
	+ sound
Key + Fill: graphics / video to be keyed onto PGM
	+ sound

let sourceLayers = [

	// on top of PGM, to be keyed
	{ _id: 'vignett', 	name: 'Vignett', 	type: RundownAPI.SourceLayerType.LIVE_SPEAK,unlimited: true, 	onPGMClean: false},
	{ _id: 'vignett', 	name: 'Vignett', 	type: RundownAPI.SourceLayerType.LIVE_SPEAK,unlimited: true, 	onPGMClean: false},
	{ _id: 'live-speak0', 	name: 'STK', 	type: RundownAPI.SourceLayerType.LIVE_SPEAK, 	unlimited: true, 	onPGMClean: false},
	{ _id: 'lower-third0', 	name: 'Super', 	type: RundownAPI.SourceLayerType.LOWER_THIRD, 	unlimited: true, 	onPGMClean: false},
	{ _id: 'graphics0', 	name: 'GFX', 	type: RundownAPI.SourceLayerType.GRAPHICS, 		unlimited: true, 	onPGMClean: false},
	{ _id: 'remote0', 		name: 'RM1', 	type: RundownAPI.SourceLayerType.REMOTE, 		unlimited: false, 	onPGMClean: true},
	{ _id: 'vt0', 			name: 'VB', 	type: RundownAPI.SourceLayerType.VT, 			unlimited: true, 	onPGMClean: true},
	{ _id: 'mic0', 			name: 'Mic', 	type: RundownAPI.SourceLayerType.MIC, 			unlimited: false, 	onPGMClean: true},
	{ _id: 'camera0', 		name: 'Kam', 	type: RundownAPI.SourceLayerType.CAMERA, 		unlimited: false, 	onPGMClean: true},
]
*/

// -------------------------------
// The template set:
let nrk: TemplateSet = {
	/**
	 * Returns the id of the template-function to be run
	 * @param story
	 */
	getId: literal<TemplateSet['getId']>(function (context, story): string {
		let templateId = ''

		if (story.MosExternalMetaData) {
			_.find(story.MosExternalMetaData, (md) => {
				if (
					md.MosScope === 'PLAYLIST' &&
					md.MosSchema.match(/10505\/schema\/enps.dtd/)
				) {
					let type = md.MosPayload.mosartType + ''
					let variant = md.MosPayload.mosartVariant + ''

					if (type.match(/break/i)) 			templateId = 'break'
					// else if (type.match(/full/i) &&
					// 		!variant)			 		templateId = 'full'
					else if (type.match(/full/i) &&
							variant.match(/vignett/i)) 	templateId = 'vignett'
					else if (type.match(/stk/i) &&
							variant.match(/head/i)) 	templateId = 'stkHead'
					else if (type.match(/kam/i)) 		templateId = 'kam'
					else if (type.match(/dir/i))		templateId = 'dir'
				}
				if (templateId) return true // break
				else return false // keep looking
			})
		}
		console.log('getId', templateId)
		return templateId
	}),
	templates: {
		break: NrkBreakTemplate,
		vignett: NrkVignettTemplate,
		stkHead: NrkHeadTemplate,
		kam: NrkKamTemplate,
		dir: NrkDirTemplate,
		sorlandetTemplate: NrkSorlandetBaseTemplate
	}
}

export {nrk}
