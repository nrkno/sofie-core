// ----------------------------------------------------------------------------
// SOURCE DATA
import { Segment } from '../../meteor/lib/collections/Segments'
import { SegmentLine } from '../../meteor/lib/collections/SegmentLines'
import { SegmentLineItem, ITimelineTrigger, BaseContent, VTContent, GraphicsContent } from '../../meteor/lib/collections/SegmentLineItems'
import { TimelineContentType, TimelineObj, TimelineObjCCGVideo, TimelineObjLawoSource, TimelineObjCCGTemplate } from '../../meteor/lib/collections/Timeline'
import { RundownAPI } from '../../meteor/lib/api/rundown'
import {
	IMOSExternalMetaData,
	IMOSObjectStatus
} from 'mos-connection'
import { TriggerType } from 'superfly-timeline'

// export interface TimelinePartialObj {
// 	trigger: {
// 		type: TriggerType;
// 		value: number | string;
// 	}
// 	duration: number
// 	LLayer: string | number
// 	content: {
// 		// objects?: Array<TimelineObject>
// 		// keyframes?: Array<TimelineKeyframe>
// 		type: TimelineContentType
// 		// transitions?: {
// 		// 	inTransition?: TimelineTransition
// 		// 	outTransition?: TimelineTransition
// 		// }
// 	}
// 	classes?: Array<string>
// 	disabled?: boolean
// 	isGroup?: boolean
// 	inGroup?: string
// 	repeating?: boolean
// 	priority?: number
// 	externalFunction?: string
// }

const literal = <T>(o: T) => o

let sourceData = [
{
	"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9141DBA1-93DD-4B19-BEBB32E0D6222E1B",
	"Slug": "ÅPNING;vignett",
	"MosExternalMetaData": [
		{
			"MosScope": "PLAYLIST",
			"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
			"MosPayload": {
				"Actual": 4,
				"Approved": 1,
				"Creator": "LINUXENPS",
				"ElapsedTime": 3,
				"MediaTime": 0,
				"ModBy": "N12914",
				"ModTime": "20180502T144559Z",
				"MOSAbstracts": "M: NRK Østafjells(20-04-16 09:07)\nTIDSMARKØR IKKE RØR",
				"MOSItemDurations": "",
				"MOSItemEdDurations": "",
				"MOSObjSlugs": "M: NRK Østafjells\nStory status",
				"MOSSlugs": "VIGNETT;vignett-5\nVIGNETT;vignett-3",
				"MOSTimes": "20180502T165008720Z",
				"Owner": "LINUXENPS",
				"SourceMediaTime": 0,
				"SourceTextTime": 0,
				"StoryLogPreview": "<LYS Q1>",
				"StoryProducer": "DKTE",
				"TextTime": 0,
				"SystemApprovedBy": "N12914",
				"Kilde": "TV",
				"mosartType": "FULL",
				"mosartVariant": "VIGNETT2018",
				"ReadTime": 0,
				"ENPSItemType": 3
			}
		}
	],
	"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
	"Body": [
		{
			"Type": "storyItem",
			"Content": {
				"itemID": 9,
				"objID": "N11580_1461136025",
				"mosID": "METADATA.NRK.MOS",
				"mosAbstract": "M: NRK Østafjells (20-04-16 09:07)",
				"objSlug": "M: NRK Østafjells",
				"mosExternalMetadata": {
					"mosScope": "PLAYLIST",
					"mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
					"mosPayload": {
						"nrk": {
							"type": "video",
							"changedBy": "N11580",
							"changetime": "2016-04-20T09:07:05 +02:00",
							"mdSource": "ncs",
							"title": "NRK Østafjells",
							"description": {},
							"hbbtv": {
								"link": ""
							},
							"rights": {
								"notes": "",
								"owner": "NRK",
								"$t": "Green"
							}
						}
					}
				},
				"itemSlug": "VIGNETT;vignett-5"
			}
		},
		{
			"Type": "storyItem",
			"Content": {
				"mosID": "mosart.morten.mos",
				"abstract": "TIDSMARKØR IKKE RØR",
				"objID": "STORYSTATUS",
				"objSlug": "Story status",
				"itemID": 10,
				"itemSlug": "VIGNETT;vignett-3"
			}
		}
	],
	"level": "debug",
	"message": "mosRoFullStory",
	"timestamp": "2018-05-09T10:26:43.127Z"
},
{
	"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;6364CE48-9B6A-4D36-B7F8352E6E11EDB7",
	"Slug": "ÅPNING;head-hundepose-020518",
	"MosExternalMetaData": [
		{
			"MosScope": "PLAYLIST",
			"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
			"MosPayload": {
				"Approved": 1,
				"Creator": "LINUXENPS",
				"ElapsedTime": 5,
				"Estimated": 10,
				"MediaTime": 0,
				"ModBy": "N12914",
				"ModTime": "20180502T163055Z",
				"MOSAbstracts": "head-hundepose-020518-te NYHETER 00:00:11:19 \n_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Vil ikkje ha poser til hundebæsj | 2:Østafjells | 3: | 4: | 00:00:07:00\nTIDSMARKØR IKKE RØR",
				"MOSItemDurations": "11,76\n0",
				"MOSItemEdDurations": "",
				"MOSObjSlugs": "head-hundepose-020518-te\n52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells\nStory status",
				"MOSSlugs": "HEAD;head-Bæsjepose-4\n52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells\nSAK VESTFOLD;head-3",
				"MOSTimes": "20180502T165013906Z",
				"Owner": "LINUXENPS",
				"Printed": "20180502T164204Z",
				"SourceMediaTime": 0,
				"SourceTextTime": 0,
				"StoryLogPreview": "Miljøpartiet vil droppe posen til hundebæsjen - slik vil dei spare miljøet.",
				"StoryProducer": "DKTE",
				"TextTime": 5,
				"SystemApprovedBy": "N12914",
				"Kilde": "TV",
				"mosartType": "STK",
				"mosartVariant": "HEAD",
				"OpprLand": "Norge",
				"ReadTime": 5,
				"Rettigheter": "Grønt",
				"Team": "(Kun for STK:) Foto: / Redigering:",
				"ENPSItemType": 3
			}
		}
	],
	"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
	"Body": [
		{
			"Type": "storyItem",
			"Content": {
				"itemID": 4,
				"itemSlug": "HEAD;head-Bæsjepose-4",
				"objID": "\\\\NDTE\\Omn\\C\\S\\25\\07",
				"mosID": "OMNIBUS.NDTE.MOS",
				"abstract": "head-hundepose-020518-te NYHETER 00:00:11:19",
				"objDur": 588,
				"objTB": 50,
				"objSlug": "head-hundepose-020518-te",
				"mosExternalMetadata": {
					"mosSchema": "OMNIBUS"
				}
			}
		},
		{
			"Type": "storyItem",
			"Content": {
				"mosID": "chyron.techycami02.ndte.nrk.mos",
				"abstract": {},
				"objPaths": {
					"objProxyPath": {
						"techDescription": "JPEG Thumbnail",
						"$t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058473_v1_big.jpg"
					},
					"objMetadataPath": {}
				},
				"itemChannel": "CG1",
				"itemSlug": "52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells",
				"mosObj": {
					"objID": "NYHETER\\00058473?version=1",
					"objSlug": "52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells",
					"mosItemEditorProgID": "Chymox.AssetBrowser.1",
					"objDur": 0,
					"objTB": 0,
					"objPaths": {
						"objProxyPath": {
							"techDescription": "JPEG Thumbnail",
							"$t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058473_v1_big.jpg"
						},
						"objMetadataPath": {}
					},
					"mosExternalMetadata": {
						"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"
					}
				},
				"itemID": 2
			}
		},
		{
			"Type": "storyItem",
			"Content": {
				"mosID": "mosart.morten.mos",
				"abstract": "TIDSMARKØR IKKE RØR",
				"objID": "STORYSTATUS",
				"objSlug": "Story status",
				"itemID": 3,
				"itemSlug": "SAK VESTFOLD;head-3"
			}
		}
	],
	"level": "debug",
	"message": "mosRoFullStory",
	"timestamp": "2018-05-09T10:26:43.331Z"
},
{
	"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;4CBE86C0-9A69-4EF4-81F8E8CD275092E8",
	"Slug": "ÅPNING;head-mesterskap-020518-te",
	"MosExternalMetaData": [
		{
			"MosScope": "PLAYLIST",
			"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
			"MosPayload": {
				"Approved": 1,
				"Creator": "LINUXENPS",
				"ElapsedTime": 7,
				"MediaTime": 0,
				"ModBy": "N12914",
				"ModTime": "20180502T144554Z",
				"MOSAbstracts": "head-mesterskap-020518-te NYHETER 00:00:12:13 \n_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Fylkesmeisterskap i Vestfold | 2:Østafjells | 3: | 4: | 00:00:07:00\nTIDSMARKØR IKKE RØR",
				"MOSItemDurations": "12,52\n0",
				"MOSItemEdDurations": "",
				"MOSObjSlugs": "head-mesterskap-020518-te\n52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells\nStory status",
				"MOSSlugs": "FYLKESMESTERSKAP;head-mesterskap-020518-te-4\n52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells\nSAK VESTFOLD;head-3",
				"MOSTimes": "20180502T165021004Z",
				"Owner": "LINUXENPS",
				"Printed": "20180502T164204Z",
				"SourceMediaTime": 0,
				"SourceTextTime": 0,
				"StoryLogPreview": "Lærlingar konkurrerte i barne- og ungdomsarbeiderfaget. Arrangementet skal skape blest rundt yrket.",
				"StoryProducer": "DKTE",
				"TextTime": 7,
				"SystemApprovedBy": "N12914",
				"Kilde": "TV",
				"mosartType": "STK",
				"mosartVariant": "HEAD",
				"OpprLand": "Norge",
				"ReadTime": 7,
				"Rettigheter": "Grønt",
				"Team": "(Kun for STK:) Foto: / Redigering:",
				"ENPSItemType": 3
			}
		}
	],
	"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
	"Body": [
		{
			"Type": "storyItem",
			"Content": {
				"itemID": 4,
				"itemSlug": "FYLKESMESTERSKAP;head-mesterskap-020518-te-4",
				"objID": "\\\\NDTE\\Omn\\C\\S\\24\\61",
				"mosID": "OMNIBUS.NDTE.MOS",
				"abstract": "head-mesterskap-020518-te NYHETER 00:00:12:13",
				"objDur": 626,
				"objTB": 50,
				"objSlug": "head-mesterskap-020518-te",
				"mosExternalMetadata": {
					"mosSchema": "OMNIBUS"
				}
			}
		},
		{
			"Type": "storyItem",
			"Content": {
				"itemID": 5,
				"itemSlug": "52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells",
				"itemChannel": "CG1",
				"mosID": "chyron.techycami02.ndte.nrk.mos",
				"abstract": "_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Fylkesmeisterskap i Vestfold | 2:Østafjells | 3: | 4: | 00:00:07:00",
				"mosObj": {
					"objID": "NYHETER\\00058435?version=1",
					"objSlug": "52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells",
					"mosItemEditorProgID": "Chymox.AssetBrowser.1",
					"objDur": 0,
					"objTB": 0,
					"objPaths": {
						"objProxyPath": {
							"techDescription": "JPEG Thumbnail",
							"$t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058435_v1_big.jpg"
						},
						"objMetadataPath": {}
					},
					"mosExternalMetadata": {
						"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"
					}
				}
			}
		},
		{
			"Type": "storyItem",
			"Content": {
				"mosID": "mosart.morten.mos",
				"abstract": "TIDSMARKØR IKKE RØR",
				"objID": "STORYSTATUS",
				"objSlug": "Story status",
				"itemID": 3,
				"itemSlug": "SAK VESTFOLD;head-3"
			}
		}
	],
	"level": "debug",
	"message": "mosRoFullStory",
	"timestamp": "2018-05-09T10:26:43.540Z"
},
{
	"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;8B0D9EE2-EF9A-472F-80C6DD2CCDCFC2E6",
	"Slug": "ÅPNING;velkommen",
	"MosExternalMetaData": [
		{
			"MosScope": "PLAYLIST",
			"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
			"MosPayload": {
				"Approved": 1,
				"Creator": "LINUXENPS",
				"ElapsedTime": 5,
				"Estimated": 0,
				"MediaTime": 0,
				"ModBy": "N12914",
				"ModTime": "20180502T154626Z",
				"MOSAbstracts": "_00:00:00:00 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00\nTIDSMARKØR IKKE RØR",
				"MOSItemDurations": 0,
				"MOSItemEdDurations": "",
				"MOSObjSlugs": "50 logo 1:  2:\nStory status",
				"MOSSlugs": "50 logo 1:  2:\nVelkommen;velkommen-4",
				"MOSTimes": "20180502T131049Z\n20180502T165026622Z",
				"Owner": "LINUXENPS",
				"SourceMediaTime": 0,
				"SourceTextTime": 0,
				"StoryLogPreview": "<BAK FADE<00:01:12>>",
				"TextTime": 0,
				"SystemApprovedBy": "N12914",
				"mosartType": "KAM",
				"mosartVariant": "ÅPNING3",
				"ReadTime": 0,
				"ENPSItemType": 3
			}
		}
	],
	"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
	"Body": [
		{
			"Type": "storyItem",
			"Content": {
				"mosID": "chyron.techycami02.ndte.nrk.mos",
				"abstract": "_00:00:00:00 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00",
				"objPaths": {
					"objProxyPath": {
						"techDescription": "JPEG Thumbnail",
						"$t": "http://160.68.33.159/thumbs/NYHETER/16000/Objects_NYHETER_00016967_v1_big.jpg"
					},
					"objMetadataPath": {}
				},
				"itemChannel": "CG1",
				"itemSlug": "50 logo 1:  2:",
				"mosObj": {
					"objID": "NYHETER\\00016967?version=1",
					"objSlug": "50 logo 1:  2:",
					"mosItemEditorProgID": "Chymox.AssetBrowser.1",
					"objDur": 0,
					"objTB": 0,
					"objPaths": {
						"objProxyPath": {
							"techDescription": "JPEG Thumbnail",
							"$t": "http://160.68.33.159/thumbs/NYHETER/16000/Objects_NYHETER_00016967_v1_big.jpg"
						},
						"objMetadataPath": {}
					},
					"mosExternalMetadata": {
						"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"
					}
				},
				"itemID": 3
			}
		},
		{
			"Type": "storyItem",
			"Content": {
				"mosID": "mosart.morten.mos",
				"abstract": "TIDSMARKØR IKKE RØR",
				"objID": "STORYSTATUS",
				"objSlug": "Story status",
				"itemID": 5,
				"itemSlug": "Velkommen;velkommen-4"
			}
		}
	],
	"level": "debug",
	"message": "mosRoFullStory",
	"timestamp": "2018-05-09T10:26:43.739Z"
}
]
/*


- lydspor
- grafikk







// ----------------------------------------------------------------------------
// LOGIC

- Number of segmentLine = 2 + (n * heads)
- segmentLines are vignett + heads + cam ('hei og velkommen)
- all transitions has wipes. there are different wipe/audio combinations, with only the transition from a head to another being the same
- 



1) plays clip [vignett-file] on sourceLayer 'studio0-vignett' and Llayer 'vignett' in segmentLine 0
	 - the  file to play is a variable that maps to the 'variant of template type 'FULL' (different files for different shows)
2) plays clip [head 1] on sourceLayer 'studio0-live-speak0' and Llayer 'clip' in segmentLine 1
	 - continuesRefId = [vignett]
	 - Segment line 1 has autotake 
	 - the fixes timing for autotake is hardcoded and a variable that depens on the 'variant'. Short vignett-file = short timing

4) 





*/
// ----------------------------------------------------------------------------
// Resulting Segment, Segment lines, items etc
let segment: Segment = {
	_id: '',                //
	_rank: 0,               //
	mosId: 'ÅPNING',        // same as .name?
	runningOrderId: '',     // id of running order
	name: 'ÅPNING',         // name of group (taken from Story Slug)
	number: 'A2',           // [Todo] we only get these during "freeze"
	// metaData?: Array<IMOSExternalMetaData>
	status: IMOSObjectStatus // [Todo] aggregate from segmentLineItems? Remove? talk to Jan
	// expanded?: boolean
}
// pseudo
let segmentLines: Array<SegmentLine | SegmentLineItem> = [
    // Vignett
	literal<SegmentLine>({
		// created from Slug: "xxxx;vignett"
		// ÅPNING;vignett
		_id: '',
		_rank: 0,
		mosId: 'MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9141DBA1-93DD-4B19-BEBB32E0D6222E1B',   // todo @nytamin
		segmentId: '',
		runningOrderId: '',
		autoNext: false,
		metaData: story.MosExternalMetaData,
		// status: [todo: check where we get this from, it's not in roFullStatus
		expectedDuration: 0,
		//   startedPlayback?: number
		//   duration?: number
	}),
		literal<SegmentLineItem>({
			_id: '',
			mosId: '',
			segmentLineId: '',
			runningOrderId: '',
			name: '',
			trigger: {
				type: TriggerType.ABSOLUTE,
				value: 'now' 
			},
			status: RundownAPI.LineItemStatusCode.OK, // ?
			sourceLayerId: 'studio0_vignett',
			outputLayerId: 'pgm0',
			expectedDuration: 5, // hard-coded, using mosartVariant, 
			duration: 5, // same as expectedDuration
			disabled: false,
			//transitions?: {
				//inTransition?: TimelineTransition
				//outTransition?: TimelineTransition
			// },
			content: literal<VTContent>({
				filename: 'vignett.mp4',
				path: '', // let Jan explain & decide
				firstWords: '', // none
				lastWords: '', // none
				// proxyPath?: '', // [todo] implement proxy for scrubbing in UI
				// thumbnail?: '', // [todo] implement proxy for scrubbing in UI
				loop: false,
				sourceDuration: 5, // [todo] check with Jan what this does
				// metadata?: none
				timelineObjects: [
					literal<TimelineObjCCGVideo>({
						_id: 'vignettObj',
						deviceId: '',
						trigger: {
							type: TriggerType.ABSOLUTE,
							value: 'now'
						},
						duration: 30, // todal duration of file (including tailing bed)
						LLayer: 'casparcg_player_vignett',
						content: {
							// objects?: Array<TimelineObject>
							// keyframes?: Array<TimelineKeyframe>
							type: TimelineContentType.VIDEO,
							attributes: {
								file: 'vignett.mp4',
								loop: false
								// seek?: number
								// videoFilter?: string
								// audioFilter?: string
							}
							// transitions?: {
							// 	inTransition?: TimelineTransition
							// 	outTransition?: TimelineTransition
							// }
						},
						// classes?: Array<string>
						// disabled?: boolean
						// isGroup?: boolean
						// inGroup?: string
						// repeating?: boolean
						// priority?: number
						// externalFunction?: string
					}),
                    literal<TimelineObjLawoSource>({
						_id: '',
						deviceId: '',
						trigger: {
							type: TriggerType.RELATIVE,
							value: '#vignettObj.start'
						},
						duration: 0, // ?
						LLayer: 'lawo_source_effect', // sound of vignett
                        content: {
							type: TimelineContentType.LAWO_AUDIO_SOURCE,
                            attributes:{
    							db: 0
                            }
                        }
					}),
				]
			}),
			//continuesRefId?: '',
		}),

    // head 1
    literal<SegmentLine>({
		// created from Slug: "xxxx;vignett"
		// ÅPNING;vignett
		_id: '',
		_rank: 0,
		mosId: 'MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;6364CE48-9B6A-4D36-B7F8352E6E11EDB7',
		segmentId: '',
		runningOrderId: '',
		autoNext: true, // true if behind a vignett
		metaData: story.MosExternalMetaData,
		// status: [todo: check where we get this from, it's not in roFullStatus
		expectedDuration: o.MosExternalMetaData[0].MosPayload.Estimated,
		//   startedPlayback?: number
		//   duration?: number
	}),
		literal<SegmentLineItem>({
			_id: 'headCliptempID',
			mosId: '',
			segmentLineId: '',
			runningOrderId: '',
			name: 'HEAD;head-Bæsjepose-4',
			trigger: {
				type: TriggerType.ABSOLUTE,
				value: 'now'
			},
			status: RundownAPI.LineItemStatusCode.OK, // ?
			sourceLayerId: 'studio0_live_speak0',
			outputLayerId: 'pgm0',
			expectedDuration: 5, // hard-coded, using mosartVariant, 
			duration: 5, // same as expectedDuration
			disabled: false,
			//transitions?: {
				//inTransition?: TimelineTransition
				//outTransition?: TimelineTransition
			// },
			content: literal<VTContent>({
				filename: '',       // 
				path: '', // let Jan explain & decide
				firstWords: '',
				lastWords: '', 
				// proxyPath?: '', // [todo] implement proxy for scrubbing in UI
				// thumbnail?: '', // [todo] implement proxy for scrubbing in UI
				loop: false,
				sourceDuration: 5, // [todo] check with Jan what this does
				// metadata?: none
				timelineObjects: [
					literal<TimelineObjCCGVideo>({
						_id: '',
						deviceId: '',
						trigger: {
							type: TriggerType.ABSOLUTE,
							value: 'now'
						},
						duration: 5, // todal duration of file (including tailing bed)
						LLayer: 'casparcg_player_clip',
						content: {
							// objects?: Array<TimelineObject>
							// keyframes?: Array<TimelineKeyframe>
							type: TimelineContentType.VIDEO,
							attributes: {
								file: '',
								loop: false
							}
							// transitions?: {
							// 	inTransition?: TimelineTransition
							// 	outTransition?: TimelineTransition
							// }
						},
						// classes?: Array<string>
						// disabled?: boolean
						// isGroup?: boolean
						// inGroup?: string
						// repeating?: boolean
						// priority?: number
						// externalFunction?: string
					})
                   
				]
			}),
			//continuesRefId?: '',
		}),
		literal<SegmentLineItem>({
			_id: '',
			mosId: '',
			segmentLineId: '',
			runningOrderId: '',
			name: 'HEAD;head-Bæsjepose-4',
			trigger: {
				type: TriggerType.ABSOLUTE,
				value: 'now'
			},
			status: RundownAPI.LineItemStatusCode.OK, // ?
			sourceLayerId: 'studio0_live_speak0',
			outputLayerId: 'pgm0',
			expectedDuration: 5, // hard-coded, using mosartVariant, 
			duration: 5, // same as expectedDuration
			disabled: false,
			//transitions?: {
				//inTransition?: TimelineTransition
				//outTransition?: TimelineTransition
			// },
			content: literal<GraphicsContent>({
				filename: '',       // 
				path: '', // let Jan explain & decide
				firstWords: '',
				lastWords: '', 
				// proxyPath?: '', // [todo] implement proxy for scrubbing in UI
				// thumbnail?: '', // [todo] implement proxy for scrubbing in UI
				loop: false,
				sourceDuration: 5, // [todo] check with Jan what this does
				// metadata?: none
				timelineObjects: [
					literal<TimelineObjCCGTemplate>({
						_id: '',
						deviceId: '',
						trigger: {
							type: TriggerType.ABSOLUTE,
							value: 'now'
						},
						duration: 30, // todal duration of file (including tailing bed)
						LLayer: 'casparcg_player_clip',
						content: {
							// objects?: Array<TimelineObject>
							// keyframes?: Array<TimelineKeyframe>
							type: TimelineContentType.TEMPLATE,
							attributes: {
								name: 'vignett.mp4',
							}
							// transitions?: {
							// 	inTransition?: TimelineTransition
							// 	outTransition?: TimelineTransition
							// }
						},
						// classes?: Array<string>
						// disabled?: boolean
						// isGroup?: boolean
						// inGroup?: string
						// repeating?: boolean
						// priority?: number
						// externalFunction?: string
					})
                   
				]
			}),
			//continuesRefId?: '',
		})
]