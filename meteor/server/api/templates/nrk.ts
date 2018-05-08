
import * as _ from 'underscore'

import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	MosString128,
	MosTime,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSStory,
	IMOSExternalMetaData
} from 'mos-connection'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import { IOutputLayer,
	ISourceLayer
} from '../../../lib/collections/StudioInstallations'
import {
	TemplateFunction,
	TemplateSet,
	SegmentLineItemOptional,
	TemplateFunctionOptional
} from './templates'

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
let sourceLayers = [
	{ _id: 'lower-third0', 	name: 'Super', 	type: RundownAPI.SourceLayerType.LOWER_THIRD, 	unlimited: true, 	onPGMClean: false},
	{ _id: 'graphics0', 	name: 'GFX', 	type: RundownAPI.SourceLayerType.GRAPHICS, 		unlimited: true, 	onPGMClean: false},
	{ _id: 'live-speak0', 	name: 'STK', 	type: RundownAPI.SourceLayerType.LIVE_SPEAK, 	unlimited: true, 	onPGMClean: false},
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
	getId (story: IMOSROFullStory): string {
		let templateId = ''
		if (story.MosExternalMetaData) {
			_.find(story.MosExternalMetaData, (md) => {
				if (
					md.MosScope === 'PLAYLIST' &&
					md.MosSchema === 'http://2012R2ENPS8VM:10505/schema/enps.dtd'
				) {
					let type = md.MosPayload.mosartType + ''
					let variant = md.MosPayload.mosartVariant + ''

					if (type.match(/break/i)) 			templateId = 'break'
					// else if (type.match(/full/i) &&
					// 		!variant)			 		templateId = 'full'
					// else if (type.match(/full/i) &&
					// 		variant.match(/vignett/i)) 	templateId = 'fullVignett'
					// else if (type.match(/full/i) &&
					// 		variant.match(/vignettxx/i)) 	templateId = 'fullVignettxx'
					else if (type.match(/stk/i) &&
							variant.match(/head/i)) 	templateId = 'stkHead'
				}
				if (templateId) return true // break
				else return false // keep looking
			})
		}
		return templateId
	},
	templates: {
		break: literal<TemplateFunctionOptional>((story: IMOSROFullStory) => {
			return []
			/*
				// Example data:
				{
					"ID": "2012R2ENPS8VM;P_ENPSNEWS\\W\\R_696297DF-1568-4B36-B43B3B79514B40D4;9908CC68-E390-4A6B-80BD0B07736B1AFF",
					"Slug": "NRK ï뾽stafjells;ddmm18-1850",
					"MosExternalMetaData": [
						{
							"MosScope": "PLAYLIST",
							"MosSchema": "http://2012R2ENPS8VM:10505/schema/enps.dtd",
							"MosPayload": {
								"Approved": 0,
								"Creator": "LINUXENPS",
								"MediaTime": 0,
								"ModBy": "LINUXENPS",
								"ModTime": "20180227T004206Z",
								"MOSItemDurations": 0,
								"MOSObjSlugs": "201 loop 1:  2:",
								"MOSSlugs": "NRK ï뾽STAFJELLS;ddmm15-1845-3",
								"Owner": "LINUXENPS",
								"pubApproved": 0,
								"SourceMediaTime": 0,
								"SourceTextTime": 0,
								"TextTime": 0,
								"mosartType": "BREAK",
								"ENPSItemType": 3
							}
						}
					],
					"RunningOrderId": "2012R2ENPS8VM;P_ENPSNEWS\\W;696297DF-1568-4B36-B43B3B79514B40D4",
					"Body": [
						{
							"Type": "storyItem",
							"Content": {
								"mosID": "chyron.techycami02.ndte.nrk.mos",
								"mosAbstract": "_00:00:03:00 | @M=Auto Openend | 201 loop | 1: | 2: | 3: | 4: | 00:00:00:00",
								"objPaths": {
								"objProxyPath": {
									"techDescription": "JPEG Thumbnail",
									"$t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"
								},
								"objMetadataPath": {}
								},
								"itemChannel": "CG2",
								"itemSlug": "NRK ï뾽STAFJELLS;ddmm15-1845-3",
								"mosObj": {
								"objID": "NYHETER\\00010001?version=1",
								"objSlug": "201 loop 1:  2:",
								"mosItemEditorProgID": "Chymox.AssetBrowser.1",
								"objDur": 0,
								"objTB": 0,
								"objPaths": {
									"objProxyPath": {
										"techDescription": "JPEG Thumbnail",
										"$t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"
									},
									"objMetadataPath": {}
								},
								"mosExternalMetadata": {
									"mosScope": "PLAYLIST",
									"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08",
									"mosPayload": {
										"sAVsom": "00:00:03:00",
										"sAVeom": "00:00:00:00",
										"createdBy": "N18685",
										"subtype": "lyric/data",
										"subtypeid": "I:\\CAMIO\\NYHETER\\Templates\\Bakskjerm\\00000201.lyr",
										"ObjectDetails": {
											"ServerID": "chyron.techycami02.ndte.nrk.mos",
											"ServerURL": "http://160.68.33.159/CAMIO/Redirection/MOSRedirection.asmx"
										}
									}
								}
								},
								"itemID": 3
							}
						}
					]
				}
			*/
		}),
		full: literal<TemplateFunctionOptional>((story: IMOSROFullStory) => {
			return []
			/*
				// Example data:
				{
					"ID": "2012R2ENPS8VM;P_ENPSNEWS\\W\\R_696297DF-1568-4B36-B43B3B79514B40D4;9908CC68-E390-4A6B-80BD0B07736B1AFF",
					"Slug": "NRK ï뾽stafjells;ddmm18-1850",
					"MosExternalMetaData": [
						{
							"MosScope": "PLAYLIST",
							"MosSchema": "http://2012R2ENPS8VM:10505/schema/enps.dtd",
							"MosPayload": {
								"Approved": 0,
								"Creator": "LINUXENPS",
								"MediaTime": 0,
								"ModBy": "LINUXENPS",
								"ModTime": "20180227T004206Z",
								"MOSItemDurations": 0,
								"MOSObjSlugs": "201 loop 1:  2:",
								"MOSSlugs": "NRK ï뾽STAFJELLS;ddmm15-1845-3",
								"Owner": "LINUXENPS",
								"pubApproved": 0,
								"SourceMediaTime": 0,
								"SourceTextTime": 0,
								"TextTime": 0,
								"mosartType": "BREAK",
								"ENPSItemType": 3
							}
						}
					],
					"RunningOrderId": "2012R2ENPS8VM;P_ENPSNEWS\\W;696297DF-1568-4B36-B43B3B79514B40D4",
					"Body": [
						{
							"Type": "storyItem",
							"Content": {
								"mosID": "chyron.techycami02.ndte.nrk.mos",
								"mosAbstract": "_00:00:03:00 | @M=Auto Openend | 201 loop | 1: | 2: | 3: | 4: | 00:00:00:00",
								"objPaths": {
								"objProxyPath": {
									"techDescription": "JPEG Thumbnail",
									"$t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"
								},
								"objMetadataPath": {}
								},
								"itemChannel": "CG2",
								"itemSlug": "NRK ï뾽STAFJELLS;ddmm15-1845-3",
								"mosObj": {
								"objID": "NYHETER\\00010001?version=1",
								"objSlug": "201 loop 1:2:",
								"mosItemEditorProgID": "Chymox.AssetBrowser.1",
								"objDur": 0,
								"objTB": 0,
								"objPaths": {
									"objProxyPath": {
										"techDescription": "JPEG Thumbnail",
										"$t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"
									},
									"objMetadataPath": {}
								},
								"mosExternalMetadata": {
									"mosScope": "PLAYLIST",
									"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08",
									"mosPayload": {
										"sAVsom": "00:00:03:00",
										"sAVeom": "00:00:00:00",
										"createdBy": "N18685",
										"subtype": "lyric/data",
										"subtypeid": "I:\\CAMIO\\NYHETER\\Templates\\Bakskjerm\\00000201.lyr",
										"ObjectDetails": {
											"ServerID": "chyron.techycami02.ndte.nrk.mos",
											"ServerURL": "http://160.68.33.159/CAMIO/Redirection/MOSRedirection.asmx"
										}
									}
								}
								},
								"itemID": 3
							}
						}
					]
				}
			*/
		}),
		stkHead: literal<TemplateFunctionOptional>(function (story: IMOSROFullStory) {
			// Wipe from vignett to first head with white wipe. Sound is from vignett outro.

			// Vignett
			// (Wipe)
			// Sound: Hale fra vignett
			// Video, no sound
			// GFX: Head
			// Sound: mic Host

			let wipe: SegmentLineItemOptional = {
				_id: this.getId(),
				mosId: 'wip_wipe',
				name: 'Wipe',
				trigger: {
					type: TriggerType.TIME_ABSOLUTE,
					value: 0 // to be played right away
				},
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: '',
				outputLayerId: '',
				expectedDuration: 0.3,
				duration: 0.3,
				content: {
					clip: 'AMB'
				}
				// segmentLineId: this.segmentLine._id,
				// runningOrderId: this.runningOrder._id,
			}
			// Video:
			let video: SegmentLineItemOptional = {
				// _id: this.id(),
				mosId: 'wip_wipe',
				name: 'Video',
				trigger: {
					type: TriggerType.TIME_RELATIVE,
					value: '#' + wipe._id + '.end - 0.5'
				},
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: '',
				outputLayerId: '',
				expectedDuration: 0.3,
				duration: 0.3,
				content: {
					clip: 'AMB'
				}
				// segmentLineId: this.segmentLine._id,
				// runningOrderId: this.runningOrder._id,
			}
			return [wipe, video]
			/*
				// Example data:
				{
					"ID": "2012R2ENPS8VM;P_ENPSNEWS\\W\\R_696297DF-1568-4B36-B43B3B79514B40D4;05D95BFE-F50E-4B0D-BB29EF892673D266",
					"Slug": "VIGNETT;head",
					"MosExternalMetaData": [
						{
							"MosScope": "PLAYLIST",
							"MosSchema": "http://2012R2ENPS8VM:10505/schema/enps.dtd",
							"MosPayload": {
								"Approved": 0,
								"Creator": "LINUXENPS",
								"MediaTime": 0,
								"ModBy": "LINUXENPS",
								"ModTime": "20180227T004205Z",
								"MOSItemDurations": 0,
								"MOSItemEdDurations": "",
								"MOSObjSlugs": "52 headline 1:  2:Østafjells\nStory status",
								"MOSSlugs": "SAK VESTFOLD;head-4\nSAK VESTFOLD;head-3",
								"Owner": "LINUXENPS",
								"pubApproved": 0,
								"SourceMediaTime": 0,
								"SourceTextTime": 0,
								"StoryProducer": "DKTE",
								"TextTime": 0,
								"mosartType": "STK",
								"mosartVariant": "HEAD",
								"ENPSItemType": 3
							}
						}
					],
					"RunningOrderId": "2012R2ENPS8VM;P_ENPSNEWS\\W;696297DF-1568-4B36-B43B3B79514B40D4",
					"Body": [
						{
							"Type": "storyItem",
							"Content": {
								"mosID": "chyron.techycami02.ndte.nrk.mos",
								"mosAbstract": "_00:00:00:00 | @M=Auto Openend | 52 headline | 1: | 2:Østafjells | 3: | 4: | 00:00:07:00",
								"objPaths": {
								"objProxyPath": {
									"techDescription": "JPEG Thumbnail",
									"$t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010044_v1_big.jpg"
								},
								"objMetadataPath": {}
								},
								"itemChannel": "CG1",
								"itemSlug": "SAK VESTFOLD;head-4",
								"mosObj": {
								"objID": "NYHETER\\00010044?version=1",
								"objSlug": "52 headline 1:  2:Østafjells",
								"mosItemEditorProgID": "Chymox.AssetBrowser.1",
								"objDur": 0,
								"objTB": 0,
								"objPaths": {
									"objProxyPath": {
										"techDescription": "JPEG Thumbnail",
										"$t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010044_v1_big.jpg"
									},
									"objMetadataPath": {}
								},
								"mosExternalMetadata": {
									"mosScope": "PLAYLIST",
									"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08",
									"mosPayload": {
										"sAVsom": "00:00:00:00",
										"sAVeom": "00:00:07:00",
										"createdBy": "N18685",
										"subtype": "lyric/data",
										"subtypeid": "I:\\CAMIO\\NYHETER\\Templates\\Super\\00000052.lyr",
										"ObjectDetails": {
											"ServerID": "chyron.techycami02.ndte.nrk.mos",
											"ServerURL": "http://160.68.33.159/CAMIO/Redirection/MOSRedirection.asmx"
										}
									}
								}
								},
								"itemID": 2
							}
						},
						{
							"Type": "storyItem",
							"Content": {
								"mosID": "mosart.morten.mos",
								"mosAbstract": "TIDSMARKØR IKKE RØR",
								"objID": "STORYSTATUS",
								"objSlug": "Story status",
								"itemID": 3,
								"itemSlug": "SAK VESTFOLD;head-3"
							}
						}
					]
				}
			*/
		})
	}
}

export {nrk}
/*
Template type  Variant     Lydfil  Hvilke fadere                   Audio level                Effekt      Videoklipp Video xpoint       Beskrivelse
BREAK                                                                                                                None               Make ready for broadcast, put first story in PGM.
FULL                               Videoserver rip                 0                                                 Videoserver rip    Spiller av et innslag med lyd
FULL           VIGNETT     Vignett Lydavspiller                    0                                      Vignett    Videoserver rip    Spiller av vignetten fra videoserver, vignettlyd fra lydavspiller. Har fast lengde til det skal wipes til head eller studio
FULL           VIGNETTxx   Vignett Lydavspiller                    0                                      Vignettxx  Videoserver rip    Spiller av vignetten fra videoserver, vignettlyd fra lydavspiller. Har fast lengde til det skal wipes til head eller studio
STK                                Videoserver rip/mik automiks    −15 on clip, 0 on automix                         Videoserver rip    Play a video clip which the host will speak to. Lower the sound of the video 10 dB
STK            HEAD                Lydavspiller/ mik automiks      0                          Wipe hvit              Videoserver rip    Wipe from vignett to first head with white wipe. Sound is from vignett outro.
STK            HEAD2       Skille  Lydavspiller1+2/ mik automiks   0                          Wipe hvit              Videoserver rip    Wipe from previous head, vignettlyd og skillelyd. Bruker state variant for å kunne skille mellom den som er først i lista og de som kommer etterpå. For bruker er variant på begge HEAD. Forsinkelse på wipe grunnet grafikk
STK            ULYD                Mik automiks                    0                                                 Videoserver rip    Play a video that the host will talk to, but has no sound from the video
KAM            1                   Mik automiks                    0                                                 KAM1               Kamera 1 med mik
KAM            2                   Mik automiks                    0                                                 KAM2               Kamera 2 med mik
KAM            3                   Mik automiks                    0                                                 KAM3               Kamera 3 med mik
KAM            ÅPNING2     Punktum Lydavspiller1+2/ mik automiks   0                          Wipe hvit              KAM2               Wipe fra siste head til kamera. Punktum-lyd til studio. Vignettlyd fades ut.
KAM            GRAFIKK             Mik automiks/ grafikk           0                                                 None               Kamera uten krysspunkt for å legge fullskjermsgrafikk over. Mik og lyd fra grafikk.
KAM            SLUTT1              Mik automiks/ grafikk           0                                                 KAM1               Kamera 1 med mik og fader for grafikk. Dette er for sluttvignett som er en sluttsuper med animasjon til lukking og ender med NRK2018. Sluttvignettlyd ligger på grafikken.
DIR            1                   RM1                             0                                                 RM1                RM1 med lyd
DIR            2                   RM2                             0                                                 RM2                RM2 med lyd
DIR            3                   RM3                             0                                                 RM3                RM3 med lyd

DVE            2LIKE               Automiks/RMx med videolink      0 on automix, -15 on live                         MEx                Innpakket split med to like 16:9 ruter. Venstre henter kilde fra kolonnen ip1, høyre fra kolonnen ip2. Lyd følger de samme kilder. Kamera er gjerne høyre. Grafisk innpakking
GRAFIKK                            Mik automiks/ grafikk           0                                                 Fullskjermsgrafikk Fullskjerms grafikk, som nettpromo, seerbilder etc
TLF            TLF1                Mik automiks/ telefon 1         0                                                 Fullskjermsgrafikk Fullskjermsgrafikk for telefonintervju. Grafikk med mik og telefon lyd
TLF            TLF2                Mik automiks/ telefon 2         0                                                 Fullskjermsgrafikk Fullskjermsgrafikk for telefonintervju. Grafikk med mik og telefon lyd
DIR            RM1                 RM1                             0                                                 RM1                RM1 med lyd..... Annen visning av template variant
DIR            RM2                 RM2                             0                                                 RM2                RM2 med lyd..... Annen visning av template variant
DIR            RM3                 RM3                             0                                                 RM3                RM3 med lyd..... Annen visning av template variant

Special
FULL           VIGNETT
FULL
FULL
STK
DIR

*/
