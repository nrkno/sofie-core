import { Meteor } from 'meteor/meteor'
import {
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
	IMOSObjectPathType,
	IMOSObjectPath,
	MosDuration,
	IMOSObjectStatus,
	IMOSObjectAirStatus,
	IMOSObject,
	IMOSObjectType
} from 'mos-connection'

import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { literal, getCurrentTime } from '../../lib/lib'
import { logger } from '../logging'
import { RunningOrders } from '../../lib/collections/RunningOrders'

/* tslint:disable:no-irregular-whitespace quotemark whitespace no-consecutive-blank-lines */

// These are temporary methods, used during development to put some data into the database
export function getPD (): PeripheralDevice {
	return PeripheralDevices.findOne({
		type: PeripheralDeviceAPI.DeviceType.MOSDEVICE
	}) as PeripheralDevice
}
Meteor.methods({
	'debug_roCreate' () {
		let pd = getPD()
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, pd._id, pd.token, xmlApiData.roCreate)
	},
	'debug_roReplace' () {
		let pd = getPD()
		Meteor.call(PeripheralDeviceAPI.methods.mosRoReplace, pd._id, pd.token, xmlApiData.roReplace)
	},
	'debug_roDelete' () {
		let pd = getPD()
		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, pd._id, pd.token, new MosString128('' + xmlApiData.roDelete))
	},
	'debug_roMock0_remove' () {
		let pd = getPD()
		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, pd._id, pd.token,
			new MosString128('MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71'))
	},
	'debug_fakeMosDevice' () {
		Meteor.call(PeripheralDeviceAPI.methods.initialize, 'myMockMosDevice', 'token0' , {
			type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,
			name: 'My mockDevice',
			connectionId: '1234'
		})
		PeripheralDevices.update('myMockMosDevice', {$set: {
			studioInstallationId: 'studio0'
		}})
	},
	'debug_roMock0' () {
		let pd = getPD()
		if (!pd) {
			throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
		}
		let id = pd._id
		let token = pd.token
		logger.info('debug_roMock0')
		// @ts-ignore
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token,
			{
				"ID": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
				"Slug": "DKTE TV 1850 ONSDAG",
				"EditorialStart": "2018-05-02T14:50:00,000",
				"EditorialDuration": "0:15:00",
				"MosExternalMetaData": [
					{
						"MosSchema": "http://MAENPSTEST14:10505/schema/enpsro.dtd",
						"MosPayload": {
							"AllowExternalMod": 1,
							"EndTime": "2018-05-02T16:59:00",
							"MOSRedirection": "chyron=chyron.techycami02.ndte.nrk.mos",
							"MOSROStatus": "PLAY",
							"MOSROStatusMOS": "MOSART2.NDTE.MOS",
							"MOSROStatusTime": "2018-05-02T16:50:00",
							"MOSroStorySend": "SOFIE2.XPRO.MOS",
							"ProgramName": "DKTE TV 2055",
							"RundownDuration": "00:09:00",
							"StartTime": "2018-05-02T16:50:00",
							"AnsvRed": "DKTE",
							"Clipnames": "Klipp 1;DKTE99050218AA\\Klipp 2;DKTE99050218AU\\Klipp 3;\\Klipp 4;",
							"Kanal": "NRK1",
							"ProdEnh": "DKTE",
							"ProdNr": "DKTE99050218",
							"Regionalsend": "TE/VE/BU",
							"ROSubType": "Broadcast",
							"LocalStartTime": "2018-05-02T18:50:00+02:00",
							"ENPSItemType": 2,
							"roLayout": "PageNum_600|RowStatus_150|Slug_1200|SegStatus_210|Segment_920|Break_600|Presenter_1000|Approved_600|Estimated_840|Actual_720|FrontTime_1000|BackTime_1000|CumeTime_1000|ModBy_1200|Tekniske-opplysninger_2195"
						},
						"MosScope": "PLAYLIST"
					}
				],
				"Stories": [
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;1E3CAE45-F5D8-4378-AA627DF2C6089897",
						"Slug": "NRK Østafjells;020518-1850",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9141DBA1-93DD-4B19-BEBB32E0D6222E1B",
						"Slug": "Åpning;vignett",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;6364CE48-9B6A-4D36-B7F8352E6E11EDB7",
						"Slug": "Åpning;head-hundepose-020518",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;4CBE86C0-9A69-4EF4-81F8E8CD275092E8",
						"Slug": "Åpning;head-mesterskap-020518-te",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;8B0D9EE2-EF9A-472F-80C6DD2CCDCFC2E6",
						"Slug": "Åpning;velkommen",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;BD68FC84-9654-4E3E-B799104C28B28CAB",
						"Slug": "DROPP BÆSJEPOSE;inn",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;FBB8E962-3DB5-4C92-AD7CA00B33710D1C",
						"Slug": "DROPP BÆSJEPOSE;HUNDEPOSE-020518-te",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;637F3BE2-8154-4E00-ABEBE2C0AED642E8",
						"Slug": "INNSAMLING;tekst",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;79588F90-8422-4FB7-8EC199E3CB93BEA4",
						"Slug": "INNSAMLING;LARVIK-KONKURS",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;E60ED2B4-1BC1-4327-98E4DC0070B42795",
						"Slug": "INNSAMLING;gjest",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;52915640-EDC4-4CF3-92D0F9D41FC26A6E",
						"Slug": "FYLKESMESTERSKAP;inn",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;E13788E2-5F04-4014-A6F8001F35CFFBB4",
						"Slug": "FYLKESMESTERSKAP;MESTERSKAP-020518-TE",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;D215CE3F-0094-4D94-89F9B317ADB1387B",
						"Slug": "Anmeldelse Hassel fengsel;tekst",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;5BF7D6CA-2CF6-479B-B87B02595CAFE170",
						"Slug": "Anmeldelse Hassel fengsel;HASSEL-020518S-TE",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9E41486F-9E9A-421E-9EE410EE88DEF972",
						"Slug": "Anmeldelse Hassel fengsel;HASSEL-020518-TE",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;A0A2BBD6-82EA-4418-A594524FE53C4E40",
						"Slug": "VÆRET;tekst",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;DE1D32B4-8F10-4769-ACCC558EB9A44167",
						"Slug": "VÆRET;VÆRPLAKAT-KYST",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;1CFBCFBF-4713-461E-97AE2A3354FFBB2C",
						"Slug": "VÆRET;VÆRPLAKAT-FJELLET",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;A3D511ED-8C88-46AF-9CB9BA67630A5591",
						"Slug": "KOMMER 2055;tekst",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;5C9D3E10-35DC-4DC5-84A799BA882F7389",
						"Slug": "KOMMER 2055;HEAD-TOG",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;D7850305-1C4D-4D14-91FCE6327C3C0825",
						"Slug": "TAKK FOR I KVELD;Takk for i kveld",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;0C1BCAED-D3C2-4671-B8E96F79860C6308",
						"Slug": "TAKK FOR I KVELD;SLUTTPLAKAT start 18:58:50",
						"Items": []
					},
					{
						"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;EF1A29D9-EF4C-4965-893A4910B2212E66",
						"Slug": "AVSLUTT;Slutt 18.59.00",
						"Items": []
					}
				],
				"level": "debug",
				"message": "",
				"timestamp": "2018-05-15T06:51:29.262Z"
			}
		)
		// BREAK is no longer a valid template
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;1E3CAE45-F5D8-4378-AA627DF2C6089897","Slug":"NRK Østafjells;020518-1850","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N639194","ModTime":"20180514T144034Z","MOSAbstracts":"_00:00:03:00 | @M=Auto Openend | 201 loop | 1: | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations":0,"MOSObjSlugs":"201 loop 1:  2:","MOSSlugs":"NRK ØSTAFJELLS;ddmm15-1845-3","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"<BAK KLARHD<00:01>>","TextTime":0,"SystemApprovedBy":"N12914","mosartType":"BREAK","ReadTime":0,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"chyron.mprochycami02.npro.nrk.mos","mosAbstract":"_00:00:03:00 | @M=Auto Openend | 201 loop | 1: | 2: | 3: | 4: | 00:00:00:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG2","itemSlug":"NRK ØSTAFJELLS;ddmm15-1845-3","mosObj":{"objID":"NYHETER\\00010001?version=1","objSlug":"201 loop 1:  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08","mosPayload":{"sAVsom":"00:00:03:00","sAVeom":"00:00:00:00","createdBy":"N18685","subtype":"lyric/data","subtypeid":"I:\\CAMIO\\NYHETER\\Templates\\Bakskjerm\\00000201.lyr","ObjectDetails":{"ServerID":"chyron.mprochycami02.npro.nrk.mos","ServerURL":"http://160.68.33.159/CAMIO/Redirection/MOSRedirection.asmx"}}}},"itemID":5}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:29.460Z"}
		// )
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9141DBA1-93DD-4B19-BEBB32E0D6222E1B",
				"Slug": "Åpning;vignett",
				"MosExternalMetaData": [{
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
						"MOSAbstracts": "M: NRK Østafjells (20-04-16 09:07)\nTIDSMARKØR IKKE RØR",
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
				}],
				"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
				"Body": [{
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
				}, {
					"Type": "storyItem",
					"Content": {
						"mosID": "mosart.morten.mos",
						"abstract": "TIDSMARKØR IKKE RØR",
						"objID": "STORYSTATUS",
						"objSlug": "Story status",
						"itemID": 10,
						"itemSlug": "VIGNETT;vignett-3"
					}
				}],
				"level": "debug",
				"message": "",
				"timestamp": "2018-05-15T06:51:29.665Z"
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;6364CE48-9B6A-4D36-B7F8352E6E11EDB7",
				"Slug":"Åpning;head-hundepose-020518",
				"MosExternalMetaData":[
				   {
					  "MosScope":"PLAYLIST",
					  "MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd",
					  "MosPayload":{
						 "Approved":0,
						 "Break":0,
						 "Creator":"LINUXENPS",
						 "ElapsedTime":5,
						 "Estimated":10,
						 "MediaTime":0,
						 "ModBy":"N639194",
						 "ModTime":"20180514T143249Z",
						 "MOSAbstracts":"head-hundepose-020518-te NYHETER 00:00:11:19 \nPhiltest27\n_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Vil ikkje ha poser til hundebæsj | 2:Østafjells | 3: | 4: | 00:00:07:00\nTIDSMARKØR IKKE RØR",
						 "MOSItemDurations":"11,76\n11,76\n0",
						 "MOSItemEdDurations":"",
						 "MOSObjSlugs":"head-hundepose-020518-te\nPhiltest27\n52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells\nStory status",
						 "MOSSlugs":"HEAD;head-Bæsjepose-4\nPhiltest27\n52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells\nSAK VESTFOLD;head-3",
						 "MOSTimes":"20180502T165013906Z",
						 "Owner":"LINUXENPS",
						 "Printed":"20180502T164204Z",
						 "SourceMediaTime":0,
						 "SourceTextTime":0,
						 "StoryLogPreview":"Miljøpartiet vil droppe posen til hundebæsjen - slik vil dei spare miljøet. \nOne Two",
						 "StoryProducer":"DKTE",
						 "TextTime":6,
						 "SystemApprovedBy":"N12914",
						 "Kilde":"TV",
						 "mosartType":"STK",
						 "mosartVariant":"HEAD",
						 "OpprLand":"Norge",
						 "ReadTime":6,
						 "Rettigheter":"Grønt",
						 "Team":"(Kun for STK:) Foto: / Redigering:",
						 "ENPSItemType":3
					  }
				   }
				],
				"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
				"Body":[
				   {
					  "Type":"storyItem",
					  "Content":{
						 "itemID":13,
						 "itemSlug":"HEAD;head-Bæsjepose-4",
						 "objID":"\\\\XPRO\\Omn\\C\\S\\25\\07",
						 "mosID":"OMNIBUS.XPRO.MOS",
						 "mosAbstract":"head-hundepose-020518-te NYHETER 00:00:11:19",
						 "objDur":588,
						 "objTB":50,
						 "objSlug":"head-hundepose-020518-te",
						 "mosExternalMetadata":{
							"mosScope":"PLAYLIST",
							"mosSchema":"OMNIBUS",
							"mosPayload":{
							   "title":"head-hundepose-020518-te",
							   "objectType":"CLIP",
							   "clipType":"NYHETER",
							   "objDur":588,
							   "objType":"VIDEO"
							}
						 }
					  }
				   },
				   {
					  "Type":"storyItem",
					  "Content":{
						 "itemID":10,
						 "itemSlug":"Philtest27",
						 "objID":"Philtest27",
						 "mosID":"OMNIBUS.XPRO.MOS",
						 "mosAbstract":"Philtest27",
						 "objDur":588,
						 "objTB":50,
						 "objSlug":"Philtest27",
						 "mosExternalMetadata":{
							"mosScope":"PLAYLIST",
							"mosSchema":"http://mos.ap.org/blah.htm",
							"mosPayload":{
							   "title":"head-hundepose-020518-te",
							   "objectTypex":"CLIP",
							   "clipTypex":"NYHETER",
							   "objDurx":588,
							   "objTypex":"VIDEO"
							}
						 }
					  }
				   },
				   {
					  "Type":"storyItem",
					  "Content":{
						 "mosID":"chyron.techycami02.XPRO.nrk.mos",
						 "abstract":"_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Vil ikkje ha poser til hundebæsj | 2:Østafjells | 3: | 4: | 00:00:07:00",
						 "objPaths":{
							"objProxyPath":{
							   "techDescription":"JPEG Thumbnail",
							   "$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058473_v1_big.jpg"
							},
							"objMetadataPath":{
							}
						 },
						 "itemChannel":"CG1",
						 "itemSlug":"52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells",
						 "mosObj":{
							"objID":"NYHETER\\00058473?version=1",
							"objSlug":"52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells",
							"mosItemEditorProgID":"Chymox.AssetBrowser.1",
							"objDur":0,
							"objTB":0,
							"objPaths":{
							   "objProxyPath":{
								  "techDescription":"JPEG Thumbnail",
								  "$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058473_v1_big.jpg"
							   },
							   "objMetadataPath":{
							   }
							},
							"mosExternalMetadata":{
							   "mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"
							}
						 },
						 "itemID":14
					  }
				   },
				   {
					  "Type":"storyItem",
					  "Content":{
						 "mosID":"mosart.morten.mos",
						 "abstract":"TIDSMARKØR IKKE RØR",
						 "objID":"STORYSTATUS",
						 "objSlug":"Story status",
						 "itemID":3,
						 "itemSlug":"SAK VESTFOLD;head-3"
					  }
				   }
				],
				"level":"debug",
				"message":"",
				"timestamp":"2018-05-15T06:51:29.876Z"
			 }		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;4CBE86C0-9A69-4EF4-81F8E8CD275092E8",
				"Slug":"Åpning;head-mesterskap-020518-te",
				"MosExternalMetaData":[
				   {
					  "MosScope":"PLAYLIST",
					  "MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd",
					  "MosPayload":{
						 "Approved":0,
						 "Creator":"LINUXENPS",
						 "ElapsedTime":7,
						 "MediaTime":0,
						 "ModBy":"N639194",
						 "ModTime":"20180515T063647Z",
						 "MOSAbstracts":"head-mesterskap-020518-te NYHETER 00:00:12:13 \n_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Fylkesmeisterskap i Vestfold | 2:Østafjells | 3: | 4: | 00:00:07:00\nTIDSMARKØR IKKE RØR",
						 "MOSItemDurations":"12,52\n0",
						 "MOSItemEdDurations":"",
						 "MOSObjSlugs":"head-mesterskap-020518-te\n52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells\nStory status",
						 "MOSSlugs":"FYLKESMESTERSKAP;head-mesterskap-020518-te-4\n52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells\nSAK VESTFOLD;head-3",
						 "MOSTimes":"20180502T165021004Z",
						 "Owner":"LINUXENPS",
						 "Printed":"20180502T164204Z",
						 "SourceMediaTime":0,
						 "SourceTextTime":0,
						 "StoryLogPreview":"Lærlingar konkurrerte i barne- og ungdomsarbeiderfaget. Arrangementet skal skape blest rundt yrket.",
						 "StoryProducer":"DKTE",
						 "TextTime":7,
						 "SystemApprovedBy":"N12914",
						 "Kilde":"TV",
						 "mosartType":"STK",
						 "mosartVariant":"HEAD",
						 "OpprLand":"Norge",
						 "ReadTime":7,
						 "Rettigheter":"Grønt",
						 "Team":"(Kun for STK:) Foto: / Redigering:",
						 "ENPSItemType":3
					  }
				   }
				],
				"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
				"Body":[
				   {
					  "Type":"storyItem",
					  "Content":{
						 "itemID":9,
						 "itemSlug":"FYLKESMESTERSKAP;head-mesterskap-020518-te-4",
						 "objID":"\\\\xpro\\Omn\\C\\S\\24\\61",
						 "mosID":"OMNIBUS.XPRO.MOS",
						 "mosAbstract":"head-mesterskap-020518-te NYHETER 00:00:12:13",
						 "objDur":626,
						 "objTB":50,
						 "objSlug":"head-mesterskap-020518-te",
						 "mosExternalMetadata":{
							"mosScope":"PLAYLIST",
							"mosSchema":"OMNIBUS",
							"mosPayload":{
							   "title":"head-mesterskap-020518-te",
							   "objectType":"CLIP",
							   "clipType":"NYHETER",
							   "objDur":626,
							   "objType":"VIDEO"
							}
						 }
					  }
				   },
				   {
					  "Type":"storyItem",
					  "Content":{
						 "itemID":8,
						 "itemSlug":"52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells",
						 "itemChannel":"CG1",
						 "mosID":"chyron.techycami02.xpro.nrk.mos",
						 "abstract":"_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Fylkesmeisterskap i Vestfold | 2:Østafjells | 3: | 4: | 00:00:07:00",
						 "mosObj":{
							"objID":"NYHETER\\00058435?version=1",
							"objSlug":"52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells",
							"mosItemEditorProgID":"Chymox.AssetBrowser.1",
							"objDur":0,
							"objTB":0,
							"objPaths":{
							   "objProxyPath":{
								  "techDescription":"JPEG Thumbnail",
								  "$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058435_v1_big.jpg"
							   },
							   "objMetadataPath":{
							   }
							},
							"mosExternalMetadata":{
							   "mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"
							}
						 }
					  }
				   },
				   {
					  "Type":"storyItem",
					  "Content":{
						 "mosID":"mosart.morten.mos",
						 "abstract":"TIDSMARKØR IKKE RØR",
						 "objID":"STORYSTATUS",
						 "objSlug":"Story status",
						 "itemID":3,
						 "itemSlug":"SAK VESTFOLD;head-3"
					  }
				   }
				],
				"level":"debug",
				"message":"",
				"timestamp":"2018-05-15T06:51:30.074Z"
			 }		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, // @todo gfx?
			{
				"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;8B0D9EE2-EF9A-472F-80C6DD2CCDCFC2E6",
				"Slug":"Åpning;velkommen",
				"MosExternalMetaData":[
				   {
					  "MosScope":"PLAYLIST",
					  "MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd",
					  "MosPayload":{
						 "Approved":0,
						 "Creator":"LINUXENPS",
						 "ElapsedTime":5,
						 "Estimated":0,
						 "MediaTime":0,
						 "ModBy":"N639194",
						 "ModTime":"20180514T135619Z",
						 "MOSAbstracts":"_00:00:00:00 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00\nTIDSMARKØR IKKE RØR",
						 "MOSItemDurations":0,
						 "MOSItemEdDurations":"",
						 "MOSObjSlugs":"50 logo 1:  2:\nStory status",
						 "MOSSlugs":"50 logo 1:  2:\nVelkommen;velkommen-4",
						 "MOSTimes":"20180502T165026622Z",
						 "Owner":"LINUXENPS",
						 "SourceMediaTime":0,
						 "SourceTextTime":0,
						 "StoryLogPreview":"<BAK FADE<00:01:12>>",
						 "TextTime":0,
						 "SystemApprovedBy":"N12914",
						 "mosartType":"KAM",
						 "mosartVariant":"ÅPNING3",
						 "ReadTime":0,
						 "ENPSItemType":3
					  }
				   }
				],
				"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71",
				"Body":[
				   {
					  "Type":"storyItem",
					  "Content":{
						 "mosID":"chyron.techycami02.xpro.nrk.mos",
						 "abstract":"_00:00:00:00 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00",
						 "objPaths":{
							"objProxyPath":{
							   "techDescription":"JPEG Thumbnail",
							   "$t":"http://160.68.33.159/thumbs/NYHETER/16000/Objects_NYHETER_00016967_v1_big.jpg"
							},
							"objMetadataPath":{
							}
						 },
						 "itemChannel":"CG1",
						 "itemSlug":"50 logo 1:  2:",
						 "mosObj":{
							"objID":"NYHETER\\00016967?version=1",
							"objSlug":"50 logo 1:  2:",
							"mosItemEditorProgID":"Chymox.AssetBrowser.1",
							"objDur":0,
							"objTB":0,
							"objPaths":{
							   "objProxyPath":{
								  "techDescription":"JPEG Thumbnail",
								  "$t":"http://160.68.33.159/thumbs/NYHETER/16000/Objects_NYHETER_00016967_v1_big.jpg"
							   },
							   "objMetadataPath":{
							   }
							},
							"mosExternalMetadata":{
							   "mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"
							}
						 },
						 "itemID":6
					  }
				   },
				   {
					  "Type":"storyItem",
					  "Content":{
						 "mosID":"mosart.morten.mos",
						 "abstract":"TIDSMARKØR IKKE RØR",
						 "objID":"STORYSTATUS",
						 "objSlug":"Story status",
						 "itemID":5,
						 "itemSlug":"Velkommen;velkommen-4"
					  }
				   }
				],
				"level":"debug",
				"message":"",
				"timestamp":"2018-05-15T06:51:30.275Z"
			 }		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, // @todo gfx
			{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;BD68FC84-9654-4E3E-B799104C28B28CAB","Slug":"DROPP BÆSJEPOSE;inn","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"LINUXENPS","ElapsedTime":8,"MediaTime":0,"ModBy":"N639194","ModTime":"20180514T135819Z","MOSAbstracts":"_00:00:00:00 | @M=Auto Storyend | 202 bilde | 1:0205-hundebæsj | 2: | 3: | 4: | 00:00:00:00\n_00:00:02:00 | @M=Auto Timed | 01 ett navn | 1:Martin Torstveit | 2:2.mai 2018 | 3: | 4: | 00:00:05:00\nTIDSMARKØR IKKE RØR","MOSItemDurations":"0\n0","MOSItemEdDurations":"","MOSObjSlugs":"202 bilde 1:0205-hundebæsj  2:\n01 ett navn 1:Martin Torstveit  2:2.mai 2018\nStory status","MOSSlugs":"202 bilde 1:0205-hundebæsj  2:\n01 ett navn 1:Martin Torstveit  2:2.mai 2018\nSAK 1;intro-3","MOSTimes":"20180502T165034836Z","Owner":"LINUXENPS","Printed":"20180502T164204Z","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"(K3) God kveld og velkommen. Folk bør la hundebæsjen bli liggande når dei er ute og lufter bikkja. Det meiner Miljøpartiet De Grønne. Partiet meiner det kan redusere mengden poser me kaster i søpla.","TextTime":13,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":3,"ReadTime":13,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":5,"itemSlug":"202 bilde 1:0205-hundebæsj  2:","itemChannel":"CG2","mosID":"chyron.techycami02.xpro.nrk.mos","abstract":"_00:00:00:00 | @M=Auto Storyend | 202 bilde | 1:0205-hundebæsj | 2: | 3: | 4: | 00:00:00:00","mosObj":{"objID":"NYHETER\\00058461?version=1","objSlug":"202 bilde 1:0205-hundebæsj  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058461_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.xpro.nrk.mos","abstract":"_00:00:02:00 | @M=Auto Timed | 01 ett navn | 1:Martin Torstveit | 2:2.mai 2018 | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058439_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Martin Torstveit  2:2.mai 2018","mosObj":{"objID":"NYHETER\\00058439?version=1","objSlug":"01 ett navn 1:Martin Torstveit  2:2.mai 2018","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058439_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":8}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:30.478Z"}
		)
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;FBB8E962-3DB5-4C92-AD7CA00B33710D1C","Slug":"DROPP BÆSJEPOSE;HUNDEPOSE-020518-te","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"LINUXENPS","ElapsedTime":114,"Estimated":114,"MediaTime":114.52,"ModBy":"N639194","ModTime":"20180514T140141Z","MOSAbstracts":"METADATA\n HUNDEPOSE-020518-TE NYHETER 00:01:54:13 \n_00:00:02:00 | @M=Manual Timed | 01 ett navn | 1:Maria Kommandantvold | 2:reporter | 3: | 4: | 00:00:05:00\n_00:00:24:11 | @M=Auto Timed | 01 ett navn | 1:Christina Albrecht Olsen | 2:Sankt Hansberget barnehage | 3: | 4: | 00:00:04:00\n_00:00:45:00 | @M=Auto Timed | 01 ett navn | 1:Hanne Lisa Matt | 2:Miljøpartiet De Grønne | 3: | 4: | 00:00:05:00\n_00:01:06:00 | @M=Auto Timed | 01 ett navn | 1:Louise Abel Morberg | 2:hundeeier | 3: | 4: | 00:00:05:00\n_00:01:47:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Tordis Gauteplass | 3: | 4: | 00:00:04:00\nTIDSMARKØR IKKE RØR","MOSItemDurations":"114,52\n0\n0\n0\n0\n0","MOSItemEdDurations":"","MOSObjSlugs":"M: \nHUNDEPOSE-020518-TE\n01 ett navn 1:Maria Kommandantvold  2:reporter\n01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage\n01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne\n01 ett navn 1:Louise Abel Morberg  2:hundeeier\n24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass\nStory status","MOSSlugs":"SAK BUSKERUD;SAK-14\nDROPP BÆSJEPOSE;HUNDEPOSE-020518-te-12\n01 ett navn 1:Maria Kommandantvold  2:reporter\n01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage\n01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne\n01ett navn 1:Louise Abel Morberg  2:hundeeier\n24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass\nSAK BUSKERUD;SAK-20","MOSTimes":"20180515T064107Z\n\n\n\n\n\n20180502T165229810Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"","StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Kilde":"TV","mosartTransition":"","mosartType":"FULL","ReadTime":114.52,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":2,"objID":"N11580_1412594672","mosID":"METADATA.NRK.MOS","mosAbstract":"METADATA","objSlug":"M:","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"type":"video","changedBy":"N11580","changetime":"2014-10-06T13:24:32 +02:00","title":{},"description":{},"hbbtv":{"link":""},"rights":{"notes":"","owner":"NRK","$t":"Green"}}}},"itemSlug":"SAK BUSKERUD;SAK-14"}},{"Type":"storyItem","Content":{"itemID":15,"itemSlug":"DROPP BÆSJEPOSE;HUNDEPOSE-020518-te-12","objID":"\\\\xpro\\Omn\\C\\S\\24\\70","mosID":"OMNIBUS.xpro.MOS","abstract":"HUNDEPOSE-020518-TE NYHETER 00:01:54:13","objDur":5726,"objTB":50,"objSlug":"HUNDEPOSE-020518-TE","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.xpro.nrk.mos","abstract":"_00:00:02:00 | @M=Manual Timed | 01 ett navn | 1:Maria Kommandantvold | 2:reporter | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058457_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Maria Kommandantvold  2:reporter","mosObj":{"objID":"NYHETER\\00058457?version=1","objSlug":"01 ett navn 1:Maria Kommandantvold  2:reporter","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058457_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":16}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.xpro.nrk.mos","abstract":"_00:00:24:11 | @M=Auto Timed | 01 ett navn | 1:Christina Albrecht Olsen | 2:Sankt Hansberget barnehage | 3: | 4: | 00:00:04:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058464_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage","mosObj":{"objID":"NYHETER\\00058464?version=1","objSlug":"01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058464_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":17}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.xpro.nrk.mos","abstract":"_00:00:45:00 | @M=Auto Timed | 01 ett navn | 1:Hanne Lisa Matt | 2:Miljøpartiet De Grønne | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058458_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne","mosObj":{"objID":"NYHETER\\00058458?version=1","objSlug":"01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058458_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":18}},{"Type":"storyItem","Content":{"itemID":19,"itemSlug":"01 ett navn 1:Louise Abel Morberg  2:hundeeier","itemChannel":"CG1","mosID":"chyron.techycami02.xpro.nrk.mos","abstract":"_00:01:06:00 | @M=Auto Timed | 01 ett navn | 1:Louise Abel Morberg | 2:hundeeier | 3: | 4: | 00:00:05:00","mosObj":{"objID":"NYHETER\\00058478?version=1","objSlug":"01 ett navn 1:Louise Abel Morberg  2:hundeeier","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058478_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.xpro.nrk.mos","abstract":"_00:01:47:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Tordis Gauteplass | 3: | 4: | 00:00:04:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058463_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass","mosObj":{"objID":"NYHETER\\00058463?version=1","objSlug":"24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058463_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":21}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":8,"itemSlug":"SAK BUSKERUD;SAK-20"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:30.708Z"}
		// )
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, // @todo gfx
			{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;637F3BE2-8154-4E00-ABEBE2C0AED642E8","Slug":"INNSAMLING;tekst","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","ElapsedTime":17,"Estimated":20,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T164244Z","MOSAbstracts":"TIDSMARKØR IKKE RØR","MOSObjSlugs":"Story status","MOSSlugs":"SAK 1;intro-3","MOSTimes":"20180502T165235816Z","Owner":"LINUXENPS","Printed":"20180502T164204Z","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"(K2) Larvik håndballklubb har fått inn omkring 2,5 millioner kroner i gåvepengar, (***) som skal redde klubben frå konkurs.\nKlubben manglar likevel omlag 500.000 kroner for å nå målet på tre millionar kroner.","TextTime":18,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":2,"ReadTime":18,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:30.883Z"}
		)
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;79588F90-8422-4FB7-8EC199E3CB93BEA4","Slug":"INNSAMLING;LARVIK-KONKURS","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T150756Z","MOSAbstracts":"METADATA\n LARVIK-KONKURS-020518S-TE NYHETER 00:00:30:01 \n_00:00:00:00 | @M=Auto Timed | 10 info | 1:Larvik treng pengar | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations":"30,04\n0","MOSItemEdDurations":"","MOSObjSlugs":"M: \nLARVIK-KONKURS-020518S-TE\n10 info 1:Larvik treng pengar  2:","MOSSlugs":"STK 1;STK-5\nINNSAMLING;STK-2\n10 info 1:Larvik treng pengar  2:","MOSTimes":"","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Kilde":"TV","mosartType":"STK","OpprLand":"Norge","ReadTime":0,"Rettigheter":"Grønt","Team":"(Kun for STK:) Foto: / Redigering:","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":4,"objID":"N11580_1412594672","mosID":"METADATA.NRK.MOS","mosAbstract":"METADATA","objSlug":"M:","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"type":"video","changedBy":"N11580","changetime":"2014-10-06T13:24:32 +02:00","title":{},"description":{},"hbbtv":{"link":""},"rights":{"notes":"","owner":"NRK","$t":"Green"}}}},"itemSlug":"STK 1;STK-5"}},{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"INNSAMLING;STK-2","objID":"\\\\NDTE\\Omn\\C\\S\\24\\64","mosID":"OMNIBUS.NDTE.MOS","abstract":"LARVIK-KONKURS-020518S-TE NYHETER 00:00:30:01","objDur":1502,"objTB":50,"objSlug":"LARVIK-KONKURS-020518S-TE","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:00:00 | @M=Auto Timed | 10 info | 1:Larvik treng pengar | 2: | 3: | 4: | 00:00:00:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058452_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"10 info 1:Larvik treng pengar  2:","mosObj":{"objID":"NYHETER\\00058452?version=1","objSlug":"10 info 1:Larvik treng pengar  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058452_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":5}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:31.085Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;E60ED2B4-1BC1-4327-98E4DC0070B42795","Slug":"INNSAMLING;gjest","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Actual":120,"Approved":1,"Creator":"LINUXENPS","ElapsedTime":109,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T143332Z","MOSAbstracts":"_00:02:00:00 | @M=Manual Timed | 01 ett navn | 1:Cathrine Svendsen | 2:styreleder, LHK | 3: | 4: | 00:00:00:00\nTIDSMARKØR IKKE RØR","MOSItemDurations":0,"MOSItemEdDurations":"","MOSObjSlugs":"01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK\nStory status","MOSSlugs":"01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK\nSAK 1;intro-3","MOSTimes":"20180502T165437473Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"TextTime":0,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":3,"ReadTime":0,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":{},"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058436_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK","mosObj":{"objID":"NYHETER\\00058436?version=1","objSlug":"01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058436_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":3}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:31.288Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;52915640-EDC4-4CF3-92D0F9D41FC26A6E","Slug":"FYLKESMESTERSKAP;inn","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","ElapsedTime":15,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T163813Z","MOSAbstracts":"TIDSMARKØR IKKE RØR","MOSObjSlugs":"Story status","MOSSlugs":"SAK 1;intro-3","MOSTimes":"20180502T165453205Z","Owner":"LINUXENPS","Printed":"20180502T164204Z","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"(K2) I dag blei det arrangert fylkesmesterskap i barne- og ungdomsarbeiderfaget i Re kommune i Vestfold. \nGjennom forskjellige konkurransar fekk lærlingar vist fram sine ferdigheter.","TextTime":18,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":2,"ReadTime":18,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:31.495Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;E13788E2-5F04-4014-A6F8001F35CFFBB4","Slug":"FYLKESMESTERSKAP;MESTERSKAP-020518-TE","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","ElapsedTime":96,"Estimated":110,"MediaTime":96.24,"ModBy":"N12914","ModTime":"20180502T144537Z","MOSAbstracts":"M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget (02-05-18 15:10)\n MESTERSKAP-020518-TE NYHETER 00:01:36:06 \n_00:00:07:00 | @M=Auto Timed | 01 ett navn | 1:Anne Melsom Bjerke | 2:reporter | 3: | 4: | 00:00:05:00\n_00:00:19:00 | @M=Auto Timed | 01 ett navn | 1:Marius | 2: | 3: | 4: | 00:00:05:00\n_00:00:46:00 | @M=Auto Timed | 01 ett navn | 1:Hilde Abrahamsen | 2:Fagforbundet i Vestfold  | 3: | 4: | 00:00:05:00\n_00:01:11:00 | @M=Auto Timed | 01 ett navn | 1:Sandra Blegeberg Sørsdahl | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00\n_00:01:21:00 | @M=Auto Timed | 01 ett navn | 1:Juliane Svalestad | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00\n_00:01:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Henrik Bøe | 3: | 4: | 00:00:05:00\nTIDSMARKØR IKKE RØR","MOSItemDurations":"96,24\n0\n0\n0\n0\n0\n0","MOSItemEdDurations":"","MOSObjSlugs":"M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget\nMESTERSKAP-020518-TE\n01 ett navn 1:Anne Melsom Bjerke  2:reporter\n01 ett navn 1:Marius  2:\n01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold \n01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider\n01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider\n24 foto/red 1:Foto og redigering:  2:Henrik Bøe\nStory status","MOSSlugs":"SAK BUSKERUD;SAK-14\nFYLKESMESTERSKAP;MESTERSKAP-020518-TE-13\n01 ett navn 1:Anne Melsom Bjerke  2:reporter\n01 ett navn 1:Marius  2:\n01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold \n01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider\n01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider\n24 foto/red 1:Foto og redigering:  2:Henrik Bøe\nSAK BUSKERUD;SAK-20","MOSTimes":"20180502T131049Z\n20180502T131049Z\n\n20180502T131049Z\n20180502T131049Z\n20180502T131049Z\n20180502T165629890Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":51,"StoryLogPreview":"<LYS Q1>","StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Bildebeskrivelse":"Bilder fra tre lag som deltar i fylkesmesterskap ( Vestfold) i barne- og ungdomsarbeiderfaget. lærlinger har ulike konkurranser med barna. dommere evaluerer","Fylke":"Vestfold","Innslagstittel":"Fylkesmesterskap i barne- og ungdomsarbeiderfaget","Kilde":"TV","Kommune":"Re","mosartTransition":"","mosartType":"FULL","OpprLand":"Norge","ReadTime":96.24,"Rettigheter":"Grønt","Rettighetseier":"NRK","Sted":"Re","Tags":"barne- og ungdomsarbeider; studier; yrkesfag; fylkesmesterskap","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":2,"objID":"N23194_1525266622","mosID":"METADATA.NRK.MOS","mosAbstract":"M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget (02-05-18 15:10)","objSlug":"M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"changetime":"2018-05-02T15:10:21 +02:00","changedBy":"N23194","type":"video","mdSource":"omnibus","title":"Fylkesmesterskap i barne- og ungdomsarbeiderfaget","description":"Bilder fra tre lag som deltar i fylkesmesterskap ( Vestfold) i barne- og ungdomsarbeiderfaget. lærlinger har ulike konkurranser med barna. dommere evaluerer","hbbtv":{"link":""},"location":{"id":"1-46146","region":"Vestfold","lat":59.33946,"lon":10.23902,"$t":"Re"},"tag":[{"id":96183,"$t":"barne- og ungdomsarbeider"},{"id":5371,"$t":"studier"},{"id":6277,"$t":"yrkesfag"},{"id":95503,"$t":"fylkesmesterskap"}],"rights":{"notes":"","owner":"NRK","$t":"Green"}}}},"itemSlug":"SAK BUSKERUD;SAK-14"}},{"Type":"storyItem","Content":{"itemID":13,"itemSlug":"FYLKESMESTERSKAP;MESTERSKAP-020518-TE-13","objID":"\\\\NDTE\\Omn\\C\\S\\24\\60","mosID":"OMNIBUS.NDTE.MOS","abstract":"MESTERSKAP-020518-TE NYHETER 00:01:36:06","objDur":4812,"objTB":50,"objSlug":"MESTERSKAP-020518-TE","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:07:00 | @M=Auto Timed | 01 ett navn | 1:Anne Melsom Bjerke | 2:reporter | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058417_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Anne Melsom Bjerke  2:reporter","mosObj":{"objID":"NYHETER\\00058417?version=1","objSlug":"01 ett navn 1:Anne Melsom Bjerke  2:reporter","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058417_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":3}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:19:00 | @M=Auto Timed | 01 ett navn | 1:Marius | 2: | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058418_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Marius  2:","mosObj":{"objID":"NYHETER\\00058418?version=1","objSlug":"01 ett navn 1:Marius  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058418_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":4}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:46:00 | @M=Auto Timed | 01 ett navn | 1:Hilde Abrahamsen | 2:Fagforbundet i Vestfold  | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058431_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold","mosObj":{"objID":"NYHETER\\00058431?version=1","objSlug":"01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058431_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":5}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:01:11:00 | @M=Auto Timed | 01 ett navn | 1:Sandra Blegeberg Sørsdahl | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058426_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider","mosObj":{"objID":"NYHETER\\00058426?version=1","objSlug":"01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058426_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":6}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:01:21:00 | @M=Auto Timed | 01 ett navn | 1:Juliane Svalestad | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058427_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider","mosObj":{"objID":"NYHETER\\00058427?version=1","objSlug":"01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058427_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":12}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:01:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Henrik Bøe | 3: | 4: | 00:00:05:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058428_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"24 foto/red 1:Foto og redigering:  2:Henrik Bøe","mosObj":{"objID":"NYHETER\\00058428?version=1","objSlug":"24 foto/red 1:Foto og redigering:  2:Henrik Bøe","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058428_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":7}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":8,"itemSlug":"SAK BUSKERUD;SAK-20"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:31.720Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;D215CE3F-0094-4D94-89F9B317ADB1387B","Slug":"Anmeldelse Hassel fengsel;tekst","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","ElapsedTime":33,"Estimated":20,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T163820Z","MOSAbstracts":"TIDSMARKØR IKKE RØR","MOSObjSlugs":"Story status","MOSSlugs":"SAK 1;intro-3","MOSTimes":"20180502T165636486Z","Owner":"LINUXENPS","Printed":"20180502T164204Z","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"(K2)  Minst ein Tilsett ved Hassel fengsel i Øvre Eiker er anmeldt til politiet av fengsels-leiinga, etter at en kollega sist helg varsla om kritikkverdige forhold.(***)","TextTime":34,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":2,"ReadTime":34,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:31.897Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;5BF7D6CA-2CF6-479B-B87B02595CAFE170","Slug":"Anmeldelse Hassel fengsel;HASSEL-020518S-TE","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T163821Z","MOSAbstracts":"METADATA\n HASSEL-020518S-TE NYHETER 00:00:23:11 \n_00:00:00:00 | @M=Auto Timed | 10 info | 1:Tilsett meldt til politiet | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations":"23,44\n0","MOSItemEdDurations":"","MOSObjSlugs":"M: \nHASSEL-020518S-TE\n10 info 1:Tilsett meldt til politiet  2:","MOSSlugs":"STK 2;STK-5\nAnmeldelse Hassel fengsel;STK-2\n10 info 1:Tilsett meldt til politiet  2:","MOSTimes":"","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Kilde":"TV","mosartType":"STK","OpprLand":"Norge","ReadTime":0,"Rettigheter":"Grønt","Team":"(Kun for STK:) Foto: / Redigering:","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":4,"objID":"N11580_1412594672","mosID":"METADATA.NRK.MOS","mosAbstract":"METADATA","objSlug":"M:","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"type":"video","changedBy":"N11580","changetime":"2014-10-06T13:24:32 +02:00","title":{},"description":{},"hbbtv":{"link":""},"rights":{"notes":"","owner":"NRK","$t":"Green"}}}},"itemSlug":"STK 2;STK-5"}},{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"Anmeldelse Hassel fengsel;STK-2","objID":"\\\\NDTE\\Omn\\C\\S\\25\\11","mosID":"OMNIBUS.NDTE.MOS","abstract":"HASSEL-020518S-TE NYHETER 00:00:23:11","objDur":1172,"objTB":50,"objSlug":"HASSEL-020518S-TE","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":{},"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058484_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"10 info 1:Tilsett meldt til politiet  2:","mosObj":{"objID":"NYHETER\\00058484?version=1","objSlug":"10 info 1:Tilsett meldt til politiet  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058484_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":5}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:32.099Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9E41486F-9E9A-421E-9EE410EE88DEF972","Slug":"Anmeldelse Hassel fengsel;HASSEL-020518-TE","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","ElapsedTime":33,"Estimated":25,"MediaTime":32.76,"ModBy":"N12914","ModTime":"20180502T163120Z","MOSAbstracts":"M: Fengselansatt anmeldt til politiet (02-05-18 18:11)\nHASSEL-020518F-TE NYHETER 00:00:32:19\n_00:00:02:00 | @M=Auto Timed | 01 ett navn | 1:Rita Kilvær | 2:regiondirektør, Kriminalomsorgen, region sør | 3: | 4: | 00:00:05:00\n_00:00:15:00 | @M=Auto Timed | 01 ett navn | 1:Fabian Skalleberg Nilsen | 2:reporter | 3: | 4: | 00:00:05:00\n_00:00:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto/redigering: | 2:Harald Inderhaug | 3: | 4: | 00:00:04:00\nTIDSMARKØR IKKE RØR","MOSItemDurations":"32,76\n0\n0\n0","MOSItemEdDurations":"","MOSObjSlugs":"M: Fengselansatt anmeldt til politiet\nHASSEL-020518F-TE\n01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør\n01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter\n24 foto/red 1:Foto/redigering:  2:Harald Inderhaug\nStory status","MOSSlugs":"STK 2;SYNK-5\nAnmeldelse Hassel fengsel;SYNK-2\n01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør\n01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter\n24 foto/red 1:Foto/redigering:  2:Harald Inderhaug\nREGISTERING stk - synk;SYNK-4","MOSTimes":"20180502T165736551Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Bildebeskrivelse":"skilt av fengselet, nærbilde av gårdsanlegg ved fengselet, låve, bil, totalutsnitt til slutt","Fylke":"Buskerud","Innslagstittel":"Fengselansatt anmeldt til politiet","Kilde":"TV","Kommune":"Øvre Eiker","mosartType":"FULL","OpprLand":"Norge","ReadTime":32.76,"Rettigheter":"Grønt","Rettighetseier":"NRK","Sted":"Skotselv","Tags":"fengsel; varsel; personalsak","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":4,"objID":"N22778_1525277484","mosID":"METADATA.NRK.MOS","mosAbstract":"M: Fengselansatt anmeldt til politiet (02-05-18 18:11)","objSlug":"M: Fengselansatt anmeldt til politiet","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"changetime":"2018-05-02T18:11:24 +02:00","changedBy":"N22778","type":"video","mdSource":"omnibus","title":"Fengselansatt anmeldt til politiet","description":"skilt av fengselet, nærbilde av gårdsanlegg ved fengselet, låve, bil, totalutsnitt til slutt","hbbtv":{"link":""},"location":{"id":"1-71323","region":"Øvre Eiker, Buskerud","lat":59.84503,"lon":9.88406,"$t":"Skotselv"},"tag":[{"id":1306,"$t":"fengsel"},{"id":90383,"$t":"varsel"},{"id":4068,"$t":"personalsak"}],"rights":{"notes":"","owner":"NRK","$t":"Green"}}}},"itemSlug":"STK 2;SYNK-5"}},{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"Anmeldelse Hassel fengsel;SYNK-2","objID":"\\\\NDTE\\Omn\\C\\S\\25\\16","mosID":"OMNIBUS.NDTE.MOS","abstract":"HASSEL-020518F-TE NYHETER 00:00:32:19","objDur":1638,"objTB":50,"objSlug":"HASSEL-020518F-TE","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":{},"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058472_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør","mosObj":{"objID":"NYHETER\\00058472?version=1","objSlug":"01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058472_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":5}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":{},"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058474_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter","mosObj":{"objID":"NYHETER\\00058474?version=1","objSlug":"01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058474_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":7}},{"Type":"storyItem","Content":{"itemID":8,"itemSlug":"24 foto/red 1:Foto/redigering:  2:Harald Inderhaug","itemChannel":"CG1","mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto/redigering: | 2:Harald Inderhaug | 3: | 4: | 00:00:04:00","mosObj":{"objID":"NYHETER\\00058476?version=1","objSlug":"24 foto/red 1:Foto/redigering:  2:Harald Inderhaug","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058476_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":6,"itemSlug":"REGISTERING stk - synk;SYNK-4"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:32.305Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;A0A2BBD6-82EA-4418-A594524FE53C4E40","Slug":"VÆRET;tekst","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Break":0,"Creator":"LINUXENPS","ElapsedTime":45,"Estimated":20,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T163122Z","MOSAbstracts":"TIDSMARKØR IKKE RØR","MOSObjSlugs":"Story status","MOSSlugs":"SAK 1;intro-3","MOSTimes":"20180502T165740729Z","Owner":"LINUXENPS","Printed":"20180502T164204Z","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"(K2) Så skal me ta ein kikk på været.(***) Det er venta Sørøstleg bris og periodar med liten kuling på kysten. Regn store delar av dagen, før det skal bli oppholdsvær på kvelden.(***) I fjellet er det også venta sørøsteleg bris, og stiv kuling utsatte stader. Regn og sludd store delar av dagen. Det er også venta snøbyger over 800 meter. Før det skal bli lettare vær på kvelden.","TextTime":25,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":2,"ReadTime":25,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:32.510Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;DE1D32B4-8F10-4769-ACCC558EB9A44167","Slug":"VÆRET;VÆRPLAKAT-KYST","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T150734Z","MOSAbstracts":"M: Været (05-02-18 13:47)\n VARET-KYST-020518-TE NYHETER 00:00:28:07 \n_00:00:00:00 | @M=Auto Timed | 82 ticker meteorolog | 1: | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations":"28,28\n0","MOSItemEdDurations":"","MOSObjSlugs":"M: Været\nVARET-KYST-020518-TE\n82 ticker meteorolog 1:  2:","MOSSlugs":"STK 2;STK-5\nVÆRET;VÆRPLAKAT-KYST-2\n82 ticker meteorolog 1:  2:","MOSTimes":"20180502T131049Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Bildebeskrivelse":"","Innslagstittel":"Været","Kilde":"TV","mosartType":"STK","ReadTime":0,"Rettigheter":"Grønt","Rettighetseier":"NRK","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":4,"objID":"N20248_1517834844","mosID":"METADATA.NRK.MOS","mosAbstract":"M: Været (05-02-18 13:47)","objSlug":"M: Været","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"changetime":"2018-02-05T13:47:23 +01:00","changedBy":"N20248","type":"video","mdSource":"omnibus","title":"Været","description":{},"hbbtv":{"link":""},"rights":{"notes":"","owner":"NRK","$t":"Green"}}}},"itemSlug":"STK 2;STK-5"}},{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"VÆRET;VÆRPLAKAT-KYST-2","objID":"\\\\NDTE\\Omn\\C\\S\\24\\65","mosID":"OMNIBUS.NDTE.MOS","abstract":"VARET-KYST-020518-TE NYHETER 00:00:28:07","objDur":1414,"objTB":50,"objSlug":"VARET-KYST-020518-TE","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}},{"Type":"storyItem","Content":{"itemID":5,"itemSlug":"82 ticker meteorolog 1:  2:","itemChannel":"CG1","mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:00:00 | @M=Auto Timed | 82 ticker meteorolog | 1: | 2: | 3: | 4: | 00:00:00:00","mosObj":{"objID":"NYHETER\\00053302?version=1","objSlug":"82 ticker meteorolog 1:  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/53000/Objects_NYHETER_00053302_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:32.718Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;1CFBCFBF-4713-461E-97AE2A3354FFBB2C","Slug":"VÆRET;VÆRPLAKAT-FJELLET","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T150733Z","MOSAbstracts":"VARET-FJELL-020518-TE NYHETER 00:00:26:22","MOSItemDurations":"26,88","MOSObjSlugs":"VARET-FJELL-020518-TE","MOSSlugs":"VÆRET;VÆRPLAKAT-FJELLET-2","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Kilde":"TV","mosartTransition":"mix 12","mosartType":"STK","OpprLand":"Norge","ReadTime":0,"Rettigheter":"Grønt","Team":"(Kun for STK:) Foto: / Redigering:","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"VÆRET;VÆRPLAKAT-FJELLET-2","objID":"\\\\NDTE\\Omn\\C\\S\\24\\66","mosID":"OMNIBUS.NDTE.MOS","abstract":"VARET-FJELL-020518-TE NYHETER 00:00:26:22","objDur":1344,"objTB":50,"objSlug":"VARET-FJELL-020518-TE","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:32.915Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;A3D511ED-8C88-46AF-9CB9BA67630A5591","Slug":"KOMMER 2055;tekst","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","Estimated":15,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T163826Z","MOSAbstracts":"TIDSMARKØR IKKE RØR","MOSObjSlugs":"Story status","MOSSlugs":"SAK 1;intro-3","Owner":"LINUXENPS","Printed":"20180502T164204Z","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"Om drøye fire månader åpner dobbelsporet, som skal gje 22 minutter kortere togtid mellom Larvik og Porsgrunn. Me har vore med på testuren. Meir om det i  kåns neste sending.(*) Det var alt me hadde i denne omgang. Me er tilbake klokka 20:55. Takk for nå.","TextTime":17,"SystemApprovedBy":"N12914","mosartType":"","ReadTime":17,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:33.115Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;5C9D3E10-35DC-4DC5-84A799BA882F7389","Slug":"KOMMER 2055;HEAD-TOG","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T163127Z","MOSAbstracts":"METADATA\n HEAD-TOG NYHETER 00:00:24:16 \n_00:00:00:00 | @M=Auto Storyend | 09 teaser | 1:Se sendingen kl. 20.55 | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations":"24,64\n0","MOSItemEdDurations":"","MOSObjSlugs":"M: \nHEAD-TOG\n09 teaser 1:Se sendingen kl. 20.55  2:","MOSSlugs":"STK 2;STK-5\nKOMMER 2055;STK-2\n09 teaser 1:Se sendingen kl. 20.55  2:","MOSTimes":"","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Kilde":"TV","mosartTransition":"","mosartType":"STK","OpprLand":"Norge","ReadTime":0,"Rettigheter":"Grønt","Team":"(Kun for STK:) Foto: / Redigering:","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":4,"objID":"N11580_1412594672","mosID":"METADATA.NRK.MOS","mosAbstract":"METADATA","objSlug":"M:","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"type":"video","changedBy":"N11580","changetime":"2014-10-06T13:24:32 +02:00","title":{},"description":{},"hbbtv":{"link":""},"rights":{"notes":"","owner":"NRK","$t":"Green"}}}},"itemSlug":"STK 2;STK-5"}},{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"KOMMER 2055;STK-2","objID":"\\\\NDTE\\Omn\\C\\S\\25\\15","mosID":"OMNIBUS.NDTE.MOS","abstract":"HEAD-TOG NYHETER 00:00:24:16","objDur":1232,"objTB":50,"objSlug":"HEAD-TOG","mosExternalMetadata":{"mosSchema":"OMNIBUS"}}},{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":{},"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058479_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"09 teaser 1:Se sendingen kl. 20.55  2:","mosObj":{"objID":"NYHETER\\00058479?version=1","objSlug":"09 teaser 1:Se sendingen kl. 20.55  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058479_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":6}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:33.330Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;D7850305-1C4D-4D14-91FCE6327C3C0825","Slug":"TAKK FOR I KVELD;Takk for i kveld","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","ElapsedTime":7,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T154537Z","MOSAbstracts":"_00:00:00:01 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00\nTIDSMARKØR IKKE RØR","MOSItemDurations":0,"MOSItemEdDurations":"","MOSObjSlugs":"50 logo 1:  2:\nStory status","MOSSlugs":"TAKK FOR IKVELD + BILDEKOLLAGE;Takk for ikveld-20\nTAKK FOR IKVELD + BILDEKOLLAGE;seerbilder-18","MOSTimes":"20180502T131049Z\n20180502T165829637Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"TextTime":0,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":"TAKK2","ReadTime":0,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:00:01 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010009_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"TAKK FOR IKVELD + BILDEKOLLAGE;Takk for ikveld-20","mosObj":{"objID":"NYHETER\\00010009?version=1","objSlug":"50 logo 1:  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010009_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":3}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":4,"itemSlug":"TAKK FOR IKVELD + BILDEKOLLAGE;seerbilder-18"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:33.520Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;0C1BCAED-D3C2-4671-B8E96F79860C6308","Slug":"TAKK FOR I KVELD;SLUTTPLAKAT start 18:58:50","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Actual":10,"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T132212Z","MOSAbstracts":"_00:00:00:00 | @M=Auto Openend | 67 sluttkredit kort | 1:Redaktør | 2:Stig Bolme | 3:Produsent | 4:Berit Heggholmen | 00:00:00:00\nTIDSMARKØR IKKE RØR","MOSItemDurations":0,"MOSItemEdDurations":"","MOSObjSlugs":"67 sluttkredit kort 1:Redaktør  2:Stig Bolme\nStory status","MOSSlugs":"67 sluttkredit kort 1:Redaktør  2:Stig Bolme\nTAKK FOR I KVELD;KAM-3","MOSTimes":"20180502T165829644Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"TextTime":0,"SystemApprovedBy":"N12914","mosartType":"KAM","mosartVariant":"SLUTTR3","ReadTime":0,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":{},"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058432_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG1","itemSlug":"67 sluttkredit kort 1:Redaktør  2:Stig Bolme","mosObj":{"objID":"NYHETER\\00058432?version=1","objSlug":"67 sluttkredit kort 1:Redaktør  2:Stig Bolme","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","$t":"http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058432_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":5}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":4,"itemSlug":"TAKK FOR I KVELD;KAM-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:33.731Z"}
		// )
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;EF1A29D9-EF4C-4965-893A4910B2212E66","Slug":"AVSLUTT;Slutt 18.59.00","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T132213Z","MOSAbstracts":"TIDSMARKØR IKKE RØR","MOSObjSlugs":"Story status","MOSSlugs":"SAK 1;intro-3","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"TextTime":0,"SystemApprovedBy":"N12914","mosartType":"BREAK","ReadTime":0,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":2,"itemSlug":"SAK 1;intro-3"}}],"level":"debug","message":"","timestamp":"2018-05-15T06:51:33.930Z"}
		// )


		// above this line

		// @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;1E3CAE45-F5D8-4378-AA627DF2C6089897","Slug":"NRK Østafjells;020518-1850","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":1,"Creator":"LINUXENPS","MediaTime":0,"ModBy":"N12914","ModTime":"20180502T144559Z","MOSAbstracts":"_00:00:03:00 | @M=Auto Openend | 201 loop | 1: | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations":0,"MOSObjSlugs":"201 loop 1:  2:","MOSSlugs":"NRK ØSTAFJELLS;ddmm15-1845-3","MOSTimes":"20180502T131049Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"<BAK KLARHD<00:01>>","TextTime":0,"SystemApprovedBy":"N12914","mosartType":"BREAK","ReadTime":0,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"mosID":"chyron.techycami02.ndte.nrk.mos","abstract":"_00:00:03:00 | @M=Auto Openend | 201 loop | 1: | 2: | 3: | 4: | 00:00:00:00","objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","_t":"http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"},"objMetadataPath":{}},"itemChannel":"CG2","itemSlug":"NRK ØSTAFJELLS;ddmm15-1845-3","mosObj":{"objID":"NYHETER\\00010001?version=1","objSlug":"201 loop 1:  2:","mosItemEditorProgID":"Chymox.AssetBrowser.1","objDur":0,"objTB":0,"objPaths":{"objProxyPath":{"techDescription":"JPEG Thumbnail","_t":"http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010001_v1_big.jpg"},"objMetadataPath":{}},"mosExternalMetadata":{"mosSchema":"http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID":3}}],"level":"debug","message":"mosRoFullStory","timestamp":"2018-05-09T10:26:42.951Z"			}
		// )
		// @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
		// 	{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9141DBA1-93DD-4B19-BEBB32E0D6222E1B","Slug":"ÅPNING;vignett","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Actual":4,"Approved":1,"Creator":"LINUXENPS","ElapsedTime":3,"MediaTime":0,"ModBy":"N12914","ModTime":"20180502T144559Z","MOSAbstracts":"M: NRK Østafjells(20-04-16 09:07)\nTIDSMARKØR IKKE RØR","MOSItemDurations":"","MOSItemEdDurations":"","MOSObjSlugs":"M: NRK Østafjells\nStory status","MOSSlugs":"VIGNETT;vignett-5\nVIGNETT;vignett-3","MOSTimes":"20180502T165008720Z","Owner":"LINUXENPS","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"<LYS Q1>","StoryProducer":"DKTE","TextTime":0,"SystemApprovedBy":"N12914","Kilde":"TV","mosartType":"FULL","mosartVariant":"VIGNETT2018","ReadTime":0,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body":[{"Type":"storyItem","Content":{"itemID":9,"objID":"N11580_1461136025","mosID":"METADATA.NRK.MOS","mosAbstract":"M: NRK Østafjells (20-04-16 09:07)","objSlug":"M: NRK Østafjells","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"type":"video","changedBy":"N11580","changetime":"2016-04-20T09:07:05 +02:00","mdSource":"ncs","title":"NRK Østafjells","description":{},"hbbtv":{"link":""},"rights":{"notes":"","owner":"NRK","_t":"Green"}}}},"itemSlug":"VIGNETT;vignett-5"}},{"Type":"storyItem","Content":{"mosID":"mosart.morten.mos","abstract":"TIDSMARKØR IKKE RØR","objID":"STORYSTATUS","objSlug":"Story status","itemID":10,"itemSlug":"VIGNETT;vignett-3"}}],"level":"debug","message":"mosRoFullStory","timestamp":"2018-05-09T10:26:43.127Z"}
		// )
		// @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;6364CE48-9B6A-4D36-B7F8352E6E11EDB7","Slug": "HEAD;head-hundepose-020518","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 5,"Estimated": 10,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163055Z","MOSAbstracts": "head-hundepose-020518-te NYHETER 00:00:11:19 \n_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Vil ikkje ha poser til hundebæsj | 2:Østafjells | 3: | 4: | 00:00:07:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": "11,76\n0","MOSItemEdDurations": "","MOSObjSlugs": "head-hundepose-020518-te\n52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells\nStory status","MOSSlugs": "HEAD;head-Bæsjepose-4\n52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells\nSAK VESTFOLD;head-3","MOSTimes": "20180502T165013906Z","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "Miljøpartiet vil droppe posen til hundebæsjen - slik vil dei spare miljøet.","StoryProducer": "DKTE","TextTime": 5,"SystemApprovedBy": "N12914","Kilde": "TV","mosartType": "STK","mosartVariant": "HEAD","OpprLand": "Norge","ReadTime": 5,"Rettigheter": "Grønt","Team": "(Kun for STK:) Foto: / Redigering:","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"itemSlug": "HEAD;head-Bæsjepose-4","objID": "\\\\NDTE\\Omn\\C\\S\\25\\07","mosID": "OMNIBUS.NDTE.MOS","abstract": "head-hundepose-020518-te NYHETER 00:00:11:19","objDur": 588,"objTB": 50,"objSlug": "head-hundepose-020518-te","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": {},"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058473_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells","mosObj": {"objID": "NYHETER\\00058473?version=1","objSlug": "52 headline 1:Vil ikkje ha poser til hundebæsj  2:Østafjells","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058473_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 2}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 3,"itemSlug": "SAK VESTFOLD;head-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:43.331Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;4CBE86C0-9A69-4EF4-81F8E8CD275092E8","Slug": "HEAD;head-mesterskap-020518-te","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 7,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T144554Z","MOSAbstracts": "head-mesterskap-020518-te NYHETER 00:00:12:13 \n_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Fylkesmeisterskap i Vestfold | 2:Østafjells | 3: | 4: | 00:00:07:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": "12,52\n0","MOSItemEdDurations": "","MOSObjSlugs": "head-mesterskap-020518-te\n52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells\nStory status","MOSSlugs": "FYLKESMESTERSKAP;head-mesterskap-020518-te-4\n52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells\nSAK VESTFOLD;head-3","MOSTimes": "20180502T165021004Z","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "Lærlingar konkurrerte i barne- og ungdomsarbeiderfaget. Arrangementet skal skape blest rundt yrket.","StoryProducer": "DKTE","TextTime": 7,"SystemApprovedBy": "N12914","Kilde": "TV","mosartType": "STK","mosartVariant": "HEAD","OpprLand": "Norge","ReadTime": 7,"Rettigheter": "Grønt","Team": "(Kun for STK:) Foto: / Redigering:","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"itemSlug": "FYLKESMESTERSKAP;head-mesterskap-020518-te-4","objID": "\\\\NDTE\\Omn\\C\\S\\24\\61","mosID": "OMNIBUS.NDTE.MOS","abstract": "head-mesterskap-020518-te NYHETER 00:00:12:13","objDur": 626,"objTB": 50,"objSlug": "head-mesterskap-020518-te","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"itemID": 5,"itemSlug": "52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells","itemChannel": "CG1","mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:00:00 | @M=Auto Openend | 52 headline | 1:Fylkesmeisterskap i Vestfold | 2:Østafjells | 3: | 4: | 00:00:07:00","mosObj": {"objID": "NYHETER\\00058435?version=1","objSlug": "52 headline 1:Fylkesmeisterskap i Vestfold  2:Østafjells","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058435_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 3,"itemSlug": "SAK VESTFOLD;head-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:43.540Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;8B0D9EE2-EF9A-472F-80C6DD2CCDCFC2E6","Slug": "ÅPNING;velkommen","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 5,"Estimated": 0,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T154626Z","MOSAbstracts": "_00:00:00:00 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": 0,"MOSItemEdDurations": "","MOSObjSlugs": "50 logo 1:  2:\nStory status","MOSSlugs": "50 logo 1:  2:\nVelkommen;velkommen-4","MOSTimes": "20180502T131049Z\n20180502T165026622Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "<BAK FADE<00:01:12>>","TextTime": 0,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": "ÅPNING3","ReadTime": 0,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:00:00 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/16000/Objects_NYHETER_00016967_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "50 logo 1:  2:","mosObj": {"objID": "NYHETER\\00016967?version=1","objSlug": "50 logo 1:  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/16000/Objects_NYHETER_00016967_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 3}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 5,"itemSlug": "Velkommen;velkommen-4"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:43.739Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;BD68FC84-9654-4E3E-B799104C28B28CAB","Slug": "DROPP BÆSJEPOSE;inn","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 8,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163051Z","MOSAbstracts": "_00:00:00:00 | @M=Auto Storyend | 202 bilde | 1:0205-hundebæsj | 2: | 3: | 4: | 00:00:00:00\n_00:00:02:00 | @M=Auto Timed | 01 ett navn | 1:Martin Torstveit | 2:2.mai 2018 | 3: | 4: | 00:00:05:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": "0\n0","MOSItemEdDurations": "","MOSObjSlugs": "202 bilde 1:0205-hundebæsj  2:\n01 ett navn 1:Martin Torstveit  2:2.mai 2018\nStory status","MOSSlugs": "202 bilde 1:0205-hundebæsj  2:\n01 ett navn 1:Martin Torstveit  2:2.mai 2018\nSAK 1;intro-3","MOSTimes": "20180502T165034836Z","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "(K3) God kveld og velkommen. Folk bør la hundebæsjen bli liggande når dei er ute og lufter bikkja. Det meiner Miljøpartiet De Grønne. Partiet meiner det kan redusere mengden poser me kaster i søpla.","TextTime": 13,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": 3,"ReadTime": 13,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"itemSlug": "202 bilde 1:0205-hundebæsj  2:","itemChannel": "CG2","mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:00:00 | @M=Auto Storyend | 202 bilde | 1:0205-hundebæsj | 2: | 3: | 4: | 00:00:00:00","mosObj": {"objID": "NYHETER\\00058461?version=1","objSlug": "202 bilde 1:0205-hundebæsj  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058461_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:02:00 | @M=Auto Timed | 01 ett navn | 1:Martin Torstveit | 2:2.mai 2018 | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058439_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Martin Torstveit  2:2.mai 2018","mosObj": {"objID": "NYHETER\\00058439?version=1","objSlug": "01 ett navn 1:Martin Torstveit  2:2.mai 2018","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058439_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 3}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:43.942Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;FBB8E962-3DB5-4C92-AD7CA00B33710D1C","Slug": "DROPP BÆSJEPOSE;HUNDEPOSE-020518-te","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 114,"Estimated": 114,"MediaTime": 114.52,"ModBy": "N12914","ModTime": "20180502T163049Z","MOSAbstracts": "METADATA\n HUNDEPOSE-020518-TE NYHETER 00:01:54:13 \n_00:00:02:00 | @M=Manual Timed | 01 ett navn | 1:Maria Kommandantvold | 2:reporter | 3: | 4: | 00:00:05:00\n_00:00:24:11 | @M=Auto Timed | 01 ett navn | 1:Christina Albrecht Olsen | 2:Sankt Hansberget barnehage | 3: | 4: | 00:00:04:00\n_00:00:45:00 | @M=Auto Timed | 01 ett navn | 1:Hanne Lisa Matt | 2:Miljøpartiet De Grønne | 3: | 4: | 00:00:05:00\n_00:01:06:00 | @M=Auto Timed | 01 ett navn | 1:Louise Abel Morberg | 2:hundeeier | 3: | 4: | 00:00:05:00\n_00:01:47:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Tordis Gauteplass | 3: | 4: | 00:00:04:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": "114,52\n0\n0\n0\n0\n0","MOSItemEdDurations": "","MOSObjSlugs": "M: \nHUNDEPOSE-020518-TE\n01 ett navn 1:Maria Kommandantvold  2:reporter\n01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage\n01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne\n01 ett navn 1:Louise Abel Morberg  2:hundeeier\n24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass\nStory status","MOSSlugs": "SAK BUSKERUD;SAK-14\nDROPP BÆSJEPOSE;HUNDEPOSE-020518-te-12\n01 ett navn 1:Maria Kommandantvold  2:reporter\n01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage\n01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne\n01 ett navn 1:Louise Abel Morberg  2:hundeeier\n24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass\nSAK BUSKERUD;SAK-20","MOSTimes": "20180502T165229810Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Kilde": "TV","mosartTransition": "","mosartType": "FULL","ReadTime": 114.52,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 2,"objID": "N11580_1412594672","mosID": "METADATA.NRK.MOS","mosAbstract": "METADATA","objSlug": "M:","mosExternalMetadata": {"mosScope": "PLAYLIST","mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload": {"nrk": {"type": "video","changedBy": "N11580","changetime": "2014-10-06T13:24:32 +02:00","title": {},"description": {},"hbbtv": {"link": ""},"rights": {"notes": "","owner": "NRK","_t": "Green"}}}},"itemSlug": "SAK BUSKERUD;SAK-14"}},{"Type": "storyItem","Content": {"itemID": 12,"itemSlug": "DROPP BÆSJEPOSE;HUNDEPOSE-020518-te-12","objID": "\\\\NDTE\\Omn\\C\\S\\24\\70","mosID": "OMNIBUS.NDTE.MOS","abstract": "HUNDEPOSE-020518-TE NYHETER 00:01:54:13","objDur": 5726,"objTB": 50,"objSlug": "HUNDEPOSE-020518-TE","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:02:00 | @M=Manual Timed | 01 ett navn | 1:Maria Kommandantvold | 2:reporter | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058457_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Maria Kommandantvold  2:reporter","mosObj": {"objID": "NYHETER\\00058457?version=1","objSlug": "01 ett navn 1:Maria Kommandantvold  2:reporter","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058457_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 9}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:24:11 | @M=Auto Timed | 01 ett navn | 1:Christina Albrecht Olsen | 2:Sankt Hansberget barnehage | 3: | 4: | 00:00:04:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058464_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage","mosObj": {"objID": "NYHETER\\00058464?version=1","objSlug": "01 ett navn 1:Christina Albrecht Olsen  2:Sankt Hansberget barnehage","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058464_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 11}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:45:00 | @M=Auto Timed | 01 ett navn | 1:Hanne Lisa Matt | 2:Miljøpartiet De Grønne | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058458_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne","mosObj": {"objID": "NYHETER\\00058458?version=1","objSlug": "01 ett navn 1:Hanne Lisa Matt  2:Miljøpartiet De Grønne","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058458_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 4}},{"Type": "storyItem","Content": {"itemID": 14,"itemSlug": "01 ett navn 1:Louise Abel Morberg  2:hundeeier","itemChannel": "CG1","mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:01:06:00 | @M=Auto Timed | 01 ett navn | 1:Louise Abel Morberg | 2:hundeeier | 3: | 4: | 00:00:05:00","mosObj": {"objID": "NYHETER\\00058478?version=1","objSlug": "01 ett navn 1:Louise Abel Morberg  2:hundeeier","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058478_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:01:47:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Tordis Gauteplass | 3: | 4: | 00:00:04:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058463_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass","mosObj": {"objID": "NYHETER\\00058463?version=1","objSlug": "24 foto/red 1:Foto og redigering:  2:Tordis Gauteplass","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058463_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 7}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 8,"itemSlug": "SAK BUSKERUD;SAK-20"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:44.155Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;637F3BE2-8154-4E00-ABEBE2C0AED642E8","Slug": "INNSAMLING;tekst","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 17,"Estimated": 20,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T164244Z","MOSAbstracts": "TIDSMARKØR IKKE RØR","MOSObjSlugs": "Story status","MOSSlugs": "SAK 1;intro-3","MOSTimes": "20180502T165235816Z","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "(K2) Larvik håndballklubb har fått inn omkring 2,5 millioner kroner i gåvepengar, (***) som skal redde klubben frå konkurs.\nKlubben manglar likevel omlag 500.000 kroner for å nå målet på tre millionar kroner.","TextTime": 18,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": 2,"ReadTime": 18,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:44.338Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;79588F90-8422-4FB7-8EC199E3CB93BEA4","Slug": "INNSAMLING;LARVIK-KONKURS","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T150756Z","MOSAbstracts": "METADATA\n LARVIK-KONKURS-020518S-TE NYHETER 00:00:30:01 \n_00:00:00:00 | @M=Auto Timed | 10 info | 1:Larvik treng pengar | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations": "30,04\n0","MOSItemEdDurations": "","MOSObjSlugs": "M: \nLARVIK-KONKURS-020518S-TE\n10 info 1:Larvik treng pengar  2:","MOSSlugs": "STK 1;STK-5\nINNSAMLING;STK-2\n10 info 1:Larvik treng pengar  2:","MOSTimes": "","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Kilde": "TV","mosartType": "STK","OpprLand": "Norge","ReadTime": 0,"Rettigheter": "Grønt","Team": "(Kun for STK:) Foto: / Redigering:","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"objID": "N11580_1412594672","mosID": "METADATA.NRK.MOS","mosAbstract": "METADATA","objSlug": "M:","mosExternalMetadata": {"mosScope": "PLAYLIST","mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload": {"nrk": {"type": "video","changedBy": "N11580","changetime": "2014-10-06T13:24:32 +02:00","title": {},"description": {},"hbbtv": {"link": ""},"rights": {"notes": "","owner": "NRK","_t": "Green"}}}},"itemSlug": "STK 1;STK-5"}},{"Type": "storyItem","Content": {"itemID": 2,"itemSlug": "INNSAMLING;STK-2","objID": "\\\\NDTE\\Omn\\C\\S\\24\\64","mosID": "OMNIBUS.NDTE.MOS","abstract": "LARVIK-KONKURS-020518S-TE NYHETER 00:00:30:01","objDur": 1502,"objTB": 50,"objSlug": "LARVIK-KONKURS-020518S-TE","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:00:00 | @M=Auto Timed | 10 info | 1:Larvik treng pengar | 2: | 3: | 4: | 00:00:00:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058452_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "10 info 1:Larvik treng pengar  2:","mosObj": {"objID": "NYHETER\\00058452?version=1","objSlug": "10 info 1:Larvik treng pengar  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058452_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 5}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:44.577Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;E60ED2B4-1BC1-4327-98E4DC0070B42795","Slug": "INNSAMLING;gjest","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Actual": 120,"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 109,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T143332Z","MOSAbstracts": "_00:02:00:00 | @M=Manual Timed | 01 ett navn | 1:Cathrine Svendsen | 2:styreleder, LHK | 3: | 4: | 00:00:00:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": 0,"MOSItemEdDurations": "","MOSObjSlugs": "01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK\nStory status","MOSSlugs": "01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK\nSAK 1;intro-3","MOSTimes": "20180502T165437473Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"TextTime": 0,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": 3,"ReadTime": 0,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": {},"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058436_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK","mosObj": {"objID": "NYHETER\\00058436?version=1","objSlug": "01 ett navn 1:Cathrine Svendsen  2:styreleder, LHK","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058436_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 3}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:44.755Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;52915640-EDC4-4CF3-92D0F9D41FC26A6E","Slug": "FYLKESMESTERSKAP;inn","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 15,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163813Z","MOSAbstracts": "TIDSMARKØR IKKE RØR","MOSObjSlugs": "Story status","MOSSlugs": "SAK 1;intro-3","MOSTimes": "20180502T165453205Z","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "(K2) I dag blei det arrangert fylkesmesterskap i barne- og ungdomsarbeiderfaget i Re kommune i Vestfold. \nGjennom forskjellige konkurransar fekk lærlingar vist fram sine ferdigheter.","TextTime": 18,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": 2,"ReadTime": 18,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:44.948Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;E13788E2-5F04-4014-A6F8001F35CFFBB4","Slug": "FYLKESMESTERSKAP;MESTERSKAP-020518-TE","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 96,"Estimated": 110,"MediaTime": 96.24,"ModBy": "N12914","ModTime": "20180502T144537Z","MOSAbstracts": "M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget (02-05-18 15:10)\n MESTERSKAP-020518-TE NYHETER 00:01:36:06 \n_00:00:07:00 | @M=Auto Timed | 01 ett navn | 1:Anne Melsom Bjerke | 2:reporter | 3: | 4: | 00:00:05:00\n_00:00:19:00 | @M=Auto Timed | 01 ett navn | 1:Marius | 2: | 3: | 4: | 00:00:05:00\n_00:00:46:00 | @M=Auto Timed | 01 ett navn | 1:Hilde Abrahamsen | 2:Fagforbundet i Vestfold  | 3: | 4: | 00:00:05:00\n_00:01:11:00 | @M=Auto Timed | 01 ett navn | 1:Sandra Blegeberg Sørsdahl | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00\n_00:01:21:00 | @M=Auto Timed | 01 ett navn | 1:Juliane Svalestad | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00\n_00:01:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Henrik Bøe | 3: | 4: | 00:00:05:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": "96,24\n0\n0\n0\n0\n0\n0","MOSItemEdDurations": "","MOSObjSlugs": "M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget\nMESTERSKAP-020518-TE\n01 ett navn 1:Anne Melsom Bjerke  2:reporter\n01 ett navn 1:Marius  2:\n01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold \n01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider\n01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider\n24 foto/red 1:Foto og redigering:  2:Henrik Bøe\nStory status","MOSSlugs": "SAK BUSKERUD;SAK-14\nFYLKESMESTERSKAP;MESTERSKAP-020518-TE-13\n01 ett navn 1:Anne Melsom Bjerke  2:reporter\n01 ett navn 1:Marius  2:\n01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold \n01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider\n01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider\n24 foto/red 1:Foto og redigering:  2:Henrik Bøe\nSAK BUSKERUD;SAK-20","MOSTimes": "20180502T131049Z\n20180502T131049Z\n\n20180502T131049Z\n20180502T131049Z\n20180502T131049Z\n20180502T165629890Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 51,"StoryLogPreview": "<LYS Q1>","StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Bildebeskrivelse": "Bilder fra tre lag som deltar i fylkesmesterskap ( Vestfold) i barne- og ungdomsarbeiderfaget. lærlinger har ulike konkurranser med barna. dommere evaluerer","Fylke": "Vestfold","Innslagstittel": "Fylkesmesterskap i barne- og ungdomsarbeiderfaget","Kilde": "TV","Kommune": "Re","mosartTransition": "","mosartType": "FULL","OpprLand": "Norge","ReadTime": 96.24,"Rettigheter": "Grønt","Rettighetseier": "NRK","Sted": "Re","Tags": "barne- og ungdomsarbeider; studier; yrkesfag; fylkesmesterskap","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 2,"objID": "N23194_1525266622","mosID": "METADATA.NRK.MOS","mosAbstract": "M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget (02-05-18 15:10)","objSlug": "M: Fylkesmesterskap i barne- og ungdomsarbeiderfaget","mosExternalMetadata": {"mosScope": "PLAYLIST","mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload": {"nrk": {"changetime": "2018-05-02T15:10:21 +02:00","changedBy": "N23194","type": "video","mdSource": "omnibus","title": "Fylkesmesterskap i barne- og ungdomsarbeiderfaget","description": "Bilder fra tre lag som deltar i fylkesmesterskap ( Vestfold) i barne- og ungdomsarbeiderfaget. lærlinger har ulike konkurranser med barna. dommere evaluerer","hbbtv": {"link": ""},"location": {"id": "1-46146","region": "Vestfold","lat": 59.33946,"lon": 10.23902,"_t": "Re"},"tag": [{"id": 96183,"_t": "barne- og ungdomsarbeider"},{"id": 5371,"_t": "studier"},{"id": 6277,"_t": "yrkesfag"},{"id": 95503,"_t": "fylkesmesterskap"}],"rights": {"notes": "","owner": "NRK","_t": "Green"}}}},"itemSlug": "SAK BUSKERUD;SAK-14"}},{"Type": "storyItem","Content": {"itemID": 13,"itemSlug": "FYLKESMESTERSKAP;MESTERSKAP-020518-TE-13","objID": "\\\\NDTE\\Omn\\C\\S\\24\\60","mosID": "OMNIBUS.NDTE.MOS","abstract": "MESTERSKAP-020518-TE NYHETER 00:01:36:06","objDur": 4812,"objTB": 50,"objSlug": "MESTERSKAP-020518-TE","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:07:00 | @M=Auto Timed | 01 ett navn | 1:Anne Melsom Bjerke | 2:reporter | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058417_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Anne Melsom Bjerke  2:reporter","mosObj": {"objID": "NYHETER\\00058417?version=1","objSlug": "01 ett navn 1:Anne Melsom Bjerke  2:reporter","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058417_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 3}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:19:00 | @M=Auto Timed | 01 ett navn | 1:Marius | 2: | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058418_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Marius  2:","mosObj": {"objID": "NYHETER\\00058418?version=1","objSlug": "01 ett navn 1:Marius  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058418_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 4}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:46:00 | @M=Auto Timed | 01 ett navn | 1:Hilde Abrahamsen | 2:Fagforbundet i Vestfold  | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058431_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold","mosObj": {"objID": "NYHETER\\00058431?version=1","objSlug": "01 ett navn 1:Hilde Abrahamsen  2:Fagforbundet i Vestfold","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058431_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 5}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:01:11:00 | @M=Auto Timed | 01 ett navn | 1:Sandra Blegeberg Sørsdahl | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058426_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider","mosObj": {"objID": "NYHETER\\00058426?version=1","objSlug": "01 ett navn 1:Sandra Blegeberg Sørsdahl  2:lærling, barne- og ungdomsarbeider","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058426_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 6}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:01:21:00 | @M=Auto Timed | 01 ett navn | 1:Juliane Svalestad | 2:lærling, barne- og ungdomsarbeider | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058427_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider","mosObj": {"objID": "NYHETER\\00058427?version=1","objSlug": "01 ett navn 1:Juliane Svalestad  2:lærling, barne- og ungdomsarbeider","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058427_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 12}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:01:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto og redigering: | 2:Henrik Bøe | 3: | 4: | 00:00:05:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058428_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "24 foto/red 1:Foto og redigering:  2:Henrik Bøe","mosObj": {"objID": "NYHETER\\00058428?version=1","objSlug": "24 foto/red 1:Foto og redigering:  2:Henrik Bøe","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058428_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 7}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 8,"itemSlug": "SAK BUSKERUD;SAK-20"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:45.189Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;D215CE3F-0094-4D94-89F9B317ADB1387B","Slug": "Anmeldelse Hassel fengsel;tekst","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 33,"Estimated": 20,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163820Z","MOSAbstracts": "TIDSMARKØR IKKE RØR","MOSObjSlugs": "Story status","MOSSlugs": "SAK 1;intro-3","MOSTimes": "20180502T165636486Z","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "(K2)  Minst ein Tilsett ved Hassel fengsel i Øvre Eiker er anmeldt til politiet av fengsels-leiinga, etter at en kollega sist helg varsla om kritikkverdige forhold.(***)","TextTime": 34,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": 2,"ReadTime": 34,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:45.358Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;5BF7D6CA-2CF6-479B-B87B02595CAFE170","Slug": "Anmeldelse Hassel fengsel;HASSEL-020518S-TE","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163821Z","MOSAbstracts": "METADATA\n HASSEL-020518S-TE NYHETER 00:00:23:11 \n_00:00:00:00 | @M=Auto Timed | 10 info | 1:Tilsett meldt til politiet | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations": "23,44\n0","MOSItemEdDurations": "","MOSObjSlugs": "M: \nHASSEL-020518S-TE\n10 info 1:Tilsett meldt til politiet  2:","MOSSlugs": "STK 2;STK-5\nAnmeldelse Hassel fengsel;STK-2\n10 info 1:Tilsett meldt til politiet  2:","MOSTimes": "","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Kilde": "TV","mosartType": "STK","OpprLand": "Norge","ReadTime": 0,"Rettigheter": "Grønt","Team": "(Kun for STK:) Foto: / Redigering:","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"objID": "N11580_1412594672","mosID": "METADATA.NRK.MOS","mosAbstract": "METADATA","objSlug": "M:","mosExternalMetadata": {"mosScope": "PLAYLIST","mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload": {"nrk": {"type": "video","changedBy": "N11580","changetime": "2014-10-06T13:24:32 +02:00","title": {},"description": {},"hbbtv": {"link": ""},"rights": {"notes": "","owner": "NRK","_t": "Green"}}}},"itemSlug": "STK 2;STK-5"}},{"Type": "storyItem","Content": {"itemID": 2,"itemSlug": "Anmeldelse Hassel fengsel;STK-2","objID": "\\\\NDTE\\Omn\\C\\S\\25\\11","mosID": "OMNIBUS.NDTE.MOS","abstract": "HASSEL-020518S-TE NYHETER 00:00:23:11","objDur": 1172,"objTB": 50,"objSlug": "HASSEL-020518S-TE","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": {},"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058484_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "10 info 1:Tilsett meldt til politiet  2:","mosObj": {"objID": "NYHETER\\00058484?version=1","objSlug": "10 info 1:Tilsett meldt til politiet  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058484_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 5}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:45.567Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;9E41486F-9E9A-421E-9EE410EE88DEF972","Slug": "Anmeldelse Hassel fengsel;HASSEL-020518-TE","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 33,"Estimated": 25,"MediaTime": 32.76,"ModBy": "N12914","ModTime": "20180502T163120Z","MOSAbstracts": "M: Fengselansatt anmeldt til politiet (02-05-18 18:11)\nHASSEL-020518F-TE NYHETER 00:00:32:19\n_00:00:02:00 | @M=Auto Timed | 01 ett navn | 1:Rita Kilvær | 2:regiondirektør, Kriminalomsorgen, region sør | 3: | 4: | 00:00:05:00\n_00:00:15:00 | @M=Auto Timed | 01 ett navn | 1:Fabian Skalleberg Nilsen | 2:reporter | 3: | 4: | 00:00:05:00\n_00:00:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto/redigering: | 2:Harald Inderhaug | 3: | 4: | 00:00:04:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": "32,76\n0\n0\n0","MOSItemEdDurations": "","MOSObjSlugs": "M: Fengselansatt anmeldt til politiet\nHASSEL-020518F-TE\n01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør\n01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter\n24 foto/red 1:Foto/redigering:  2:Harald Inderhaug\nStory status","MOSSlugs": "STK 2;SYNK-5\nAnmeldelse Hassel fengsel;SYNK-2\n01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør\n01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter\n24 foto/red 1:Foto/redigering:  2:Harald Inderhaug\nREGISTERING stk - synk;SYNK-4","MOSTimes": "20180502T165736551Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Bildebeskrivelse": "skilt av fengselet, nærbilde av gårdsanlegg ved fengselet, låve, bil, totalutsnitt til slutt","Fylke": "Buskerud","Innslagstittel": "Fengselansatt anmeldt til politiet","Kilde": "TV","Kommune": "Øvre Eiker","mosartType": "FULL","OpprLand": "Norge","ReadTime": 32.76,"Rettigheter": "Grønt","Rettighetseier": "NRK","Sted": "Skotselv","Tags": "fengsel; varsel; personalsak","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"objID": "N22778_1525277484","mosID": "METADATA.NRK.MOS","mosAbstract": "M: Fengselansatt anmeldt til politiet (02-05-18 18:11)","objSlug": "M: Fengselansatt anmeldt til politiet","mosExternalMetadata": {"mosScope": "PLAYLIST","mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload": {"nrk": {"changetime": "2018-05-02T18:11:24 +02:00","changedBy": "N22778","type": "video","mdSource": "omnibus","title": "Fengselansatt anmeldt til politiet","description": "skilt av fengselet, nærbilde av gårdsanlegg ved fengselet, låve, bil, totalutsnitt til slutt","hbbtv": {"link": ""},"location": {"id": "1-71323","region": "Øvre Eiker, Buskerud","lat": 59.84503,"lon": 9.88406,"_t": "Skotselv"},"tag": [{"id": 1306,"_t": "fengsel"},{"id": 90383,"_t": "varsel"},{"id": 4068,"_t": "personalsak"}],"rights": {"notes": "","owner": "NRK","_t": "Green"}}}},"itemSlug": "STK 2;SYNK-5"}},{"Type": "storyItem","Content": {"itemID": 2,"itemSlug": "Anmeldelse Hassel fengsel;SYNK-2","objID": "\\\\NDTE\\Omn\\C\\S\\25\\16","mosID": "OMNIBUS.NDTE.MOS","abstract": "HASSEL-020518F-TE NYHETER 00:00:32:19","objDur": 1638,"objTB": 50,"objSlug": "HASSEL-020518F-TE","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": {},"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058472_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør","mosObj": {"objID": "NYHETER\\00058472?version=1","objSlug": "01 ett navn 1:Rita Kilvær  2:regiondirektør, Kriminalomsorgen, region sør","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058472_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 5}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": {},"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058474_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter","mosObj": {"objID": "NYHETER\\00058474?version=1","objSlug": "01 ett navn 1:Fabian Skalleberg Nilsen  2:reporter","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058474_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 7}},{"Type": "storyItem","Content": {"itemID": 8,"itemSlug": "24 foto/red 1:Foto/redigering:  2:Harald Inderhaug","itemChannel": "CG1","mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:27:00 | @M=Auto Timed | 24 foto/red | 1:Foto/redigering: | 2:Harald Inderhaug | 3: | 4: | 00:00:04:00","mosObj": {"objID": "NYHETER\\00058476?version=1","objSlug": "24 foto/red 1:Foto/redigering:  2:Harald Inderhaug","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058476_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 6,"itemSlug": "REGISTERING stk - synk;SYNK-4"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:45.778Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;A0A2BBD6-82EA-4418-A594524FE53C4E40","Slug": "VÆRET;tekst","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 45,"Estimated": 20,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163122Z","MOSAbstracts": "TIDSMARKØR IKKE RØR","MOSObjSlugs": "Story status","MOSSlugs": "SAK 1;intro-3","MOSTimes": "20180502T165740729Z","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "(K2) Så skal me ta ein kikk på været.(***) Det er venta Sørøstleg bris og periodar med liten kuling på kysten. Regn store delar av dagen, før det skal bli oppholdsvær på kvelden.(***) I fjellet er det også venta sørøsteleg bris, og stiv kuling utsatte stader. Regn og sludd store delar av dagen. Det er også venta snøbyger over 800 meter. Før det skal bli lettare vær på kvelden.","TextTime": 25,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": 2,"ReadTime": 25,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:45.975Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;DE1D32B4-8F10-4769-ACCC558EB9A44167","Slug": "VÆRET;VÆRPLAKAT-KYST","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T150734Z","MOSAbstracts": "M: Været (05-02-18 13:47)\n VARET-KYST-020518-TE NYHETER 00:00:28:07 \n_00:00:00:00 | @M=Auto Timed | 82 ticker meteorolog | 1: | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations": "28,28\n0","MOSItemEdDurations": "","MOSObjSlugs": "M: Været\nVARET-KYST-020518-TE\n82 ticker meteorolog 1:  2:","MOSSlugs": "STK 2;STK-5\nVÆRET;VÆRPLAKAT-KYST-2\n82 ticker meteorolog 1:  2:","MOSTimes": "20180502T131049Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Bildebeskrivelse": "","Innslagstittel": "Været","Kilde": "TV","mosartType": "STK","ReadTime": 0,"Rettigheter": "Grønt","Rettighetseier": "NRK","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"objID": "N20248_1517834844","mosID": "METADATA.NRK.MOS","mosAbstract": "M: Været (05-02-18 13:47)","objSlug": "M: Været","mosExternalMetadata": {"mosScope": "PLAYLIST","mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload": {"nrk": {"changetime": "2018-02-05T13:47:23 +01:00","changedBy": "N20248","type": "video","mdSource": "omnibus","title": "Været","description": {},"hbbtv": {"link": ""},"rights": {"notes": "","owner": "NRK","_t": "Green"}}}},"itemSlug": "STK 2;STK-5"}},{"Type": "storyItem","Content": {"itemID": 2,"itemSlug": "VÆRET;VÆRPLAKAT-KYST-2","objID": "\\\\NDTE\\Omn\\C\\S\\24\\65","mosID": "OMNIBUS.NDTE.MOS","abstract": "VARET-KYST-020518-TE NYHETER 00:00:28:07","objDur": 1414,"objTB": 50,"objSlug": "VARET-KYST-020518-TE","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"itemID": 5,"itemSlug": "82 ticker meteorolog 1:  2:","itemChannel": "CG1","mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:00:00 | @M=Auto Timed | 82 ticker meteorolog | 1: | 2: | 3: | 4: | 00:00:00:00","mosObj": {"objID": "NYHETER\\00053302?version=1","objSlug": "82 ticker meteorolog 1:  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/53000/Objects_NYHETER_00053302_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}}}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:46.177Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;1CFBCFBF-4713-461E-97AE2A3354FFBB2C","Slug": "VÆRET;VÆRPLAKAT-FJELLET","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T150733Z","MOSAbstracts": "VARET-FJELL-020518-TE NYHETER 00:00:26:22","MOSItemDurations": "26,88","MOSObjSlugs": "VARET-FJELL-020518-TE","MOSSlugs": "VÆRET;VÆRPLAKAT-FJELLET-2","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Kilde": "TV","mosartTransition": "mix 12","mosartType": "STK","OpprLand": "Norge","ReadTime": 0,"Rettigheter": "Grønt","Team": "(Kun for STK:) Foto: / Redigering:","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 2,"itemSlug": "VÆRET;VÆRPLAKAT-FJELLET-2","objID": "\\\\NDTE\\Omn\\C\\S\\24\\66","mosID": "OMNIBUS.NDTE.MOS","abstract": "VARET-FJELL-020518-TE NYHETER 00:00:26:22","objDur": 1344,"objTB": 50,"objSlug": "VARET-FJELL-020518-TE","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:46.375Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;A3D511ED-8C88-46AF-9CB9BA67630A5591","Slug": "KOMMER 2055;tekst","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","Estimated": 15,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163826Z","MOSAbstracts": "TIDSMARKØR IKKE RØR","MOSObjSlugs": "Story status","MOSSlugs": "SAK 1;intro-3","Owner": "LINUXENPS","Printed": "20180502T164204Z","SourceMediaTime": 0,"SourceTextTime": 0,"StoryLogPreview": "Om drøye fire månader åpner dobbelsporet, som skal gje 22 minutter kortere togtid mellom Larvik og Porsgrunn. Me har vore med på testuren. Meir om det i  kåns neste sending.(*) Det var alt me hadde i denne omgang. Me er tilbake klokka 20:55. Takk for nå.","TextTime": 17,"SystemApprovedBy": "N12914","mosartType": "","ReadTime": 17,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:46.579Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;5C9D3E10-35DC-4DC5-84A799BA882F7389","Slug": "KOMMER 2055;HEAD-TOG","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T163127Z","MOSAbstracts": "METADATA\n HEAD-TOG NYHETER 00:00:24:16 \n_00:00:00:00 | @M=Auto Storyend | 09 teaser | 1:Se sendingen kl. 20.55 | 2: | 3: | 4: | 00:00:00:00","MOSItemDurations": "24,64\n0","MOSItemEdDurations": "","MOSObjSlugs": "M: \nHEAD-TOG\n09 teaser 1:Se sendingen kl. 20.55  2:","MOSSlugs": "STK 2;STK-5\nKOMMER 2055;STK-2\n09 teaser 1:Se sendingen kl. 20.55  2:","MOSTimes": "","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"StoryProducer": "DKTE","TextTime": 0,"SystemApprovedBy": "N12914","Kilde": "TV","mosartTransition": "","mosartType": "STK","OpprLand": "Norge","ReadTime": 0,"Rettigheter": "Grønt","Team": "(Kun for STK:) Foto: / Redigering:","ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"itemID": 4,"objID": "N11580_1412594672","mosID": "METADATA.NRK.MOS","mosAbstract": "METADATA","objSlug": "M:","mosExternalMetadata": {"mosScope": "PLAYLIST","mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload": {"nrk": {"type": "video","changedBy": "N11580","changetime": "2014-10-06T13:24:32 +02:00","title": {},"description": {},"hbbtv": {"link": ""},"rights": {"notes": "","owner": "NRK","_t": "Green"}}}},"itemSlug": "STK 2;STK-5"}},{"Type": "storyItem","Content": {"itemID": 2,"itemSlug": "KOMMER 2055;STK-2","objID": "\\\\NDTE\\Omn\\C\\S\\25\\15","mosID": "OMNIBUS.NDTE.MOS","abstract": "HEAD-TOG NYHETER 00:00:24:16","objDur": 1232,"objTB": 50,"objSlug": "HEAD-TOG","mosExternalMetadata": {"mosSchema": "OMNIBUS"}}},{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": {},"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058479_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "09 teaser 1:Se sendingen kl. 20.55  2:","mosObj": {"objID": "NYHETER\\00058479?version=1","objSlug": "09 teaser 1:Se sendingen kl. 20.55  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058479_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 6}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:46.779Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;D7850305-1C4D-4D14-91FCE6327C3C0825","Slug": "TAKK FOR I KVELD;Takk for i kveld","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","ElapsedTime": 7,"MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T154537Z","MOSAbstracts": "_00:00:00:01 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": 0,"MOSItemEdDurations": "","MOSObjSlugs": "50 logo 1:  2:\nStory status","MOSSlugs": "TAKK FOR IKVELD + BILDEKOLLAGE;Takk for ikveld-20\nTAKK FOR IKVELD + BILDEKOLLAGE;seerbilder-18","MOSTimes": "20180502T131049Z\n20180502T165829637Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"TextTime": 0,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": "TAKK2","ReadTime": 0,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": "_00:00:00:01 | @M=Auto Openend | 50 logo | 1: | 2: | 3: | 4: | 00:00:00:00","objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010009_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "TAKK FOR IKVELD + BILDEKOLLAGE;Takk for ikveld-20","mosObj": {"objID": "NYHETER\\00010009?version=1","objSlug": "50 logo 1:  2:","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/10000/Objects_NYHETER_00010009_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 3}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 4,"itemSlug": "TAKK FOR IKVELD + BILDEKOLLAGE;seerbilder-18"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:46.985Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;0C1BCAED-D3C2-4671-B8E96F79860C6308","Slug": "TAKK FOR I KVELD;SLUTTPLAKAT start 18:58:50","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Actual": 10,"Approved": 1,"Creator": "LINUXENPS","MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T132212Z","MOSAbstracts": "_00:00:00:00 | @M=Auto Openend | 67 sluttkredit kort | 1:Redaktør | 2:Stig Bolme | 3:Produsent | 4:Berit Heggholmen | 00:00:00:00\nTIDSMARKØR IKKE RØR","MOSItemDurations": 0,"MOSItemEdDurations": "","MOSObjSlugs": "67 sluttkredit kort 1:Redaktør  2:Stig Bolme\nStory status","MOSSlugs": "67 sluttkredit kort 1:Redaktør  2:Stig Bolme\nTAKK FOR I KVELD;KAM-3","MOSTimes": "20180502T165829644Z","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"TextTime": 0,"SystemApprovedBy": "N12914","mosartType": "KAM","mosartVariant": "SLUTTR3","ReadTime": 0,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "chyron.techycami02.ndte.nrk.mos","abstract": {},"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058432_v1_big.jpg"},"objMetadataPath": {}},"itemChannel": "CG1","itemSlug": "67 sluttkredit kort 1:Redaktør  2:Stig Bolme","mosObj": {"objID": "NYHETER\\00058432?version=1","objSlug": "67 sluttkredit kort 1:Redaktør  2:Stig Bolme","mosItemEditorProgID": "Chymox.AssetBrowser.1","objDur": 0,"objTB": 0,"objPaths": {"objProxyPath": {"techDescription": "JPEG Thumbnail","_t": "http://160.68.33.159/thumbs/NYHETER/58000/Objects_NYHETER_00058432_v1_big.jpg"},"objMetadataPath": {}},"mosExternalMetadata": {"mosSchema": "http://ncsA4.com/mos/supported_schemas/NCSAXML2.08"}},"itemID": 5}},{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 4,"itemSlug": "TAKK FOR I KVELD;KAM-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:47.190Z"})
		// // @ts-ignore
		// Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {"ID": "MAENPSTEST14;P_SERVER14\\W\\R_07C8C71B-1835-493D-94E1678FD1425B71;EF1A29D9-EF4C-4965-893A4910B2212E66","Slug": "AVSLUTT;Slutt 18.59.00","MosExternalMetaData": [{"MosScope": "PLAYLIST","MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload": {"Approved": 1,"Creator": "LINUXENPS","MediaTime": 0,"ModBy": "N12914","ModTime": "20180502T132213Z","MOSAbstracts": "TIDSMARKØR IKKE RØR","MOSObjSlugs": "Story status","MOSSlugs": "SAK 1;intro-3","Owner": "LINUXENPS","SourceMediaTime": 0,"SourceTextTime": 0,"TextTime": 0,"SystemApprovedBy": "N12914","mosartType": "BREAK","ReadTime": 0,"ENPSItemType": 3}}],"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;07C8C71B-1835-493D-94E1678FD1425B71","Body": [{"Type": "storyItem","Content": {"mosID": "mosart.morten.mos","abstract": "TIDSMARKØR IKKE RØR","objID": "STORYSTATUS","objSlug": "Story status","itemID": 2,"itemSlug": "SAK 1;intro-3"}}],"level": "debug","message": "mosRoFullStory","timestamp": "2018-05-09T10:26:47.387Z"})
	},
	'debug_roMock1_remove' () {
		let pd = getPD()
		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, pd._id, pd.token,
			new MosString128('MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5'))
	},
	'debug_roMock1' () {
		let pd = getPD()
		if (!pd) {
			throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
		}
		let id = pd._id
		let token = pd.token
		logger.info('debug_roMock1')

		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, id, token,
			new MosString128('MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5'))

		// @ts-ignore
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token,
			{
				"ID": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
				"Slug": "TEST Sofie 2018",
				"EditorialStart": "2018-06-30T11:00:00,000",
				"EditorialDuration": "1800",
				"MosExternalMetaData": [{
					"MosSchema": "http://MAENPSTEST14:10505/schema/enpsro.dtd",
					"MosPayload": {
						"EndTime": "2018-06-30T13:30:00",
						"MOSROStatusTime": "1800-01-01T00:00:00",
						"MOSroStorySend": "CASPAR1.XPRO.MOS;SOFIE1.XPRO.MOS;SOFIE2.XPRO.MOS;SOFIE3.XPRO.MOS",
						"RundownDuration": "30:00",
						"StartTime": "2018-06-30T13:00:00",
						"LocalStartTime": "2018-06-30T13:00:00",
						"ENPSItemType": 2,
						"roLayout": "RowStatus|Slug|SegStatus|Segment|Presenter|Approved|Estimated|Actual|FrontTime|BackTime|CumeTime|Inset|ModBy|Camera"
					},
					"MosScope": "PLAYLIST"
				}],
				"Stories": [{
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;D07C8E87-48ED-4F64-A609665CB8B470F4",
					"Slug": "ÅPNING;VIGNETT",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;67B7A892-D4AD-4796-9473BE948E9DCCF5",
					"Slug": "ÅPNING;Head1",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;70C18F6A-7713-4884-B4DBBD089254A693",
					"Slug": "ÅPNING;Head2",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;F1641349-F6EA-4007-BD956A639BD8C85B",
					"Slug": "ÅPNING;Velkommen",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;21D83E74-236C-482C-B1563BF10BF4A2BA",
					"Slug": "SAK 1;Intro",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;A253988F-FEF4-4D64-ACC2CCFE78EA7C8C",
					"Slug": "SAK 1;SAK 1",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;25B5E1DD-082A-4939-B2CC7AD5DA511FC3",
					"Slug": "SAK 2;Intro",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;619A8B1E-5F39-42B8-9D5C318A48342392",
					"Slug": "SAK 2;SAK 2",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;B539EBBC-5877-4301-8FFFC0371031A29A",
					"Slug": "DIR;Intro",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;12ABC87D-6709-447A-B2D9AAE0C4A7E360",
					"Slug": "DIR;Split",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;9AAC721E-A8C6-4CAA-9DDD6E5835B55582",
					"Slug": "DIR;Direkte",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;D5CDDB91-2823-48D5-A50829B0907B8D79",
					"Slug": "STK Synk;Tekst",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;F485B9D0-0D2B-4548-A353E771A7F0F4B6",
					"Slug": "STK Synk;STK",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;C997A8EF-C221-4678-B31EB0419009628E",
					"Slug": "STK Synk;Synk",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;AC6784C9-5722-4286-A763BB64775CCB84",
					"Slug": "Nettpromo;Tekst",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;F39A88CF-9EFE-4881-8E04526996A5E526",
					"Slug": "Nettpromo;Grafikk",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;95EBAE5C-A888-478E-87234C566DCA3D55",
					"Slug": "Vær;Intro",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;2E21CEBA-BE5E-483C-9A26F64B5AB51643",
					"Slug": "Vær;Vær",
					"Items": []
				}, {
					"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;CA207AAF-9B8C-409B-854DE3CFC2AB8DCF",
					"Slug": "Sluttvignett;Credits",
					"Items": []
				}],
				"level": "debug",
				"message": "",
				"timestamp": "2018-05-31T08:19:38.054Z"
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;D07C8E87-48ED-4F64-A609665CB8B470F4",
				"Slug":"ÅPNING;VIGNETT",
				"MosExternalMetaData":[
					{
						"MosScope":"PLAYLIST",
						"MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload":{
							"Approved":0,
							"Creator":"N12050",
							"MediaTime":0,
							"ModBy":"N12050",
							"ModTime":"20180323T074704Z",
							"MOSAbstracts":"M: Testsending (23-03-18 08:47)",
							"MOSObjSlugs":"M: Testsending",
							"MOSSlugs":"Uten tittel",
							"Owner":"N12050",
							"SourceMediaTime":0,
							"SourceTextTime":0,
							"TextTime":0,
							"Bildebeskrivelse":"",
							"Innslagstittel":"Testsending",
							"mosartType":"FULL",
							"mosartVariant":"VIGNETT",
							"ReadTime":0,
							"Rettigheter":"Gult",
							"ENPSItemType":3
						}
					}
				],
				"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
				"Body":[
					{
						"Type":"storyItem",
						"Content":{
							"itemID":2,
							"objID":"N12050_1521791220",
							"mosID":"METADATA.NRK.MOS",
							"mosAbstract":"M: Testsending (23-03-18 08:47)",
							"objSlug":"M: Testsending",
							"mosExternalMetadata":{
								"mosScope":"PLAYLIST",
								"mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
								"mosPayload":{
									"nrk":{
										"changetime":"2018-03-23T08:47:00 +01:00",
										"changedBy":"N12050",
										"type":"video",
										"mdSource":"ncs",
										"title":"Testsending",
										"description":{
										},
										"hbbtv":{
											"link":""
										},
										"rights":{
											"notes":"",
											"owner":"",
											"@t":"Amber"
										}
									}
								}
							},
							"itemSlug":"Uten tittel"
						}
					}
				],
				"level":"debug",
				"message":"",
				"timestamp":"2018-05-31T08:19:38.191Z"
			}
		),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;67B7A892-D4AD-4796-9473BE948E9DCCF5",
				"Slug":"ÅPNING;Head1",
				"MosExternalMetaData":[
				   {
					  "MosScope":"PLAYLIST",
					  "MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd",
					  "MosPayload":{
						 "Approved":0,
						 "Creator":"N12050",
						 "MediaTime":58.16,
						 "ModBy":"N12050",
						 "ModTime":"20180522T092252Z",
						 "MOSAbstracts":"VÆRET-210518-DR21 NYHETER 00:00:58:04",
						 "MOSItemDurations":"58,16",
						 "MOSObjSlugs":"VÆRET-210518-DR21",
						 "MOSSlugs":"VIGNETT;Head1-2",
						 "Owner":"N12050",
						 "SourceMediaTime":0,
						 "SourceTextTime":0,
						 "TextTime":0,
						 "mosartType":"STK",
						 "mosartVariant":"HEAD",
						 "ReadTime":58.16,
						 "ENPSItemType":3
					  }
				   }
				],
				"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
				"Body":[
				   {
					  "Type":"storyItem",
					  "Content":{
						 "itemID":2,
						 "itemSlug":"VIGNETT;Head1-2",
						 "objID":"\\\\XPRO\\Omn\\A\\A\\41\\20",
						 "mosID":"OMNIBUS.XPRO.MOS",
						 "mosAbstract":"VÆRET-210518-DR21 NYHETER 00:00:58:04",
						 "objDur":2908,
						 "objTB":50,
						 "objSlug":"VARET-210518-DR21",
						 "mosExternalMetadata":{
							"mosScope":"PLAYLIST",
							"mosSchema":"OMNIBUS",
							"mosPayload":{
							   "title":"VARET-210518-DR21",
							   "objectType":"CLIP",
							   "clipType":"NYHETER",
							   "objDur":2908,
							   "objType":"VIDEO"
							}
						 }
					  }
				   },
				   {
					   "Type": "storyItem",
					   "Content":{
						   "itemID": 5,
						   "itemSlug":"ÅPNING;Head1-5",
						   "objID": "3ebcbed9-b60f-49bb-a23e-a223c02aff37",
						   "mosID": "GFX.NRK.MOS",
						   "mosAbstract": "headline: mnjk",
						   "abstract": "headline: mnjk",
						   "mosExternalMetadata":[{
							"mosScope":"PLAYLIST",
							"mosSchema": "schema.nrk.no/content",
							"mosPayload": {
								"uuid": "cb388abb-68b4-4183-882c-1b5261b07a05",
								metaData: {
									changedBy: "n23109",
									changed: "xxx",
									origin: "ENPS/CORE"
								},
								render:{
									channel: "gfx1",
									system: "",
									group: ""
								},
								template:{
									event: "",
									layer: "super",
									name: "52_headline"
								},
								content:{
									headline: "mnjk",
								}
							}
						   }, {
							"mosScope":"PLAYLIST",
							"mosSchema": "schema.nrk.no/timing",
							"mosPayload": {
								in: "auto",
								out: "onnext",
								timeIn: 400,
								duration: 6000
							}
						   }]
					   }
				   }
				],
				"level":"debug",
				"message":"",
				"timestamp":"2018-05-31T08:19:38.378Z"
			 }		),
			Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
				"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;70C18F6A-7713-4884-B4DBBD089254A693",
				"Slug": "ÅPNING;Head2",
				"MosExternalMetaData": [
					{
						"MosScope": "PLAYLIST",
						"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload": {
							"Approved": 0,
							"Creator": "N12050",
							"MediaTime": 42.36,
							"ModBy": "N12050",
							"ModTime": "20180522T092307Z",
							"MOSAbstracts": "nv-ungdom-israel-mgp-130518 PUBLISH_QUANTEL 00:00:42:09",
							"MOSItemDurations": "42,36",
							"MOSObjSlugs": "nv-ungdom-israel-mgp-130518",
							"MOSSlugs": "VIGNETT;Head2-2",
							"Owner": "N12050",
							"SourceMediaTime": 0,
							"SourceTextTime": 0,
							"TextTime": 0,
							"mosartType": "STK",
							"mosartVariant": "HEAD",
							"ReadTime": 42.36,
							"ENPSItemType": 3
						}
					}
				],
				"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
				"Body": [
					{
						"Type": "storyItem",
						"Content": {
							"itemID": 2,
							"itemSlug": "VIGNETT;Head2-2",
							"objID": "\\\\XPRO\\Omn\\A\\A\\41\\13",
							"mosID": "OMNIBUS.XPRO.MOS",
							"mosAbstract": "nv-ungdom-israel-mgp-130518 PUBLISH_QUANTEL 00:00:42:09",
							"objDur": 2118,
							"objTB": 50,
							"objSlug": "nv-ungdom-israel-mgp-130518",
							"mosExternalMetadata": {
								"mosScope": "PLAYLIST",
								"mosSchema": "OMNIBUS",
								"mosPayload": {
									"title": "nv-ungdom-israel-mgp-130518",
									"objectType": "CLIP",
									"clipType": "PUBLISH_QUANTEL",
									"objDur": 2118,
									"objType": "VIDEO"
								}
							}
						}
					},
					{
						"Type": "storyItem",
						"Content": {
							"itemID": 5,
							"itemSlug": "ÅPNING;Head1-5",
							"objID": "3ebcbed9-b60f-49bb-a23e-a223c02aff37",
							"mosID": "GFX.NRK.MOS",
							"mosAbstract": "headline: super2",
							"abstract": "headline: super2",
							"mosExternalMetadata": [{
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/content",
								"mosPayload": {
									"uuid": "cb388abb-68b4-4183-882c-1b5261b07a05",
									metaData: {
										changedBy: "n23109",
										changed: "xxx",
										origin: "ENPS/CORE"
									},
									render: {
										channel: "gfx1",
										system: "",
										group: ""
									},
									template: {
										event: "",
										layer: "super",
										name: "52_headline"
									},
									content: {
										headline: "super2",
									}
								}
							}, {
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/timing",
								"mosPayload": {
									in: "auto",
									out: "onnext",
									timeIn: 400,
									duration: 6000
								}
							}]
						}
					}
				],
				"level": "debug",
				"message": "",
				"timestamp": "2018-05-31T08:19:38.574Z"
			}),
			Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
				"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;F1641349-F6EA-4007-BD956A639BD8C85B",
				"Slug": "ÅPNING;Velkommen",
				"MosExternalMetaData": [{
					"MosScope": "PLAYLIST",
					"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
					"MosPayload": {
						"Approved": 0,
						"Creator": "N12050",
						"MediaTime": 0,
						"ModBy": "N12050",
						"ModTime": "20180522T092754Z",
						"MOSAbstracts": "Navnesuper: Ivar Johnsen, 22. mai 2018",
						"MOSObjSlugs": "Navnesuper: Ivar Johnsen, 22. mai 2018",
						"MOSSlugs": "VIGNETT;Velkommen-3",
						"MOSTimes": "20180531T081903Z",
						"Owner": "N12050",
						"SourceMediaTime": 0,
						"SourceTextTime": 0,
						"TextTime": 0,
						"mosartType": "KAM",
						"mosartVariant": "3ÅPNING",
						"ReadTime": 0,
						"ENPSItemType": 3
					}
				}],
				"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
				"Body": [
					{
						"Type": "storyItem",
						"Content": {
							"itemID": 3,
							"itemSlug": "VIGNETT;Velkommen-3",
							"objID": "a73f7bc7-258e-4bef-a364-84aab4ac02e2",
							"mosID": "GFX.NRK.MOS",
							"mosAbstract": "Navnesuper: Ivar Johnsen, 22. mai 2018",
							"mosExternalMetadata": [{
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/content",
								"mosPayload": {
									"uuid": "f6103c96-c981-4716-bdbc-b0b654de3041",
									"metaData": {
										"changedBy": "n23109",
										"changed": "xxx",
										"origin": "ENPS/CORE"
									},
									"render": {
										"channel": "gfx1",
										"system": {},
										"group": {}
									},
									"template": {
										"event": {},
										"layer": "super",
										"name": "navnesuper"
									},
									"content": {
										"navn": "Ivar Johnsen",
										"tittel": "22. mai 2018"
									}
								}
							}, {
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/timing",
								"mosPayload": {
									"in": "auto",
									"out": "manual",
									"timeIn": 5000,
									"duration": 0
								}
							}]
						}
					},
					{
						"Type": "storyItem",
						"Content": {
							"itemID": 9,
							"itemSlug": "ÅPNING;klokke",
							"objID": "3ebcbed9-b60f-49bb-a23e-a223c02aff37",
							"mosID": "GFX.NRK.MOS",
							"mosAbstract": "klokke",
							"abstract": "klokke",
							"mosExternalMetadata": [{
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/content",
								"mosPayload": {
									"uuid": "cb388abb-68b4-4183-882c-1b5261b07a06",
									metaData: {
										changedBy: "n23109",
										changed: "xxx",
										origin: "ENPS/CORE"
									},
									render: {
										channel: "gfx1",
										system: "",
										group: ""
									},
									template: {
										event: "",
										layer: "klokke",
										name: "51_klokke"
									},
									content: {}
								}
							}, {
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/timing",
								"mosPayload": {
									in: "auto",
									out: "manual",
									timeIn: 500,
									duration: 0
								}
							}]
						}
					},
					{
						"Type": "storyItem",
						"Content": {
							"itemID": 10,
							"itemSlug": "ÅPNING;logo",
							"objID": "3ebcbed9-b60f-49bb-a23e-a223c02aff37",
							"mosID": "GFX.NRK.MOS",
							"mosAbstract": "logo",
							"abstract": "logo",
							"mosExternalMetadata": [{
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/content",
								"mosPayload": {
									"uuid": "cb388abb-68b4-4183-882c-1b5261b07a06",
									metaData: {
										changedBy: "n23109",
										changed: "xxx",
										origin: "ENPS/CORE"
									},
									render: {
										channel: "gfx1",
										system: "",
										group: ""
									},
									template: {
										event: "",
										layer: "logo",
										name: "50_logo"
									},
									content: {}
								}
							}, {
								"mosScope": "PLAYLIST",
								"mosSchema": "schema.nrk.no/timing",
								"mosPayload": {
									in: "auto",
									out: "manual",
									timeIn: 500,
									duration: 0
								}
							}]
						}
					}
				],
				"level": "debug",
				"message": "",
				"timestamp": "2018-05-31T08:19:38.770Z"
			})
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;21D83E74-236C-482C-B1563BF10BF4A2BA","Slug":"SAK 1;Intro","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","ModBy":"N12050","ModTime":"20180322T133453Z","Owner":"N12050","mosartType":"KAM","mosartVariant":2,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[],"level":"debug","message":"","timestamp":"2018-05-31T08:19:38.988Z"}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
			"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;A253988F-FEF4-4D64-ACC2CCFE78EA7C8C",
			"Slug": "SAK 1;SAK 1",
			"MosExternalMetaData": [{
				"MosScope": "PLAYLIST",
				"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
				"MosPayload": {
					"Approved": 0,
					"Creator": "N12050",
					"MediaTime": 13.48,
					"ModBy": "N12050",
					"ModTime": "20180522T092414Z",
					"MOSAbstracts": "METADATA\n US-NJ-BEAR-20180501I IMPORT_QUANTEL 00:02:03:12 \nNavnesuper: Alf Hansen, allviter\nNavnesuper: Hans Hansen, reporter",
					"MOSItemDurations": "13,48",
					"MOSItemEdDurations": "",
					"MOSObjSlugs": "M: \nUS-NJ-BEAR-20180501I\nNavnesuper: Alf Hansen, allviter\nNavnesuper: Hans Hansen, reporter",
					"MOSSlugs": "Uten tittel\nSAK 1;SAK 1-3\nSAK 1;SAK 1-4\nSAK 1;SAK 1-5",
					"MOSTimes": "20180531T081903Z\n20180531T081903Z",
					"Owner": "N12050",
					"SourceMediaTime": 0,
					"SourceTextTime": 0,
					"TextTime": 0,
					"Bildebeskrivelse": "",
					"mosartType": "FULL",
					"ReadTime": 13.48,
					"Rettigheter": "Gult",
					"ENPSItemType": 3
				}
			}],
			"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
			"Body": [{
				"Type": "storyItem",
				"Content": {
					"itemID": 2,
					"objID": "N12050_1525334436",
					"mosID": "METADATA.NRK.MOS",
					"mosAbstract": "METADATA",
					"objSlug": "M:",
					"mosExternalMetadata": {
						"mosScope": "PLAYLIST",
						"mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
						"mosPayload": {
							"nrk": {
								"changetime": "2018-05-03T10:00:36 +02:00",
								"changedBy": "N12050",
								"type": "video",
								"mdSource": "omnibus",
								"title": {},
								"description": {},
								"hbbtv": {
									"link": ""
								},
								"rights": {
									"notes": "",
									"owner": "",
									"@t": "Amber"
								}
							}
						}
					},
					"itemSlug": "Uten tittel"
				}
			}, {
				"Type": "storyItem",
				"Content": {
					"itemID": 3,
					"itemSlug": "SAK 1;SAK 1-3",
					"objID": "\\\\XPRO\\Omn\\A\\A\\40\\39",
					"mosID": "OMNIBUS.XPRO.MOS",
					"mosAbstract": "US-NJ-BEAR-20180501I IMPORT_QUANTEL 00:02:03:12",
					"objDur": 6174,
					"objTB": 50,
					"objSlug": "US-NJ-BEAR-20180501I",
					"mosExternalMetadata": {
						"mosScope": "PLAYLIST",
						"mosSchema": "OMNIBUS",
						"mosPayload": {
							"title": "US-NJ-BEAR-20180501I",
							"objectType": "CLIP",
							"clipType": "IMPORT_QUANTEL",
							"objDur": 6174,
							"objType": "VIDEO"
						}
					}
				}
			}, {
				"Type": "storyItem",
				"Content": {
					"itemID": 4,
					"itemSlug": "SAK 1;SAK 1-4",
					"objID": "718f3e5a-d065-4cb9-b5f7-f351fe28be48",
					"mosID": "GFX.NRK.MOS",
					"mosAbstract": "Navnesuper: Alf Hansen, allviter",
					"mosExternalMetadata": [{
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/content",
						"mosPayload": {
							"uuid": "f6103c96-c981-4716-bdbc-b0b654de3041",
							"metaData": {
								"changedBy": "n23109",
								"changed": "xxx",
								"origin": "ENPS/CORE"
							},
							"render": {
								"channel": "gfx1",
								"system": {},
								"group": {}
							},
							"template": {
								"event": {},
								"layer": "super",
								"name": "navnesuper"
							},
							"content": {
								"navn": "Alf Hansen",
								"tittel": "allviter"
							}
						}
					}, {
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/timing",
						"mosPayload": {
							"in": "auto",
							"out": "auto",
							"timeIn": 5000,
							"duration": 4000
						}
					}]
				}
			}, {
				"Type": "storyItem",
				"Content": {
					"itemID": 5,
					"itemSlug": "SAK 1;SAK 1-5",
					"objID": "f774dbd0-1ef5-44e9-a7dc-54d3e7ce5e76",
					"mosID": "GFX.NRK.MOS",
					"mosAbstract": "Navnesuper: Hans Hansen, reporter",
					"mosExternalMetadata": [{
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/content",
						"mosPayload": {
							"uuid": "f6103c96-c981-4716-bdbc-b0b654de3041",
							"metaData": {
								"changedBy": "n23109",
								"changed": "xxx",
								"origin": "ENPS/CORE"
							},
							"render": {
								"channel": "gfx1",
								"system": {},
								"group": {}
							},
							"template": {
								"event": {},
								"layer": "super",
								"name": "navnesuper"
							},
							"content": {
								"navn": "Hans Hansen",
								"tittel": "reporter"
							}
						}
					}, {
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/timing",
						"mosPayload": {
							"in": "auto",
							"out": "auto",
							"timeIn": 15000,
							"duration": 4000
						}
					}]
				}
			}],
			"level": "debug",
			"message": "",
			"timestamp": "2018-05-31T08:19:39.191Z"
		}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;25B5E1DD-082A-4939-B2CC7AD5DA511FC3","Slug":"SAK 2;Intro","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","MediaTime":0,"ModBy":"N12050","ModTime":"20180503T080805Z","Owner":"N12050","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"Dette er intro sak 2","TextTime":3,"mosartType":"KAM","mosartVariant":2,"ReadTime":3,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[],"level":"debug","message":"","timestamp":"2018-05-31T08:19:39.374Z"}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;619A8B1E-5F39-42B8-9D5C318A48342392","Slug":"SAK 2;SAK 2","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","MediaTime":328.88,"ModBy":"N12050","ModTime":"20180522T092445Z","MOSAbstracts":"M: Dette er en øvelse (03-05-18 10:02)\nØVELSE-280418-DR19 NYHETER 00:05:28:22\nNavnesuper: Hans Hansen, reporter\nNavnesuper: Alf Ivar Johnsen, baker","MOSItemDurations":"328,88","MOSItemEdDurations":"","MOSObjSlugs":"M: Dette er en øvelse\nØVELSE-280418-DR19\nNavnesuper: Hans Hansen, reporter\nNavnesuper: Alf Ivar Johnsen, baker","MOSSlugs":"Uten tittel\nSAK 2;SAK 2-2\nSAK 2;SAK 2-4\nSAK 2;SAK 2-5","MOSTimes":"20180531T081903Z\n20180531T081903Z","Owner":"N12050","SourceMediaTime":0,"SourceTextTime":0,"TextTime":0,"Bildebeskrivelse":"Her er beskrivelsen av bildene","Fylke":"Hordaland","Innslagstittel":"Dette er en øvelse","Kommune":"Bergen","mosartType":"FULL","OpprLand":"Norge","ReadTime":328.88,"Rettigheter":"Grønt","Rettighetseier":"NRK","Sted":"Bergen","Tags":"test","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[{"Type":"storyItem","Content":{"itemID":3,"objID":"N12050_1525334564","mosID":"METADATA.NRK.MOS","mosAbstract":"M: Dette er en øvelse (03-05-18 10:02)","objSlug":"M: Dette er en øvelse","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"mdSource":"omnibus","type":"video","changedBy":"N12050","changetime":"2018-05-03T10:02:44 +02:00","title":"Dette er en øvelse","description":"Her er beskrivelsen av bildene","hbbtv":{"link":""},"location":{"id":"1-92416","region":"Hordaland","lat":60.39826,"lon":5.32907,"@t":"Bergen"},"tag":{"id":6519,"@t":"test"},"rights":{"notes":"","owner":"NRK","@t":"Green"}}}},"itemSlug":"Uten tittel"}},{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"SAK 2;SAK 2-2","objID":"\\\\XPRO\\Omn\\A\\A\\40\\36","mosID":"OMNIBUS.XPRO.MOS","mosAbstract":"ØVELSE-280418-DR19 NYHETER 00:05:28:22","objDur":16444,"objTB":50,"objSlug":"ØVELSE-280418-DR19","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"OMNIBUS","mosPayload":{"title":"Dette er en øvelse","objectType":"CLIP","clipType":"NYHETER","objDur":16444}}}},{"Type":"storyItem","Content":{"itemID":4,"itemSlug":"SAK 2;SAK 2-4","objID":"f774dbd0-1ef5-44e9-a7dc-54d3e7ce5e76","mosID":"GFX.NRK.MOS","mosAbstract":"Navnesuper: Hans Hansen, reporter","mosExternalMetadata":[{"mosScope":"PLAYLIST","mosSchema":"schema.nrk.no/content","mosPayload":{"uuid":"f6103c96-c981-4716-bdbc-b0b654de3041","metaData":{"changedBy":"n23109","changed":"xxx","origin":"ENPS/CORE"},"render":{"channel":"gfx1","system":{},"group":{}},"template":{"event":{},"layer":"super","name":"navnesuper"},"content":{"navn":"Hans Hansen","tittel":"reporter"}}},{"mosScope":"PLAYLIST","mosSchema":"schema.nrk.no/timing","mosPayload":{"in":"auto","out":"auto","timeIn":5000,"duration":4000}}]}},{"Type":"storyItem","Content":{"itemID":5,"itemSlug":"SAK 2;SAK 2-5","objID":"4f2b1698-7603-4093-b20d-0c5b04b37361","mosID":"GFX.NRK.MOS","mosAbstract":"Navnesuper: Alf Ivar Johnsen, baker","mosExternalMetadata":[{"mosScope":"PLAYLIST","mosSchema":"schema.nrk.no/content","mosPayload":{"uuid":"f6103c96-c981-4716-bdbc-b0b654de3041","metaData":{"changedBy":"n23109","changed":"xxx","origin":"ENPS/CORE"},"render":{"channel":"gfx1","system":{},"group":{}},"template":{"event":{},"layer":"super","name":"navnesuper"},"content":{"navn":"Alf Ivar Johnsen","tittel":"baker"}}},{"mosScope":"PLAYLIST","mosSchema":"schema.nrk.no/timing","mosPayload":{"in":"auto","out":"auto","timeIn":5000,"duration":4000}}]}}],"level":"debug","message":"","timestamp":"2018-05-31T08:19:39.620Z"}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;B539EBBC-5877-4301-8FFFC0371031A29A","Slug":"DIR;Intro","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","MediaTime":0,"ModBy":"N12050","ModTime":"20180503T080349Z","Owner":"N12050","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"Nå skal vi inn direkte i testen av Sofie. \n<BAK>RM1","TextTime":3,"mosartType":"KAM","mosartVariant":1,"ReadTime":3,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[],"level":"debug","message":"","timestamp":"2018-05-31T08:19:39.797Z"}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
			"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;12ABC87D-6709-447A-B2D9AAE0C4A7E360",
			"Slug": "DIR;Split",
			"MosExternalMetaData": [{
				"MosScope": "PLAYLIST",
				"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
				"MosPayload": {
					"Approved": 0,
					"Creator": "N12050",
					"MediaTime": 0,
					"ModBy": "N12050",
					"ModTime": "20180522T092538Z",
					"MOSAbstracts": "Navnesuper: Alf Ivar Johnsen, baker\nNavnesuper: Hans Hansen, reporter",
					"MOSItemDurations": "",
					"MOSItemEdDurations": "",
					"MOSObjSlugs": "Navnesuper: Alf Ivar Johnsen, baker\nNavnesuper: Hans Hansen, reporter",
					"MOSSlugs": "DIR;Split-2\nDIR;Split-3",
					"MOSTimes": "20180531T081903Z\n20180531T081903Z",
					"Owner": "N12050",
					"SourceMediaTime": 0,
					"SourceTextTime": 0,
					"StoryLogPreview": "Hans Hansen, hva skjer der du er?\nSuper: Direkte, sted",
					"TextTime": 4,
					"mosartType": "DVE",
					"mosartVariant": "2LIKE",
					"ReadTime": 4,
					"ip1": "K1",
					"ip2": "RM1",
					"ENPSItemType": 3
				}
			}],
			"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
			"Body": [{
				"Type": "storyItem",
				"Content": {
					"itemID": 2,
					"itemSlug": "DIR;Split-2",
					"objID": "4f2b1698-7603-4093-b20d-0c5b04b37361",
					"mosID": "GFX.NRK.MOS",
					"mosAbstract": "Navnesuper: Alf Ivar Johnsen, baker",
					"mosExternalMetadata": [{
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/content",
						"mosPayload": {
							"uuid": "f6103c96-c981-4716-bdbc-b0b654de3041",
							"metaData": {
								"changedBy": "n23109",
								"changed": "xxx",
								"origin": "ENPS/CORE"
							},
							"render": {
								"channel": "gfx1",
								"system": {},
								"group": {}
							},
							"template": {
								"event": {},
								"layer": "super",
								"name": "navnesuper"
							},
							"content": {
								"navn": "Alf Ivar Johnsen",
								"tittel": "baker"
							}
						}
					}, {
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/timing",
						"mosPayload": {
							"in": "auto",
							"out": "auto",
							"timeIn": 5000,
							"duration": 4000
						}
					}]
				}
			}, {
				"Type": "storyItem",
				"Content": {
					"itemID": 3,
					"itemSlug": "DIR;Split-3",
					"objID": "46256d10-f2a4-4230-a72f-96aaf5d08c64",
					"mosID": "GFX.NRK.MOS",
					"mosAbstract": "Navnesuper: Hans Hansen, reporter",
					"mosExternalMetadata": [{
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/content",
						"mosPayload": {
							"uuid": "f6103c96-c981-4716-bdbc-b0b654de3041",
							"metaData": {
								"changedBy": "n23109",
								"changed": "xxx",
								"origin": "ENPS/CORE"
							},
							"render": {
								"channel": "gfx1",
								"system": {},
								"group": {}
							},
							"template": {
								"event": {},
								"layer": "super",
								"name": "navnesuper"
							},
							"content": {
								"navn": "Hans Hansen",
								"tittel": "reporter"
							}
						}
					}, {
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/timing",
						"mosPayload": {
							"in": "auto",
							"out": "auto",
							"timeIn": 5000,
							"duration": 4000
						}
					}]
				}
			}],
			"level": "debug",
			"message": "",
			"timestamp": "2018-05-31T08:19:39.997Z"
		}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
			"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;9AAC721E-A8C6-4CAA-9DDD6E5835B55582",
			"Slug": "DIR;Direkte",
			"MosExternalMetaData": [{
				"MosScope": "PLAYLIST",
				"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
				"MosPayload": {
					"Approved": 0,
					"Creator": "N12050",
					"MediaTime": 0,
					"ModBy": "N12050",
					"ModTime": "20180503T080705Z",
					"MOSAbstracts": "M: Test av Sofie (03-05-18 10:06)",
					"MOSObjSlugs": "M: Test av Sofie",
					"MOSSlugs": "Uten tittel",
					"Owner": "N12050",
					"SourceMediaTime": 0,
					"SourceTextTime": 0,
					"TextTime": 5,
					"Bildebeskrivelse": "",
					"Fylke": "Sogn og Fjordane",
					"Innslagstittel": "Test av Sofie",
					"Kommune": "Eid",
					"mosartType": "DIR",
					"mosartVariant": 1,
					"OpprLand": "Norge",
					"ReadTime": 5,
					"Rettigheter": "Grønt",
					"Rettighetseier": "NRK",
					"Sted": "Os",
					"ENPSItemType": 3
				}
			}],
			"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
			"Body": [{
				"Type": "storyItem",
				"Content": {
					"itemID": 2,
					"objID": "N12050_1525334819",
					"mosID": "METADATA.NRK.MOS",
					"mosAbstract": "M: Test av Sofie (03-05-18 10:06)",
					"objSlug": "M: Test av Sofie",
					"mosExternalMetadata": {
						"mosScope": "PLAYLIST",
						"mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
						"mosPayload": {
							"nrk": {
								"changetime": "2018-05-03T10:06:58 +02:00",
								"changedBy": "N12050",
								"type": "video",
								"mdSource": "ncs",
								"title": "Test av Sofie",
								"description": {},
								"hbbtv": {
									"link": ""
								},
								"location": {
									"id": "1-2608277",
									"region": "Eid, Sogn og Fjordane",
									"lat": 61.90197,
									"lon": 5.98855,
									"@t": "Os"
								},
								"rights": {
									"notes": "",
									"owner": "NRK",
									"@t": "Green"
								}
							}
						}
					},
					"itemSlug": "Uten tittel"
				}
			}],
			"level": "debug",
			"message": "",
			"timestamp": "2018-05-31T08:19:40.233Z"
		})
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
			"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;D5CDDB91-2823-48D5-A50829B0907B8D79",
			"Slug": "STK Synk;Tekst",
			"MosExternalMetaData": [{
				"MosScope": "PLAYLIST",
				"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
				"MosPayload": {
					"Approved": 0,
					"Creator": "N12050",
					"MediaTime": 0,
					"ModBy": "N12050",
					"ModTime": "20180503T080833Z",
					"Owner": "N12050",
					"SourceMediaTime": 0,
					"SourceTextTime": 0,
					"StoryLogPreview": "Dette er teksten som programleder skal lese når vi kjører VB",
					"TextTime": 4,
					"mosartType": "KAM",
					"mosartVariant": 1,
					"ReadTime": 4,
					"ENPSItemType": 3
				}
			}],
			"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
			"Body": [],
			"level": "debug",
			"message": "",
			"timestamp": "2018-05-31T08:19:40.408Z"
		}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
			"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;F485B9D0-0D2B-4548-A353E771A7F0F4B6",
			"Slug": "STK Synk;STK",
			"MosExternalMetaData": [{
				"MosScope": "PLAYLIST",
				"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
				"MosPayload": {
					"Approved": 0,
					"Creator": "N12050",
					"MediaTime": 0,
					"ModBy": "N12050",
					"ModTime": "20180522T092538Z",
					"MOSAbstracts": "Navnesuper: Alf Ivar Johnsen, baker\nNavnesuper: Hans Hansen, reporter",
					"MOSItemDurations": "",
					"MOSItemEdDurations": "",
					"MOSObjSlugs": "Navnesuper: Alf Ivar Johnsen, baker\nNavnesuper: Hans Hansen, reporter",
					"MOSSlugs": "DIR;Split-2\nDIR;Split-3",
					"MOSTimes": "20180531T081903Z\n20180531T081903Z",
					"Owner": "N12050",
					"SourceMediaTime": 0,
					"SourceTextTime": 0,
					"StoryLogPreview": "Hans Hansen, hva skjer der du er?\nSuper: Direkte, sted",
					"TextTime": 4,
					"mosartType": "DVE",
					"mosartVariant": "2LIKE",
					"ReadTime": 4,
					"ip1": "K3",
					"ip2": "RM2",
					"ENPSItemType": 3
				}
			}],
			"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
			"Body": [{
				"Type": "storyItem",
				"Content": {
					"itemID": 2,
					"itemSlug": "DIR;Split-2",
					"objID": "4f2b1698-7603-4093-b20d-0c5b04b37361",
					"mosID": "GFX.NRK.MOS",
					"mosAbstract": "Navnesuper: Alf Ivar Johnsen, baker",
					"mosExternalMetadata": [{
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/content",
						"mosPayload": {
							"uuid": "f6103c96-c981-4716-bdbc-b0b654de3041",
							"metaData": {
								"changedBy": "n23109",
								"changed": "xxx",
								"origin": "ENPS/CORE"
							},
							"render": {
								"channel": "gfx1",
								"system": {},
								"group": {}
							},
							"template": {
								"event": {},
								"layer": "super",
								"name": "navnesuper"
							},
							"content": {
								"navn": "Alf Ivar Johnsen",
								"tittel": "baker"
							}
						}
					}, {
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/timing",
						"mosPayload": {
							"in": "auto",
							"out": "auto",
							"timeIn": 5000,
							"duration": 4000
						}
					}]
				}
			}, {
				"Type": "storyItem",
				"Content": {
					"itemID": 3,
					"itemSlug": "DIR;Split-3",
					"objID": "46256d10-f2a4-4230-a72f-96aaf5d08c64",
					"mosID": "GFX.NRK.MOS",
					"mosAbstract": "Navnesuper: Hans Hansen, reporter",
					"mosExternalMetadata": [{
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/content",
						"mosPayload": {
							"uuid": "f6103c96-c981-4716-bdbc-b0b654de3041",
							"metaData": {
								"changedBy": "n23109",
								"changed": "xxx",
								"origin": "ENPS/CORE"
							},
							"render": {
								"channel": "gfx1",
								"system": {},
								"group": {}
							},
							"template": {
								"event": {},
								"layer": "super",
								"name": "navnesuper"
							},
							"content": {
								"navn": "Hans Hansen",
								"tittel": "reporter"
							}
						}
					}, {
						"mosScope": "PLAYLIST",
						"mosSchema": "schema.nrk.no/timing",
						"mosPayload": {
							"in": "auto",
							"out": "auto",
							"timeIn": 5000,
							"duration": 4000
						}
					}]
				}
			}],
			"level": "debug",
			"message": "",
			"timestamp": "2018-05-31T08:19:39.997Z"
		}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;C997A8EF-C221-4678-B31EB0419009628E","Slug":"STK Synk;Synk","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","MediaTime":158.32,"ModBy":"N12050","ModTime":"20180522T092658Z","MOSAbstracts":"M: Ny Avengers-film (03-05-18 10:10)\nAVENGERS-190418-DR19 NYHETER 00:02:38:08\nNavnesuper: Petter Hansen, slakter","MOSItemDurations":"158,32","MOSItemEdDurations":"","MOSObjSlugs":"M: Ny Avengers-film\nAVENGERS-190418-DR19\nNavnesuper: Petter Hansen, slakter","MOSSlugs":"Uten tittel\nSTK Synk;Synk-2\nSTK Synk;Synk-4","MOSTimes":"20180531T081903Z","Owner":"N12050","SourceMediaTime":0,"SourceTextTime":0,"TextTime":1,"AndreMetadata":"{reporter};Christian Ingebrethsen;","Bildebeskrivelse":"","Fylke":"England","Innslagstittel":"Ny Avengers-film","Kommune":"Greater London","mosartTransition":"effect 2","mosartType":"FULL","OpprLand":"Storbritannia","ReadTime":159.32,"Rettigheter":"Grønt","Rettighetseier":"NRK","Sted":"London","Tags":"avengers; marvel; tegneserier","Team":"{reporter};Christian Ingebrethsen;","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[{"Type":"storyItem","Content":{"itemID":3,"objID":"N12050_1525335039","mosID":"METADATA.NRK.MOS","mosAbstract":"M: Ny Avengers-film (03-05-18 10:10)","objSlug":"M: Ny Avengers-film","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"changetime":"2018-05-03T10:10:39 +02:00","changedBy":"N12050","type":"video","mdSource":"omnibus","title":"Ny Avengers-film","description":{},"hbbtv":{"link":""},"staff":{"userid":"n22621","roles":"reporter","@t":"Christian Ingebrethsen"},"location":{"id":"2-2643743","region":"Greater London, England, Storbritannia","lat":51.50853,"lon":-0.12574,"@t":"London"},"tag":[{"id":95257,"@t":"avengers"},{"id":95258,"@t":"marvel"},{"id":95259,"@t":"tegneserier"}],"rights":{"notes":"","owner":"NRK","@t":"Green"}}}},"itemSlug":"Uten tittel"}},{"Type":"storyItem","Content":{"itemID":2,"itemSlug":"STK Synk;Synk-2","objID":"\\\\XPRO\\Omn\\A\\A\\40\\26","mosID":"OMNIBUS.XPRO.MOS","mosAbstract":"AVENGERS-190418-DR19 NYHETER 00:02:38:08","objDur":7916,"objTB":50,"objSlug":"AVENGERS-190418-DR19","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"OMNIBUS","mosPayload":{"title":"Ny Avengers-film","objectType":"CLIP","clipType":"NYHETER","objDur":7916}}}},{"Type":"storyItem","Content":{"itemID":4,"itemSlug":"STK Synk;Synk-4","objID":"5dac983a-ad64-4780-ab8e-241170b572be","mosID":"GFX.NRK.MOS","mosAbstract":"Navnesuper: Petter Hansen, slakter","mosExternalMetadata":[{"mosScope":"PLAYLIST","mosSchema":"schema.nrk.no/content","mosPayload":{"uuid":"f6103c96-c981-4716-bdbc-b0b654de3041","metaData":{"changedBy":"n23109","changed":"xxx","origin":"ENPS/CORE"},"render":{"channel":"gfx1","system":{},"group":{}},"template":{"event":{},"layer":"super","name":"navnesuper"},"content":{"navn":"Petter Hansen","tittel":"slakter"}}},{"mosScope":"PLAYLIST","mosSchema":"schema.nrk.no/timing","mosPayload":{"in":"auto","out":"auto","timeIn":5000,"duration":4000}}]}}],"level":"debug","message":"","timestamp":"2018-05-31T08:19:40.819Z"})
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;AC6784C9-5722-4286-A763BB64775CCB84","Slug":"Nettpromo;Tekst","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","MediaTime":0,"ModBy":"N12050","ModTime":"20180503T081121Z","Owner":"N12050","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"I dag kan vi lese om Trimp på våre nettsider","TextTime":3,"mosartType":"KAM","mosartVariant":1,"ReadTime":3,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[],"level":"debug","message":"","timestamp":"2018-05-31T08:19:41.010Z"})
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, {
			"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;F39A88CF-9EFE-4881-8E04526996A5E526",
			"Slug": "Nettpromo;Grafikk",
			"MosExternalMetaData": [{
				"MosScope": "PLAYLIST",
				"MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
				"MosPayload": {
					"Approved": 0,
					"Creator": "N12050",
					"MediaTime": 0,
					"ModBy": "N12050",
					"ModTime": "20180503T081156Z",
					"MOSAbstracts": "M: Nettet nå (03-05-18 10:11)",
					"MOSObjSlugs": "M: Nettet nå",
					"MOSSlugs": "Uten tittel",
					"Owner": "N12050",
					"SourceMediaTime": 0,
					"SourceTextTime": 0,
					"TextTime": 1,
					"Bildebeskrivelse": "",
					"Innslagstittel": "Nettet nå",
					"mosartType": "GRAFIKK",
					"mosartVariant": "PROMO",
					"ReadTime": 1,
					"Rettigheter": "Grønt",
					"Rettighetseier": "NRK",
					"ENPSItemType": 3
				}
			}],
			"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
			"Body": [{
				"Type": "storyItem",
				"Content": {
					"itemID": 2,
					"objID": "N12050_1525335104",
					"mosID": "METADATA.NRK.MOS",
					"mosAbstract": "M: Nettet nå (03-05-18 10:11)",
					"objSlug": "M: Nettet nå",
					"mosExternalMetadata": {
						"mosScope": "PLAYLIST",
						"mosSchema": "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
						"mosPayload": {
							"nrk": {
								"changetime": "2018-05-03T10:11:44 +02:00",
								"changedBy": "N12050",
								"type": "video",
								"mdSource": "ncs",
								"title": "Nettet nå",
								"description": {},
								"hbbtv": {
									"link": ""
								},
								"rights": {
									"notes": "",
									"owner": "NRK",
									"@t": "Green"
								}
							}
						}
					},
					"itemSlug": "Uten tittel"
				}
			}],
			"level": "debug",
			"message": "",
			"timestamp": "2018-05-31T08:19:41.205Z"
		}),
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;95EBAE5C-A888-478E-87234C566DCA3D55","Slug":"Vær;Intro","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","MediaTime":0,"ModBy":"N12050","ModTime":"20180503T081217Z","Owner":"N12050","SourceMediaTime":0,"SourceTextTime":0,"StoryLogPreview":"Nå skal vi se hva slags vær vi får de neste tre dagene","TextTime":4,"mosartType":"KAM","mosartVariant":1,"ReadTime":4,"ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[],"level":"debug","message":"","timestamp":"2018-05-31T08:19:41.411Z"})
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{"ID":"MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;2E21CEBA-BE5E-483C-9A26F64B5AB51643","Slug":"Vær;Vær","MosExternalMetaData":[{"MosScope":"PLAYLIST","MosSchema":"http://MAENPSTEST14:10505/schema/enps.dtd","MosPayload":{"Approved":0,"Creator":"N12050","MediaTime":600,"ModBy":"N12050","ModTime":"20180503T081321Z","MOSAbstracts":"M: Været (03-05-18 10:12)\n dk-været-to-1955-220318 SLETT_VSERV_Y_TIMER 00:10:00:00","MOSItemDurations":600,"MOSItemEdDurations":"","MOSObjSlugs":"M: Været\ndk-været-to-1955-220318","MOSSlugs":"Uten tittel\nVær;Vær-3","MOSTimes":"","Owner":"N12050","SourceMediaTime":0,"SourceTextTime":0,"TextTime":4,"Bildebeskrivelse":"","Innslagstittel":"Været","mosartType":"FULL","ReadTime":604,"Rettigheter":"Grønt","Rettighetseier":"NRK","ENPSItemType":3}}],"RunningOrderId":"MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5","Body":[{"Type":"storyItem","Content":{"itemID":2,"objID":"N12050_1525335158","mosID":"METADATA.NRK.MOS","mosAbstract":"M: Været (03-05-18 10:12)","objSlug":"M: Været","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"http://mosA4.com/mos/supported_schemas/MOSAXML2.08","mosPayload":{"nrk":{"changetime":"2018-05-03T10:12:37 +02:00","changedBy":"N12050","type":"video","mdSource":"ncs","title":"Været","description":{},"hbbtv":{"link":""},"rights":{"notes":"","owner":"NRK","@t":"Green"}}}},"itemSlug":"Uten tittel"}},{"Type":"storyItem","Content":{"itemID":3,"itemSlug":"Vær;Vær-3","objID":"\\\\XPRO\\Omn\\A\\A\\38\\60","mosID":"OMNIBUS.XPRO.MOS","mosAbstract":"dk-været-to-1955-220318 SLETT_VSERV_Y_TIMER 00:10:00:00","objDur":30000,"objTB":50,"objSlug":"dk-været-to-1955-220318","mosExternalMetadata":{"mosScope":"PLAYLIST","mosSchema":"OMNIBUS","mosPayload":{"title":"dk-været-to-1955-220318","objectType":"CLIP","clipType":"SLETT_VSERV_Y_TIMER","objDur":30000,"objType":"VIDEO"}}}}],"level":"debug","message":"","timestamp":"2018-05-31T08:19:41.614Z"})
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,{
			"ID": "MAENPSTEST14;P_SERVER14\\W\\R_B39BEF9C-78A3-4A4E-A33BFDB09371EDF5;CA207AAF-9B8C-409B-854DE3CFC2AB8DCF",
			"Slug": "Sluttvignett;Credits",
			"MosExternalMetaData": [{
			 "MosScope": "PLAYLIST",
			 "MosSchema": "http://MAENPSTEST14:10505/schema/enps.dtd",
			 "MosPayload": {
			  "Approved": 0,
			  "Creator": "N12050",
			  "MediaTime": 0,
			  "ModBy": "N12050",
			  "ModTime": "20180503T081417Z",
			  "Owner": "N12050",
			  "SourceMediaTime": 0,
			  "SourceTextTime": 0,
			  "StoryLogPreview": "det var alt vi hadde for i dag, sees i morgen",
			  "TextTime": 7,
			  "mosartType": "KAM",
			  "mosartVariant": "3SLUTT",
			  "ReadTime": 7,
			  "ENPSItemType": 3
			 }
			}],
			"RunningOrderId": "MAENPSTEST14;P_SERVER14\\W;B39BEF9C-78A3-4A4E-A33BFDB09371EDF5",
			"Body": [
				{
					"Type" : "storyItem",
					"Content" : {
						"ID" : "4",
						"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
						"mosID" : "GFX.NRK.MOS",
						"Slug" : "Sluttvignett;Credits-4",
						"mosExternalMetadata" : [
							{
								"mosScope" : "PLAYLIST",
								"mosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
								"mosPayload" : {
									"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
									"metadata" : {
										"modul" : "nora.browser",
										"selection" : [
											"http://nora.render.nyheter.mesosint.nrk.no",
											"super",
											"68_sluttkred_kort"
										],
										"displayName" : "68 Sluttkred (00:01=>00:05, Auto/OnNext): Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no",
										"displayNameShort" : "68 Sluttkred: Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no"
									},
									"render" : {
										"group" : ""
									},
									"template" : {
										"name": "68_sluttkred_kort",
										"channel" : "gfx1",
										"layer" : "fullskjerm",
										"system" : "html"
									},
									"content" : {
										"funksjon1" : "Regi:",
										"navn1" : "Ole Olsen",
										"funksjon2" : "Vaktsjef:",
										"navn2" : "Hans Hansen",
										"funksjon3" : "Redaktør:",
										"navn3" : "Per persen",
										"nettadresse" : "test.nrk.no",
										"navn" : "Per Persen",
										"tittel" : "baker",
										"sted" : "Snåsa"
									}
								}
							},
							{
								"mosScope" : "PLAYLIST",
								"mosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
								"mosPayload" : {
									"timeIn" : 1000,
									"duration" : 5000,
									"in" : "auto",
									"out" : "onNext"
								}
							}
						],
						"mosAbstract" : "68 Sluttkred (00:01=>00:05, Auto/OnNext): Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no"
					}
				},
			],
			"level": "debug",
			"message": "",
			"timestamp": "2018-05-31T08:19:41.850Z"
		   })

	},
	'debug_roMock2' () {
		let pd = getPD()
		if (!pd) {
			throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
		}
		let id = pd._id
		let token = pd.token
		logger.info('debug_roMock2')

		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, id, token,
			new MosString128('MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446'))
		//
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Slug" : "TEST Sofie Helle 1850",
				"EditorialStart" : "2018-09-06T09:08:00,000",
				"EditorialDuration" : "0:9:0",
				"MosExternalMetaData" : [
					{
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enpsro.dtd",
						"MosPayload" : {
							"EndTime" : "2018-07-06T11:27:48",
							"MOSROStatusTime" : "1800-01-01T00:00:00",
							"MOSroStorySend" : "SOFIE1.XPRO.MOS;SOFIE2.XPRO.MOS",
							"ProgramName" : "Testsending",
							"RundownDuration" : "09:00",
							"StartTime" : "2018-07-06T11:18:48",
							"Clipnames" : "Klipp 1;TEST1\\Klipp 2;\\Klipp 3;\\Klipp 4;",
							"Kanal" : "NRK1",
							"LocalStartTime" : "2018-07-06T11:18:48",
							"ENPSItemType" : 2,
							"roLayout" : "PageNum_450|RowStatus_150|Slug_1200|SegStatus_210|Segment_920|mosartType_1000|mosartVariant_1000|mosartTransition_1000|ip1_500|ip2_500|MOSObjSlugs_2000|Estimated_840|Actual_720|MOSItemDurations_1200|Stikkord_500|Float_600|Tekniske-opplysninger_500|FrontTime_1000|CumeTime_1000|Break_600"
						},
						"MosScope" : "PLAYLIST"
					}
				],
				"Stories" : [
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;A24898DF-FBBE-42B8-82FC886FEF748411",
						"Slug" : "åpning;VIGNETT",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;9745AF3D-97B2-4D35-BB5AAFB69CF54579",
						"Slug" : "åpning;Head2",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;6707E448-938D-42C7-96D4156F66B4B2AD",
						"Slug" : "åpning;Head11",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;754BF344-6997-4936-8895B6F625B0EE0A",
						"Slug" : "åpning;Velkommen",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;6DBD519C-52F2-4665-8BE44677C67F7E6C",
						"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL5",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;9D31712F-7A2B-4349-800703E1991AFB30",
						"Slug" : "SKRANTESJUKE;intro",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;8F4EECF6-4B4B-48C4-89C2D895117D0EC4",
						"Slug" : "SAK 2;Intro",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;93301DA7-6A97-45CD-B868133DF6E63D5A",
						"Slug" : "SAK 2;SAK 2",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;9B0BDA28-3442-4F55-9AC44E8EC8DEFD5B",
						"Slug" : "STK Synk;Tekst",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;43147BA3-1294-46C3-B7088B394E9A3345",
						"Slug" : "STK Synk;STK",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;76AC6D1E-4381-42B5-966B8349AB5558E4",
						"Slug" : "STK Synk;Synk",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;5B84D8DF-5347-4D32-95847B2DDA78F630",
						"Slug" : "DIR 18.50;Split",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;A0CA386C-C169-42D5-86F152404585A653",
						"Slug" : "DIR 18.50;Direkte",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;012FCCB7-86A6-4883-BD000BD669D11DA2",
						"Slug" : "KOMMER 2055;tekst",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;C29581AD-D3B6-4018-AB88AFD0E605D8CC",
						"Slug" : "KOMMER 2055;SMS-VARSLING-150618S-SL",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;1B1E5519-3C2D-49FA-A51EFA3DA687EB0C",
						"Slug" : "KOMMER 2055;Full",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;89F9712B-B4D5-4D80-937BF7379C4700B7",
						"Slug" : "SEERBILDE;tekst",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;475341D0-FFFA-4753-B9785A35A07268E3",
						"Slug" : "SEERBILDE;SEERBILDE",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;DC3F3045-94EC-4699-87B55DE1FF4E66F5",
						"Slug" : "Nettpromo;Tekst",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;D4EC0230-B9D2-4985-878572A6C4C467A9",
						"Slug" : "Nettpromo;Grafikk",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;FA11F662-4A45-4F90-A95D09B74EB047D9",
						"Slug" : "Vær;Intro",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;F2D0440C-7E2E-48A5-B9D6FC338FD76E1F",
						"Slug" : "Vær;Vær",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;5C596E40-F75B-463F-A770E8735C60D104",
						"Slug" : "Takk for nå;tekst-takk for nå",
						"Items" : [
						]
					},
					{
						"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;43542D61-DC75-48A1-9B218CFD6E769C7A",
						"Slug" : "Sluttvignett;Credits",
						"Items" : [
						]
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;A24898DF-FBBE-42B8-82FC886FEF748411",
				"Slug" : "åpning;VIGNETT",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 3,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180614T135317Z",
							"MOSAbstracts" : "M: Testsending (23-03-18 08:47)\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "M: Testsending\r\nStory status",
							"MOSSlugs" : "Uten tittel\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142124640Z",
							"MOSTimes" : "",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"Bildebeskrivelse" : "",
							"Innslagstittel" : "Testsending",
							"mosartType" : "FULL",
							"mosartVariant" : "VIGNETT",
							"ReadTime" : 0,
							"Rettigheter" : "Gult",
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "N12050_1521791220",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2018-03-23T08:47:00 +01:00",
												"changedBy" : "N12050",
												"type" : "video",
												"mdSource" : "ncs"
											},
											"title" : "Testsending",
											"description" : "",
											"hbbtv" : {
												"link" : ""
											},
											"rights" : {
												"text" : "Amber",
												"notes" : "",
												"owner" : ""
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Testsending (23-03-18 08:47)",
							"ObjectSlug" : "M: Testsending"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;9745AF3D-97B2-4D35-BB5AAFB69CF54579",
				"Slug" : "åpning;Head2",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 8,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 3,
							"MediaTime" : 42.36,
							"ModBy" : "N12050",
							"ModTime" : "20180627T104916Z",
							"MOSAbstracts" : "nv-ungdom-israel-mgp-130518 PUBLISH_QUANTEL 00:00:42:09 \r\n52 Headline (00:00=>00:05, Auto/OnNext): Head to\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "42,36",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "nv-ungdom-israel-mgp-130518\r\n52 Headline (00:00=>00:05, Auto/OnNext): Head to\r\nStory status",
							"MOSSlugs" : "VIGNETT;Head2-2\r\nåpning;Head2-6\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T154833145Z",
							"MOSTimes" : "20180803T121753Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"mosartType" : "STK",
							"mosartVariant" : "HEAD",
							"ReadTime" : 42.36,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\41\\13",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "VIGNETT;Head2-2",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "nv-ungdom-israel-mgp-130518",
										"objectType" : "CLIP",
										"clipType" : "PUBLISH_QUANTEL",
										"objDur" : 2118,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "nv-ungdom-israel-mgp-130518 PUBLISH_QUANTEL 00:00:42:09",
							"ObjectSlug" : "nv-ungdom-israel-mgp-130518",
							"Duration" : "2500",
							"TimeBase": "25"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "6",
							"ObjectID" : "9d73d195-c4cb-4231-bc4e-710878a67b30",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "åpning;Head2-6",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "9d73d195-c4cb-4231-bc4e-710878a67b30",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"52_headline"
											],
											"displayName" : "52 Headline (00:00=>00:05, Auto/OnNext): Head to",
											"displayNameShort" : "52 Headline: Head to",
											"name": {
												"templateName" : "Template Name",
												"templateVariant" : "Template Variant",
											},
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "52_headline",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"text" : "Head to",
											"headline" : "Head to"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"text" : 0,
										"timeIn" : 0,
										"duration" : 5000,
										"in" : "auto",
										"out" : "onNext"
									}
								}
							],
							"mosAbstract" : "52 Headline (00:00=>00:05, Auto/OnNext): Head to"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;6707E448-938D-42C7-96D4156F66B4B2AD",
				"Slug" : "åpning;Head11",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 8,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"MediaTime" : 16.28,
							"ModBy" : "N12050",
							"ModTime" : "20180705T140825Z",
							"MOSAbstracts" : "52 Headline (00:00=>00:05, Auto/OnNext): Head en\r\nmål-sverige-230618 NYHETER 00:00:16:07\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "16,28",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "52 Headline (00:00=>00:05, Auto/OnNext): Head en\r\nmål-sverige-230618\r\nStory status",
							"MOSSlugs" : "åpning;Head1-10\r\nVIGNETT;Head 1-8\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142125541Z",
							"MOSTimes" : "20180803T121753Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"mosartType" : "STK",
							"mosartVariant" : "HEAD",
							"ReadTime" : 16.28,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "10",
							"ObjectID" : "9d73d195-c4cb-4231-bc4e-710878a67b30",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "åpning;Head1-10",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "9d73d195-c4cb-4231-bc4e-710878a67b30",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"52_headline"
											],
											"displayName" : "52 Headline (00:00=>00:05, Auto/OnNext): Head en",
											"displayNameShort" : "52 Headline: Head en",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "52_headline",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"text" : "Head en",
											"headline" : "Head en"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"text" : 0,
										"timeIn" : 0,
										"duration" : 5000,
										"in" : "auto",
										"out" : "onNext"
									}
								}
							],
							"mosAbstract" : "52 Headline (00:00=>00:05, Auto/OnNext): Head en"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "8",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\43\\26",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "VIGNETT;Head 1-8",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "mål-sverige-230618",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 814,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "mål-sverige-230618 NYHETER 00:00:16:07",
							"ObjectSlug" : "mål-sverige-230618"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "9",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;6DBD519C-52F2-4665-8BE44677C67F7E6C",
				"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL5",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 100,
							"text" : 0,
							"Approved" : 0,
							"Break" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"MediaTime" : 107.48,
							"ModBy" : "N12050",
							"ModTime" : "20180702T113235Z",
							"MOSAbstracts" : "M: Skrantesjuka truer hjortebestanden (13-06-18 12:23)\r\n BRANN-BERGEN-040618-HO NYHETER 00:01:47:12 \r\n01 Navn (00:02=>00:05, Auto/Auto): Hilde Skarvøy Gjestland, reporter\r\n01 Navn (00:18=>00:05, Auto/Auto): Tor Punsvik, viltforvalter, fylkesmannen Aust- og Vest Agder\r\n22 Sted/Arkiv (00:27=>00:05, Auto/Auto): Fra dokumentarfilmen \"Villreinens siste vinter\"\r\n22 Sted/Arkiv (00:52=>00:05, Auto/Auto): NRK arkiv\r\n01 Navn (01:22=>00:05, Auto/Auto): Jon Georg Dale, landbruks- og matminister (Frp)\r\n24 Foto/Redigering (01:35=>00:05, Auto/Auto): Foto:, Line Oftedal Pedersen/Asbjørn Odd Berge, Redigering:, Jan Jørg Tomstad\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "107,48",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "M: Skrantesjuka truer hjortebestanden\r\nBRANN-BERGEN-040618-HO\r\n01 Navn (00:02=>00:05, Auto/Auto): Hilde Skarvøy Gjestland, reporter\r\n01 Navn (00:18=>00:05, Auto/Auto): Tor Punsvik, viltforvalter, fylkesmannen Aust- og Vest Agder\r\n22 Sted/Arkiv (00:27=>00:05, Auto/Auto): Fra dokumentarfilmen \"Villreinens siste vinter\"\r\n22 Sted/Arkiv (00:52=>00:05, Auto/Auto): NRK arkiv\r\n01 Navn (01:22=>00:05, Auto/Auto): Jon Georg Dale, landbruks- og matminister (Frp)\r\n24 Foto/Redigering (01:35=>00:05, Auto/Auto): Foto:, Line Oftedal Pedersen/Asbjørn Odd Berge, Redigering:, Jan Jørg Tomstad\r\nStory status",
							"MOSSlugs" : "NYHETSSAK 1;SAK-14\r\nSKRANTESJUKE;SKRANTESJUKE-140618-SL-37\r\nSKRANTESJUKE;SKRANTESJUKE-140618-SL-31\r\nSKRANTESJUKE;SKRANTESJUKE-140618-SL-32\r\nSKRANTESJUKE;SKRANTESJUKE-140618-SL-34\r\nSKRANTESJUKE;SKRANTESJUKE-140618-SL-35\r\nSKRANTESJUKE;SKRANTESJUKE-140618-SL-33\r\nSKRANTESJUKE;SKRANTESJUKE-140618-SL-36\r\nNYHETSSAK 1;SAK-16",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142126322Z",
							"MOSTimes" : "20180803T121753Z\r\n20180803T121753Z\r\n20180803T121753Z\r\n20180803T121753Z\r\n20180803T121753Z\r\n20180803T121753Z\r\n20180615T173428656Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 81,
							"StoryLogPreview" : 52,
							"TextTime" : 0,
							"Bemanning" : "N10145",
							"Bildebeskrivelse" : "Nærbilde av elg. Elg i innhengning. Viltforvalter går i skogen. Landbruksminister blir intervjuet.",
							"Fylke" : "Vest-Agder; Aust-Agder",
							"Innslagstittel" : "Skrantesjuka truer hjortebestanden",
							"Kommune" : "Kristiansand; Bygland",
							"mosartType" : "FULL",
							"OpprLand" : "Norge; Norge",
							"ReadTime" : 107.48,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"Sted" : "Kristiansand; Byglandsfjord",
							"Tags" : "landbruks-og matminister; elg",
							"ENPSItemType" : 3,
							"mosartTransition": "mix 50"
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "N10145_1528885426",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "NYHETSSAK 1;SAK-14",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2018-06-13T12:23:45 +02:00",
												"changedBy" : "N10145",
												"type" : "video",
												"mdSource" : "omnibus"
											},
											"title" : "Skrantesjuka truer hjortebestanden",
											"description" : "Nærbilde av elg. Elg i innhengning. Viltforvalter går i skogen. Landbruksminister blir intervjuet.",
											"hbbtv" : {
												"link" : "",
												"@name" : "hbbtv",
												"@type" : "element"
											},
											"location" : [
												{
													"text" : "Kristiansand",
													"id" : "1-2376",
													"region" : "Vest-Agder",
													"lat" : "58.14615",
													"lon" : "7.99573",
													"@name" : "location",
													"@type" : "text"
												},
												{
													"text" : "Byglandsfjord",
													"id" : "1-11874",
													"region" : "Bygland, Aust-Agder",
													"lat" : "58.66612",
													"lon" : "7.81311",
													"@name" : "location",
													"@type" : "text"
												}
											],
											"tag" : [
												{
													"text" : "landbruks-og matminister",
													"id" : "99041",
													"@name" : "tag",
													"@type" : "text"
												},
												{
													"text" : "elg",
													"id" : "1153",
													"@name" : "tag",
													"@type" : "text"
												}
											],
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK",
												"@name" : "rights",
												"@type" : "text"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Skrantesjuka truer hjortebestanden (13-06-18 12:23)",
							"ObjectSlug" : "M: Skrantesjuka truer hjortebestanden"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "37",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\42\\51",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL-37",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "Storbrann i Bergen.",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 5374,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "BRANN-BERGEN-040618-HO NYHETER 00:01:47:12",
							"ObjectSlug" : "BRANN-BERGEN-040618-HO"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "31",
							"ObjectID" : "dcf9225f-3970-4f5b-98c4-e145f333538c",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL-31",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "dcf9225f-3970-4f5b-98c4-e145f333538c",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Navn (00:02=>00:05, Auto/Auto): Hilde Skarvøy Gjestland, reporter",
											"displayNameShort" : "01 Navn: Hilde Skarvøy Gjestland, reporter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Hilde Skarvøy Gjestland",
											"tittel" : "reporter"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 2000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Navn (00:02=>00:05, Auto/Auto): Hilde Skarvøy Gjestland, reporter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "32",
							"ObjectID" : "dcf9225f-3970-4f5b-98c4-e145f333538c",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL-32",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "dcf9225f-3970-4f5b-98c4-e145f333538c",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Navn (00:18=>00:05, Auto/Auto): Tor Punsvik, viltforvalter, fylkesmannen Aust- og Vest Agder",
											"displayNameShort" : "01 Navn: Tor Punsvik, viltforvalter, fylkesmannen Aust- og Vest Agder",
											"type" : "super"
										},
										"userContext": {
											"changed": "2018-08-16-T16:40:56"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Tor Punsvik",
											"tittel" : "viltforvalter, fylkesmannen Aust- og Vest Agder"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 18000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Navn (00:18=>00:05, Auto/Auto): Tor Punsvik, viltforvalter, fylkesmannen Aust- og Vest Agder"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : 52,
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "34",
							"ObjectID" : "f3d3b8a6-eab2-4709-91d1-a13466bc56f0",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL-34",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "f3d3b8a6-eab2-4709-91d1-a13466bc56f0",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"22_sted_arkiv"
											],
											"displayName" : "22 Sted/Arkiv (00:27=>00:05, Auto/Auto): Fra dokumentarfilmen \"Villreinens siste vinter\"",
											"displayNameShort" : "22 Sted/Arkiv: Fra dokumentarfilmen \"Villreinens siste vinter\"",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "22_sted_arkiv",
											"channel" : "gfx1",
											"layer" : "tagLeft",
											"system" : "html"
										},
										"content" : {
											"sted" : "",
											"arkiv" : "Fra dokumentarfilmen \"Villreinens siste vinter\""
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 27000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "22 Sted/Arkiv (00:27=>00:05, Auto/Auto): Fra dokumentarfilmen \"Villreinens siste vinter\""
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "35",
							"ObjectID" : "f3d3b8a6-eab2-4709-91d1-a13466bc56f0",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL-35",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "f3d3b8a6-eab2-4709-91d1-a13466bc56f0",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"22_sted_arkiv"
											],
											"displayName" : "22 Sted/Arkiv (00:52=>00:05, Auto/Auto): NRK arkiv",
											"displayNameShort" : "22 Sted/Arkiv: NRK arkiv",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "22_sted_arkiv",
											"channel" : "gfx1",
											"layer" : "tagLeft",
											"system" : "html"
										},
										"content" : {
											"sted" : "",
											"arkiv" : "NRK arkiv"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 52000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "22 Sted/Arkiv (00:52=>00:05, Auto/Auto): NRK arkiv"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "33",
							"ObjectID" : "dcf9225f-3970-4f5b-98c4-e145f333538c",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL-33",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "dcf9225f-3970-4f5b-98c4-e145f333538c",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Navn (01:22=>00:05, Auto/Auto): Jon Georg Dale, landbruks- og matminister (Frp)",
											"displayNameShort" : "01 Navn: Jon Georg Dale, landbruks- og matminister (Frp)",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Jon Georg Dale",
											"tittel" : "landbruks- og matminister (Frp)"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 82000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Navn (01:22=>00:05, Auto/Auto): Jon Georg Dale, landbruks- og matminister (Frp)"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "36",
							"ObjectID" : "ac725965-1f26-4f26-bc59-09c6920e9383",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SKRANTESJUKE;SKRANTESJUKE-140618-SL-36",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "ac725965-1f26-4f26-bc59-09c6920e9383",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"24_foto_red"
											],
											"displayName" : "24 Foto/Redigering (01:35=>00:05, Auto/Auto): Foto:, Line Oftedal Pedersen/Asbjørn Odd Berge, Redigering:, Jan Jørg Tomstad",
											"displayNameShort" : "24 Foto/Redigering: Foto:, Line Oftedal Pedersen/Asbjørn Odd Berge, Redigering:, Jan Jørg Tomstad",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "24_foto_red",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"funksjon1" : "Foto:",
											"navn1" : "Line Oftedal Pedersen/Asbjørn Odd Berge",
											"funksjon2" : "Redigering:",
											"navn2" : "Jan Jørg Tomstad"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 95000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "24 Foto/Redigering (01:35=>00:05, Auto/Auto): Foto:, Line Oftedal Pedersen/Asbjørn Odd Berge, Redigering:, Jan Jørg Tomstad"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "9",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "NYHETSSAK 1;SAK-16",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;754BF344-6997-4936-8895B6F625B0EE0A",
				"Slug" : "åpning;Velkommen",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 1,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180706T135354Z",
							"MOSAbstracts" : "01 Ett navn (00:00=>00:05, Auto/Auto): Ivar Johnsen, 27. juni\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "01 Ett navn (00:00=>00:05, Auto/Auto): Ivar Johnsen, 27. juni\r\nStory status",
							"MOSSlugs" : "åpning;Velkommen-5\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142127112Z",
							"MOSTimes" : "20180803T121753Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Hei og velkommen til denne testsendingen",
							"TextTime" : 3,
							"mosartType" : "KAM",
							"mosartVariant" : "2ÅPNING",
							"ReadTime" : 3,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "Hei og velkommen til denne testsendingen",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "åpning;Velkommen-5",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:00=>00:05, Auto/Auto): Ivar Johnsen, 27. juni",
											"displayNameShort" : "01 Ett navn: Ivar Johnsen, 27. juni",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Ivar Johnsen",
											"tittel" : "27. juni"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"text" : 0,
										"timeIn" : 0,
										"duration" : 5000,
										"in" : "auto",
										"out" : "manual"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:00=>00:05, Auto/Auto): Ivar Johnsen, 27. juni"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;9D31712F-7A2B-4349-800703E1991AFB30",
				"Slug" : "SKRANTESJUKE;intro",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Break" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"Estimated" : "00:00:12",
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180706T135310Z",
							"MOSAbstracts" : "SKRANTESJUKE;intro-4\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "SKRANTESJUKE;intro-4\r\nStory status",
							"MOSSlugs" : "SKRANTESJUKE;intro-4\r\nNYHETSSAK 1;Studio med baksjkerm-7",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142128180Z",
							"MOSTimes" : "20180803T121754Z\r\n20180615T173246220Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Alle hjortedyr i landet er truet dersom man ikke greier å STANSE den såkalte skrantesyken.  Det mener viltforvalteren hos fylkesmannen. I Norge er sykdommen nå påvist, og det er stor bekymring for måten norske myndigheter håndterer smitten på.",
							"TextTime" : 17,
							"mosartType" : "KAM",
							"mosartVariant" : 2,
							"ReadTime" : 17,
							"ENPSItemType" : 3,
							"mosartTransition": "mix 50"
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "Alle hjortedyr i landet er truet dersom man ikke greier å STANSE den såkalte skrantesyken.  Det mener viltforvalteren hos fylkesmannen. I Norge er sykdommen nå påvist, og det er stor bekymring for måten norske myndigheter håndterer smitten på.",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "4",
							"ObjectID" : "79274880-2212-491a-9994-23c7b96ee15a",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SKRANTESJUKE;intro-4",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "79274880-2212-491a-9994-23c7b96ee15a",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"bakskjerm",
												"202_bilde"
											],
											"displayName" : {
												"@name" : "displayName",
												"@type" : "element"
											},
											"displayNameShort" : {
												"@name" : "displayNameShort",
												"@type" : "element"
											},
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "202_bilde",
											"channel" : "gfx2",
											"layer" : "bakskjerm",
											"system" : "html"
										},
										"content" : ""
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"text" : 0,
										"timeIn" : 0,
										"duration" : 5000,
										"in" : "auto",
										"out" : "onNext"
									}
								}
							],
							"mosAbstract" : "SKRANTESJUKE;intro-4"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "NYHETSSAK 1;Studio med baksjkerm-7",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;8F4EECF6-4B4B-48C4-89C2D895117D0EC4",
				"Slug" : "SAK 2;Intro",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T120957Z",
							"MOSAbstracts" : "FILMHISTORIE-091217-DR19 NYHETER 00:03:39:14 \r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "219,56",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "FILMHISTORIE-091217-DR19\r\nStory status",
							"MOSSlugs" : "SAK 2;Intro-3\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142129055Z",
							"MOSTimes" : "",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Dette er intro sak 2 hvor vi møter kari som skal ut og gå\r\n<",
							"TextTime" : 4,
							"mosartType" : "KAM",
							"mosartVariant" : 2,
							"ReadTime" : 4,
							"ENPSItemType" : 3,
							"mosartTransition": "mix 50"
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "Dette er intro sak 2 hvor vi møter kari som skal ut og gå",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<BAK><",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\19\\59",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "SAK 2;Intro-3",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "FILMHISTORIE-091217-DR19",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 10978,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "FILMHISTORIE-091217-DR19 NYHETER 00:03:39:14",
							"ObjectSlug" : "FILMHISTORIE-091217-DR19"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : ">",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : ">",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;93301DA7-6A97-45CD-B868133DF6E63D5A",
				"Slug" : "SAK 2;SAK 2",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 105,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"MediaTime" : 107.48,
							"ModBy" : "OMNIBUS.XPRO.MOS",
							"ModTime" : "20180702T075240Z",
							"MOSAbstracts" : "M: Dette er en øvelse (03-05-18 10:02)\r\nBRANN-BERGEN-040618-HO NYHETER 00:01:47:12\r\n01 Ett navn (00:30=>00:05, Auto/Auto): Hans Hansen, allviter\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "107,48",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "M: Dette er en øvelse\r\nBRANN-BERGEN-040618-HO\r\n01 Ett navn (00:30=>00:05, Auto/Auto): Hans Hansen, allviter\r\nStory status",
							"MOSSlugs" : "Uten tittel\r\nSAK 2;SAK 2-7\r\nSAK 2;SAK 2-9\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142129884Z",
							"MOSTimes" : "20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"SystemApprovedBy" : "N639194",
							"Bildebeskrivelse" : "Her er beskrivelsen av bildene",
							"Fylke" : "Hordaland",
							"Innslagstittel" : "Dette er en øvelse",
							"Kommune" : "Bergen",
							"mosartType" : "FULL",
							"OpprLand" : "Norge",
							"ReadTime" : 107.48,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"Sted" : "Bergen",
							"Tags" : "test",
							"ENPSItemType" : 3,
							"mosartTransition": "mix 50"
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "N12050_1525334564",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"mdSource" : "omnibus",
												"type" : "video",
												"changedBy" : "N12050",
												"changetime" : "2018-05-03T10:02:44 +02:00"
											},
											"title" : "Dette er en øvelse",
											"description" : "Her er beskrivelsen av bildene",
											"hbbtv" : {
												"link" : ""
											},
											"location" : {
												"text" : "Bergen",
												"id" : "1-92416",
												"region" : "Hordaland",
												"lat" : "60.39826",
												"lon" : "5.32907"
											},
											"tag" : {
												"text" : "test",
												"id" : "6519"
											},
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Dette er en øvelse (03-05-18 10:02)",
							"ObjectSlug" : "M: Dette er en øvelse"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "7",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\42\\51",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "SAK 2;SAK 2-7",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "Storbrann i Bergen.",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 5374
									}
								}
							],
							"mosAbstract" : "BRANN-BERGEN-040618-HO NYHETER 00:01:47:12",
							"ObjectSlug" : "BRANN-BERGEN-040618-HO"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "9",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SAK 2;SAK 2-9",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:30=>00:05, Auto/Auto): Hans Hansen, allviter",
											"displayNameShort" : "01 Ett navn: Hans Hansen, allviter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Hans Hansen",
											"tittel" : "allviter"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 30000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:30=>00:05, Auto/Auto): Hans Hansen, allviter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "6",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;9B0BDA28-3442-4F55-9AC44E8EC8DEFD5B",
				"Slug" : "STK Synk;Tekst",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 1,
							"Estimated" : 2,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180614T135404Z",
							"MOSAbstracts" : "TIDSMARKØR IKKE RØR",
							"MOSObjSlugs" : "Story status",
							"MOSSlugs" : "ÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142130751Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Dette er teksten som programleder skal lese når vi kjører VB",
							"TextTime" : 4,
							"mosartType" : "KAM",
							"mosartVariant" : 1,
							"ReadTime" : 4,
							"ENPSItemType" : 3,
							"mosartTransition": "mix 50"
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "Dette er teksten som programleder skal lese når vi kjører VB",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<BAK>RM1",
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<BTS><",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\19\\59",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "SAK 2;Intro-3",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "BTS-FILMHISTORIE-091217-DR19",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 10978,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "FILMHISTORIE-091217-DR19 NYHETER 00:03:39:14",
							"ObjectSlug" : "FILMHISTORIE-091217-DR19"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : ">",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;43147BA3-1294-46C3-B7088B394E9A3345",
				"Slug" : "STK Synk;STK",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 41,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121025Z",
							"MOSAbstracts" : "M: Avengers (27-06-18 13:42)\r\ndu-er-dum-250418 PUBLISH_QUANTEL 00:01:38:18",
							"MOSItemDurations" : "98,72",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "M: Avengers\r\ndu-er-dum-250418",
							"MOSSlugs" : "Uten tittel\r\nSTK Synk;STK-3",
							"MOSStoryStatus" : "STOP",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180615T125319411Z",
							"MOSTimes" : "",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "<",
							"TextTime" : 0,
							"AndreMetadata" : "{Fotograf};Helle Rossow;+{Redigerer};Helle Rossow;",
							"Bildebeskrivelse" : "beskrivelse",
							"Fylke" : "Hordaland",
							"Innslagstittel" : "Avengers",
							"Kommune" : "Kvinnherad",
							"mosartType" : "STK",
							"OpprLand" : "Norge",
							"ReadTime" : 0,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"Sted" : "Berhaug",
							"Tags" : "test",
							"Team" : "{Fotograf};Helle Rossow;+{Redigerer};Helle Rossow;",
							"ENPSItemType" : 3,
							"mosartTransition": "mix 50"
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "4",
							"ObjectID" : "N12050_1530099732",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"mdSource" : "omnibus",
												"type" : "video",
												"changedBy" : "N12050",
												"changetime" : "2018-06-27T13:42:11 +02:00"
											},
											"title" : "Avengers",
											"description" : "beskrivelse",
											"hbbtv" : {
												"link" : ""
											},
											"staff" : {
												"text" : "Helle Rossow",
												"userid" : "n12050",
												"roles" : "Fotograf;Redigerer"
											},
											"location" : {
												"text" : "Berhaug",
												"id" : "1-2511926",
												"region" : "Kvinnherad, Hordaland",
												"lat" : "59.78068",
												"lon" : "5.81041",
												"posType" : ""
											},
											"tag" : {
												"text" : "test",
												"id" : "6519"
											},
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Avengers (27-06-18 13:42)",
							"ObjectSlug" : "M: Avengers"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\40\\31",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "STK Synk;STK-3",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "Du er dum",
										"objectType" : "CLIP",
										"clipType" : "PUBLISH_QUANTEL",
										"objDur" : 4936
									}
								}
							],
							"mosAbstract" : "du-er-dum-250418 PUBLISH_QUANTEL 00:01:38:18",
							"ObjectSlug" : "du-er-dum-250418"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : ">",
							"@name" : "p",
							"@type" : "text"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;76AC6D1E-4381-42B5-966B8349AB5558E4",
				"Slug" : "STK Synk;Synk",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 105,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 1,
							"MediaTime" : 107.48,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121107Z",
							"MOSAbstracts" : "M: Ny Avengers-film (03-05-18 10:10)\r\nBRANN-BERGEN-040618-HO NYHETER 00:01:47:12\r\n01 Ett navn (00:10=>00:05, Auto/Auto): Petter Pettersen, slakter\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "107,48",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "M: Ny Avengers-film\r\nBRANN-BERGEN-040618-HO\r\n01 Ett navn (00:10=>00:05, Auto/Auto): Petter Pettersen, slakter\r\nStory status",
							"MOSSlugs" : "Uten tittel\r\nSTK Synk;Synk-6\r\nSTK Synk;Synk-7\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142132480Z",
							"MOSTimes" : "20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"AndreMetadata" : "{reporter};Christian Ingebrethsen;",
							"Bildebeskrivelse" : "",
							"Fylke" : "England",
							"Innslagstittel" : "Ny Avengers-film",
							"Kommune" : "Greater London",
							"mosartType" : "FULL",
							"OpprLand" : "Storbritannia",
							"ReadTime" : 107.48,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"Sted" : "London",
							"Tags" : "avengers; marvel; tegneserier",
							"Team" : "{reporter};Christian Ingebrethsen;",
							"ENPSItemType" : 3,
							"mosartTransition": "mix 50"
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "N12050_1525335039",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2018-05-03T10:10:39 +02:00",
												"changedBy" : "N12050",
												"type" : "video",
												"mdSource" : "omnibus"
											},
											"title" : "Ny Avengers-film",
											"description" : {
												"@name" : "description",
												"@type" : "element"
											},
											"hbbtv" : {
												"link" : "",
												"@name" : "hbbtv",
												"@type" : "element"
											},
											"staff" : {
												"text" : "Christian Ingebrethsen",
												"userid" : "n22621",
												"roles" : "reporter",
												"@name" : "staff",
												"@type" : "text"
											},
											"location" : {
												"text" : "London",
												"id" : "2-2643743",
												"region" : "Greater London, England, Storbritannia",
												"lat" : "51.50853",
												"lon" : "-0.12574",
												"@name" : "location",
												"@type" : "text"
											},
											"tag" : [
												{
													"text" : "avengers",
													"id" : "95257",
													"@name" : "tag",
													"@type" : "text"
												},
												{
													"text" : "marvel",
													"id" : "95258",
													"@name" : "tag",
													"@type" : "text"
												},
												{
													"text" : "tegneserier",
													"id" : "95259",
													"@name" : "tag",
													"@type" : "text"
												}
											],
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK",
												"@name" : "rights",
												"@type" : "text"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Ny Avengers-film (03-05-18 10:10)",
							"ObjectSlug" : "M: Ny Avengers-film"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "6",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\42\\51",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "STK Synk;Synk-6",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "Storbrann i Bergen.",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 5374
									}
								}
							],
							"mosAbstract" : "BRANN-BERGEN-040618-HO NYHETER 00:01:47:12",
							"ObjectSlug" : "BRANN-BERGEN-040618-HO"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "7",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "STK Synk;Synk-7",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:10=>00:05, Auto/Auto): Petter Pettersen, slakter",
											"displayNameShort" : "01 Ett navn: Petter Pettersen, slakter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Petter Pettersen",
											"tittel" : "slakter"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 10000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:10=>00:05, Auto/Auto): Petter Pettersen, slakter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;5B84D8DF-5347-4D32-95847B2DDA78F630",
				"Slug" : "DIR 18.50;Split",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 15,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180705T140039Z",
							"MOSAbstracts" : "55 Direkte (00:30=>00:05, Auto/OnNext): Snåsa\r\n01 Ett navn (00:30=>00:05, Manual/Auto): Hans Hansen, allviter\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "55 Direkte (00:30=>00:05, Auto/OnNext): Snåsa\r\n01 Ett navn (00:30=>00:05, Manual/Auto): Hans Hansen, allviter\r\nStory status",
							"MOSSlugs" : "DIR 18.50;Split-9\r\nDIR;Split-7\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T142133244Z",
							"MOSTimes" : "20180803T121754Z\r\n20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Hans Hansen, hva skjer der du er?",
							"TextTime" : 2,
							"mosartType" : "DVE",
							"mosartVariant" : "2LIKE",
							"ReadTime" : 2,
							"ip1" : "K1",
							"ip2" : "K2",
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "9",
							"ObjectID" : "a5b9f44c-92c6-45cc-ab69-52ff16d6b585",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "DIR 18.50;Split-9",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "a5b9f44c-92c6-45cc-ab69-52ff16d6b585",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"55_direkte"
											],
											"displayName" : "55 Direkte (00:30=>00:05, Auto/OnNext): Snåsa",
											"displayNameShort" : "55 Direkte: Snåsa",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "55_direkte",
											"channel" : "gfx1",
											"layer" : "tagRight",
											"system" : "html"
										},
										"content" : {
											"sted" : "Snåsa",
											"tematekst" : "Sesongåpning i Ravnedalen",
											"infotekst" : "#nrknyheter"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 30000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "onNext"
									}
								}
							],
							"mosAbstract" : "55 Direkte (00:30=>00:05, Auto/OnNext): Snåsa"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "Hans Hansen, hva skjer der du er?",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "7",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "DIR;Split-7",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:30=>00:05, Manual/Auto): Hans Hansen, allviter",
											"displayNameShort" : "01 Ett navn: Hans Hansen, allviter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Hans Hansen",
											"tittel" : "allviter",
											"sted" : "Snåsa"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 30000,
										"duration" : 5000,
										"in" : "manual",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:30=>00:05, Manual/Auto): Hans Hansen, allviter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;A0CA386C-C169-42D5-86F152404585A653",
				"Slug" : "DIR 18.50;Direkte",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 100,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 4635,
							"Estimated" : 120,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180627T120255Z",
							"MOSAbstracts" : "M: Test av Sofie (03-05-18 10:06)\r\n01 Ett navn (00:30=>00:05, Manual/Auto): Nils Nilsen, reporter\r\n01 Ett navn (00:30=>00:05, Manual/Auto): Per Persen, baker\r\n24 Foto/Redigering (00:30=>00:05, Manual/Auto): Foto/teknikk:, Ole Olsen\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "M: Test av Sofie\r\n01 Ett navn (00:30=>00:05, Manual/Auto): Nils Nilsen, reporter\r\n01 Ett navn (00:30=>00:05, Manual/Auto): Per Persen, baker\r\n24 Foto/Redigering (00:30=>00:05, Manual/Auto): Foto/teknikk:, Ole Olsen\r\nStory status",
							"MOSSlugs" : "Uten tittel\r\nDIR;Direkte-6\r\nDIR;Direkte-7\r\nDIR;Direkte-8\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180802T143117478Z",
							"MOSTimes" : "20180803T121754Z\r\n20180803T121754Z\r\n20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"Bildebeskrivelse" : "",
							"Fylke" : "Sogn og Fjordane",
							"Innslagstittel" : "Test av Sofie",
							"Kommune" : "Eid",
							"mosartType" : "DIR",
							"mosartVariant" : "RM1",
							"OpprLand" : "Norge",
							"ReadTime" : 0,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"Sted" : "Os",
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "N12050_1525334819",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2018-05-03T10:06:58 +02:00",
												"changedBy" : "N12050",
												"type" : "video",
												"mdSource" : "ncs"
											},
											"title" : "Test av Sofie",
											"description" : "",
											"hbbtv" : {
												"link" : ""
											},
											"location" : {
												"text" : "Os",
												"id" : "1-2608277",
												"region" : "Eid, Sogn og Fjordane",
												"lat" : "61.90197",
												"lon" : "5.98855"
											},
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Test av Sofie (03-05-18 10:06)",
							"ObjectSlug" : "M: Test av Sofie"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "6",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "DIR;Direkte-6",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:30=>00:05, Manual/Auto): Nils Nilsen, reporter",
											"displayNameShort" : "01 Ett navn: Nils Nilsen, reporter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Nils Nilsen",
											"tittel" : "reporter",
											"sted" : "Snåsa"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 30000,
										"duration" : 5000,
										"in" : "manual",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:30=>00:05, Manual/Auto): Nils Nilsen, reporter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "7",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "DIR;Direkte-7",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:30=>00:05, Manual/Auto): Per Persen, baker",
											"displayNameShort" : "01 Ett navn: Per Persen, baker",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Per Persen",
											"tittel" : "baker",
											"sted" : "Snåsa"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 30000,
										"duration" : 5000,
										"in" : "manual",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:30=>00:05, Manual/Auto): Per Persen, baker"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "8",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "DIR;Direkte-8",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"24_foto_red"
											],
											"displayName" : "24 Foto/Redigering (00:30=>00:05, Manual/Auto): Foto/teknikk:, Ole Olsen",
											"displayNameShort" : "24 Foto/Redigering: Foto/teknikk:, Ole Olsen",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "24_foto_red",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"funksjon1" : "Foto/teknikk:",
											"navn1" : "Ole Olsen",
											"funksjon2" : "",
											"navn2" : "",
											"navn" : "Per Persen",
											"tittel" : "baker",
											"sted" : "Snåsa"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 30000,
										"duration" : 5000,
										"in" : "manual",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "24 Foto/Redigering (00:30=>00:05, Manual/Auto): Foto/teknikk:, Ole Olsen"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;012FCCB7-86A6-4883-BD000BD669D11DA2",
				"Slug" : "KOMMER 2055;tekst",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 7369,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121402Z",
							"MOSAbstracts" : "TIDSMARKØR IKKE RØR",
							"MOSObjSlugs" : "Story status",
							"MOSSlugs" : "ÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180730T091423607Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Varsling av skogbranner (VB) er viktig for befolkningen. I Arendal jobber de nå for å kunne sende SMS til befolkningen som er i et område hvor det er skogbrann. Hans Eriksen og hans team jobber også med å kunne varsle de som er i områder rundt skogbrannen, slik at de kan komme seg ut i tide.",
							"TextTime" : 19,
							"mosartType" : "KAM",
							"mosartVariant" : 2,
							"ReadTime" : 19,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "Varsling av skogbranner (VB) er viktig for befolkningen. I Arendal jobber de nå for å kunne sende SMS til befolkningen som er i et område hvor det er skogbrann. Hans Eriksen og hans team jobber også med å kunne varsle de som er i områder rundt skogbrannen, slik at de kan komme seg ut i tide.",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<BAK><",
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "åpning;Velkommen-5",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:00=>00:05, Auto/Auto): Ivar Johnsen, 27. juni",
											"displayNameShort" : "01 Ett navn: Ivar Johnsen, 27. juni",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "bakskjerm",
											"system" : "html"
										},
										"content" : {
											"navn" : "Ivar Johnsen",
											"tittel" : "27. juni"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"text" : 0,
										"timeIn" : 0,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:00=>00:05, Auto/Auto): Ivar Johnsen, 27. juni"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : ">",
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;C29581AD-D3B6-4018-AB88AFD0E605D8CC",
				"Slug" : "KOMMER 2055;SMS-VARSLING-150618S-SL",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 13,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T111510Z",
							"MOSAbstracts" : "22 Sted/Arkiv (00:01=>00:05, Auto/Auto): Kristiansand juni 2017\r\nM: SMS-varsling (15-06-18 17:03)\r\n SKOGBRANNER-100618S-DR23 NYHETER 00:00:29:16 \r\n10 Tema (00:00=>00:05, Auto/OnNext): SMS ved kaotiske situasjoner i trafikken, #nrknyheter",
							"MOSItemDurations" : "29,64",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "22 Sted/Arkiv (00:01=>00:05, Auto/Auto): Kristiansand juni 2017\r\nM: SMS-varsling\r\nSKOGBRANNER-100618S-DR23\r\n10 Tema (00:00=>00:05, Auto/OnNext): SMS ved kaotiske situasjoner i trafikken, #nrknyheter",
							"MOSSlugs" : "SMS-VARSLING;SMS-VARSLING-150618S-SL-16\r\nSTK SYNK 1;STK-10\r\nSMS-VARSLING;SMS-VARSLING-150618S-SL-2\r\nSMS-VARSLING;SMS-VARSLING-150618S-SL-17",
							"MOSTimes" : "20180803T121754Z\r\n\r\n\r\n20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "< legg klippet her >",
							"TextTime" : 0,
							"Bildebeskrivelse" : "",
							"Innslagstittel" : "SMS-varsling",
							"mosartType" : "STK",
							"ReadTime" : 0,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "16",
							"ObjectID" : "1f987e3c-2db3-4954-8b10-bd70b7c5f210",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SMS-VARSLING;SMS-VARSLING-150618S-SL-16",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "1f987e3c-2db3-4954-8b10-bd70b7c5f210",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"22_sted_arkiv"
											],
											"displayName" : "22 Sted/Arkiv (00:01=>00:05, Auto/Auto): Kristiansand juni 2017",
											"displayNameShort" : "22 Sted/Arkiv: Kristiansand juni 2017",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "22_sted_arkiv",
											"channel" : "gfx1",
											"layer" : "tagLeft",
											"system" : "html"
										},
										"content" : {
											"sted" : "",
											"arkiv" : "Kristiansand juni 2017"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 1000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "22 Sted/Arkiv (00:01=>00:05, Auto/Auto): Kristiansand juni 2017"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "N11859_1529074992",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "STK SYNK 1;STK-10",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2018-06-15T17:03:12 +02:00",
												"changedBy" : "N11859",
												"type" : "video",
												"mdSource" : "omnibus"
											},
											"title" : "SMS-varsling",
											"description" : "",
											"hbbtv" : {
												"link" : ""
											},
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: SMS-varsling (15-06-18 17:03)",
							"ObjectSlug" : "M: SMS-varsling"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "< legg klippet her",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\43\\12",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "SMS-VARSLING;SMS-VARSLING-150618S-SL-2",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "Skogsbrann i Sverige",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 1482,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "SKOGBRANNER-100618S-DR23 NYHETER 00:00:29:16",
							"ObjectSlug" : "SKOGBRANNER-100618S-DR23"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : ">",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "17",
							"ObjectID" : "8e4c6854-f36d-44af-88d1-d14d23e1551d",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SMS-VARSLING;SMS-VARSLING-150618S-SL-17",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "8e4c6854-f36d-44af-88d1-d14d23e1551d",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"10_tema"
											],
											"displayName" : "10 Tema (00:00=>00:05, Auto/OnNext): SMS ved kaotiske situasjoner i trafikken, #nrknyheter",
											"displayNameShort" : "10 Tema: SMS ved kaotiske situasjoner i trafikken, #nrknyheter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "10_tema",
											"channel" : "gfx1",
											"layer" : "tema",
											"system" : "html"
										},
										"content" : {
											"tematekst" : "SMS ved kaotiske situasjoner i trafikken",
											"infotekst" : "#nrknyheter"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"text" : 0,
										"timeIn" : 0,
										"duration" : 5000,
										"in" : "auto",
										"out" : "onNext"
									}
								}
							],
							"mosAbstract" : "10 Tema (00:00=>00:05, Auto/OnNext): SMS ved kaotiske situasjoner i trafikken, #nrknyheter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;1B1E5519-3C2D-49FA-A51EFA3DA687EB0C",
				"Slug" : "KOMMER 2055;Full",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 2,
							"MediaTime" : 34.32,
							"ModBy" : "N12050",
							"ModTime" : "20180702T111523Z",
							"MOSAbstracts" : "ANBUD-070618F-TR NYHETER 00:00:34:08 \r\n01 Ett navn (00:01=>00:05, Auto/Auto): Hans Hansen, allviter\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "34,32",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "ANBUD-070618F-TR\r\n01 Ett navn (00:01=>00:05, Auto/Auto): Hans Hansen, allviter\r\nStory status",
							"MOSSlugs" : "SMS-VARSLING;Full-2\r\nSMS-VARSLING;Full-4\r\nNYHETSSAK 1;SAK-16",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180713T192738247Z",
							"MOSTimes" : "20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"mosartType" : "FULL",
							"ReadTime" : 34.32,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\43\\03",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "SMS-VARSLING;Full-2",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "ANBUD-070618F-TR.",
										"objectType" : "CLIP",
										"clipType" : "NYHETER",
										"objDur" : 1716,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "ANBUD-070618F-TR NYHETER 00:00:34:08",
							"ObjectSlug" : "ANBUD-070618F-TR"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "4",
							"ObjectID" : "85bac65d-7ceb-4f3c-a974-3f2bd2a06503",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SMS-VARSLING;Full-4",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "85bac65d-7ceb-4f3c-a974-3f2bd2a06503",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:01=>00:05, Auto/Auto): Hans Hansen, allviter",
											"displayNameShort" : "01 Ett navn: Hans Hansen, allviter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Hans Hansen",
											"tittel" : "allviter"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 1000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:01=>00:05, Auto/Auto): Hans Hansen, allviter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "NYHETSSAK 1;SAK-16",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;89F9712B-B4D5-4D80-937BF7379C4700B7",
				"Slug" : "SEERBILDE;tekst",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 32,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121545Z",
							"MOSAbstracts" : "TIDSMARKØR IKKE RØR",
							"MOSObjSlugs" : "Story status",
							"MOSSlugs" : "SAK 4;intro --2",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180713T192740449Z",
							"MOSTimes" : 20171213175731804.0,
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Dagens bilde er sendt inn av Olga Olsen. Det viser en praktfull solnedgang over badende barn i Skippergada.",
							"TextTime" : 8,
							"mosartType" : "KAM",
							"mosartVariant" : 2,
							"ReadTime" : 8,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "Dagens bilde er sendt inn av Olga Olsen. Det viser en praktfull solnedgang over badende barn i Skippergada.",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "SAK 4;intro --2",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;475341D0-FFFA-4753-B9785A35A07268E3",
				"Slug" : "SEERBILDE;SEERBILDE",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"Estimated" : 15,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121614Z",
							"MOSAbstracts" : "M: Seerbilde (16-06-16 17:20)",
							"MOSObjSlugs" : "M: Seerbilde",
							"MOSSlugs" : "Uten tittel",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"Bildebeskrivelse" : "",
							"Innslagstittel" : "Seerbilde",
							"mosartType" : "GRAFIKK",
							"ReadTime" : 0,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "N12050_1466090430",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2016-06-16T17:20:29 +02:00",
												"changedBy" : "N12050",
												"type" : "video",
												"mdSource" : "ncs"
											},
											"title" : "Seerbilde",
											"description" : "",
											"hbbtv" : {
												"link" : ""
											},
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Seerbilde (16-06-16 17:20)",
							"ObjectSlug" : "M: Seerbilde"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "94",
							"ObjectID" : "85bac65d-7ceb-4f3c-a974-3f2bd2a06503",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "SMS-VARSLING;Full-24",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "85bac65d-7ceb-4f3c-a974-3f2bd2a06503",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:01=>00:05, Auto/Auto): Hans Hansen, allviter",
											"displayNameShort" : "01 Ett navn: Hans Hansen, allviter",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "202_bilde",
											"channel" : "gfx2",
											"layer" : "fullskjerm",
											"system" : "html"
										},
										"content" : ""
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 1000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:01=>00:05, Auto/Auto): Hans Hansen, allviter"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<Hvor ble det av sommeren? Foto Ann-Karin Gjertsen-Davidsen, Raet nasjonalpark>",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;DC3F3045-94EC-4699-87B55DE1FF4E66F5",
				"Slug" : "Nettpromo;Tekst",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 3,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 11,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121704Z",
							"MOSAbstracts" : "TIDSMARKØR IKKE RØR",
							"MOSObjSlugs" : "Story status",
							"MOSSlugs" : "ÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180713T192813046Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "I dag kan vi lese om Trimp på våre nettsider, mer leser du på nrk.no/sorland",
							"TextTime" : 5,
							"mosartType" : "KAM",
							"mosartVariant" : 1,
							"ReadTime" : 5,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "I dag kan vi lese om Trimp på våre nettsider, mer leser du på nrk.no/sorland",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;D4EC0230-B9D2-4985-878572A6C4C467A9",
				"Slug" : "Nettpromo;Grafikk",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 64,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121715Z",
							"MOSAbstracts" : "M: Nettet nå (03-05-18 10:11)",
							"MOSObjSlugs" : "M: Nettet nå",
							"MOSSlugs" : "Uten tittel",
							"MOSStoryStatus" : "STOP",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180615T124858262Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"TextTime" : 0,
							"Bildebeskrivelse" : "",
							"Innslagstittel" : "Nettet nå",
							"mosartType" : "GRAFIKK",
							"ReadTime" : 0,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "N12050_1525335104",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2018-05-03T10:11:44 +02:00",
												"changedBy" : "N12050",
												"type" : "video",
												"mdSource" : "ncs"
											},
											"title" : "Nettet nå",
											"description" : "",
											"hbbtv" : {
												"link" : ""
											},
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Nettet nå (03-05-18 10:11)",
							"ObjectSlug" : "M: Nettet nå"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;FA11F662-4A45-4F90-A95D09B74EB047D9",
				"Slug" : "Vær;Intro",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"Actual" : 4,
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 4,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180614T135536Z",
							"MOSAbstracts" : "TIDSMARKØR IKKE RØR",
							"MOSObjSlugs" : "Story status",
							"MOSSlugs" : "ÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180713T192825034Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "Nå skal vi se hva slags vær vi får de neste tre dagene",
							"TextTime" : 4,
							"mosartType" : "KAM",
							"mosartVariant" : 1,
							"ReadTime" : 4,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "Nå skal vi se hva slags vær vi får de neste tre dagene",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;F2D0440C-7E2E-48A5-B9D6FC338FD76E1F",
				"Slug" : "Vær;Vær",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 5,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180702T121856Z",
							"MOSAbstracts" : "M: Været (03-05-18 10:12)\r\n dk-været-to-1955-220318 SLETT_VSERV_Y_TIMER 00:10:00:00 \r\n01 Ett navn (00:02=>00:05, Auto/Auto): Bente Wahl, statsmeteorolog, Meteorologisk institutt\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : 600,
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "M: Været\r\ndk-været-to-1955-220318\r\n01 Ett navn (00:02=>00:05, Auto/Auto): Bente Wahl, statsmeteorolog, Meteorologisk institutt\r\nStory status",
							"MOSSlugs" : "Uten tittel\r\nVær;Vær-3\r\nVær;Vær-5\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180713T192829910Z",
							"MOSTimes" : "20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "<\r\n>",
							"TextTime" : 0,
							"Bildebeskrivelse" : "",
							"Innslagstittel" : "Været",
							"mosartType" : "STK",
							"ReadTime" : 0,
							"Rettigheter" : "Grønt",
							"Rettighetseier" : "NRK",
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "N12050_1525335158",
							"MOSID" : "METADATA.NRK.MOS",
							"Slug" : "Uten tittel",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://mosA4.com/mos/supported_schemas/MOSAXML2.08",
									"MosPayload" : {
										"nrk" : {
											"attributes" : {
												"changetime" : "2018-05-03T10:12:37 +02:00",
												"changedBy" : "N12050",
												"type" : "video",
												"mdSource" : "ncs"
											},
											"title" : "Været",
											"description" : "",
											"hbbtv" : {
												"link" : ""
											},
											"rights" : {
												"text" : "Green",
												"notes" : "",
												"owner" : "NRK"
											}
										}
									}
								}
							],
							"mosAbstract" : "M: Været (03-05-18 10:12)",
							"ObjectSlug" : "M: Været"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : "<",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "3",
							"ObjectID" : "\\\\XPRO\\Omn\\A\\A\\38\\60",
							"MOSID" : "OMNIBUS.XPRO.MOS",
							"Slug" : "Vær;Vær-3",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "OMNIBUS",
									"MosPayload" : {
										"title" : "dk-været-to-1955-220318",
										"objectType" : "CLIP",
										"clipType" : "SLETT_VSERV_Y_TIMER",
										"objDur" : 30000,
										"objType" : "VIDEO"
									}
								}
							],
							"mosAbstract" : "dk-været-to-1955-220318 SLETT_VSERV_Y_TIMER 00:10:00:00",
							"ObjectSlug" : "dk-været-to-1955-220318"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"text" : ">",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "5",
							"ObjectID" : "85bac65d-7ceb-4f3c-a974-3f2bd2a06503",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "Vær;Vær-5",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "85bac65d-7ceb-4f3c-a974-3f2bd2a06503",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"01_navn"
											],
											"displayName" : "01 Ett navn (00:02=>00:05, Auto/Auto): Bente Wahl, statsmeteorolog, Meteorologisk institutt",
											"displayNameShort" : "01 Ett navn: Bente Wahl, statsmeteorolog, Meteorologisk institutt",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "01_navn",
											"channel" : "gfx1",
											"layer" : "super",
											"system" : "html"
										},
										"content" : {
											"navn" : "Bente Wahl",
											"tittel" : "statsmeteorolog, Meteorologisk institutt"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 2000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "auto"
									}
								}
							],
							"mosAbstract" : "01 Ett navn (00:02=>00:05, Auto/Auto): Bente Wahl, statsmeteorolog, Meteorologisk institutt"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "4",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;5C596E40-F75B-463F-A770E8735C60D104",
				"Slug" : "Takk for nå;tekst-takk for nå",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ModBy" : "N12050",
							"ModTime" : "20180702T084907Z",
							"Owner" : "N12050",
							"mosartType" : "KAM",
							"mosartVariant" : 2,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
				]
			}
		)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token,
			{
				"ID" : "MAENPSTEST14;P_SERVER14\\W\\R_35F60587-876E-4CF1-AE0946FA90C55446;43542D61-DC75-48A1-9B218CFD6E769C7A",
				"Slug" : "Sluttvignett;Credits",
				"MosExternalMetaData" : [
					{
						"MosScope" : "PLAYLIST",
						"MosSchema" : "http://MAENPSTEST14:10505/schema/enps.dtd",
						"MosPayload" : {
							"text" : 0,
							"Approved" : 0,
							"Creator" : "N12050",
							"ElapsedTime" : 0,
							"MediaTime" : 0,
							"ModBy" : "N12050",
							"ModTime" : "20180627T122101Z",
							"MOSAbstracts" : "68 Sluttkred (00:01=>00:05, Auto/OnNext): Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no\r\nTIDSMARKØR IKKE RØR",
							"MOSItemDurations" : "",
							"MOSItemEdDurations" : "",
							"MOSObjSlugs" : "68 Sluttkred (00:01=>00:05, Auto/OnNext): Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no\r\nStory status",
							"MOSSlugs" : "Sluttvignett;Credits-4\r\nÅPNING;HEAD-1-17",
							"MOSStoryStatus" : "PLAY",
							"MOSStoryStatusMOS" : "SOFIE1.XPRO.MOS",
							"MOSStoryStatusTime" : "20180713T192835317Z",
							"MOSTimes" : "20180803T121754Z",
							"Owner" : "N12050",
							"SourceMediaTime" : 0,
							"SourceTextTime" : 0,
							"StoryLogPreview" : "det var alt vi hadde for i dag, sees i morgen",
							"TextTime" : 3,
							"mosartType" : "KAM",
							"mosartVariant" : "3SLUTT",
							"ReadTime" : 3,
							"ENPSItemType" : 3
						}
					}
				],
				"RunningOrderId" : "MAENPSTEST14;P_SERVER14\\W;35F60587-876E-4CF1-AE0946FA90C55446",
				"Body" : [
					{
						"Type" : "p",
						"Content" : {
							"text" : "det var alt vi hadde for i dag, sees i morgen",
							"@name" : "p",
							"@type" : "text"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "4",
							"ObjectID" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
							"MOSID" : "GFX.NRK.MOS",
							"Slug" : "Sluttvignett;Credits-4",
							"MosExternalMetaData" : [
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/content",
									"MosPayload" : {
										"uuid" : "26cc0b6d-ac21-4146-b4a3-275fe4098b24",
										"metadata" : {
											"modul" : "nora.browser",
											"selection" : [
												"http://nora.render.nyheter.mesosint.nrk.no",
												"super",
												"68_sluttkred_kort"
											],
											"displayName" : "68 Sluttkred (00:01=>00:05, Auto/OnNext): Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no",
											"displayNameShort" : "68 Sluttkred: Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no",
											"type" : "super"
										},
										"render" : {
											"group" : ""
										},
										"template" : {
											"name" : "68_sluttkred_kort",
											"channel" : "gfx1",
											"layer" : "fullskjerm",
											"system" : "html"
										},
										"content" : {
											"funksjon1" : "Regi:",
											"navn1" : "Ole Olsen",
											"funksjon2" : "Vaktsjef:",
											"navn2" : "Hans Hansen",
											"funksjon3" : "Redaktør:",
											"navn3" : "Per persen",
											"nettadresse" : "test.nrk.no",
											"navn" : "Per Persen",
											"tittel" : "baker",
											"sted" : "Snåsa"
										}
									}
								},
								{
									"MosScope" : "PLAYLIST",
									"MosSchema" : "http://nora.core.mesosint.nrk.no/mos/timing",
									"MosPayload" : {
										"timeIn" : 1000,
										"duration" : 5000,
										"in" : "auto",
										"out" : "onNext"
									}
								}
							],
							"mosAbstract" : "68 Sluttkred (00:01=>00:05, Auto/OnNext): Regi:, Ole Olsen | Vaktsjef:, Hans Hansen | Redaktør:, Per persen | test.nrk.no"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					},
					{
						"Type" : "storyItem",
						"Content" : {
							"ID" : "2",
							"ObjectID" : "STORYSTATUS",
							"MOSID" : "mosart.morten.mos",
							"Slug" : "ÅPNING;HEAD-1-17",
							"ObjectSlug" : "Story status"
						}
					},
					{
						"Type" : "p",
						"Content" : {
							"@name" : "p",
							"@type" : "element"
						}
					}
				]
			}
		)
	},
	'debug_roSetStarttimeSoon' () {
		let pd = getPD()

		let ro = RunningOrders.findOne({
			active: true
		})
		if (ro) {
			RunningOrders.update(ro._id, {$set: {
				expectedStart: getCurrentTime() + 70 * 1000
			}})
		}

	},

})

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Note: The data below is copied straight from the test data in mos-connection
let xmlApiData = {
	'roCreate':  literal<IMOSRunningOrder>({
		ID: new MosString128('96857485'),
		Slug: new MosString128('5PM RUNDOWN'),
		// DefaultChannel?: MosString128,
		EditorialStart: new MosTime('2009-04-17T17:02:00'),
		EditorialDuration: new MosDuration('00:58:25'), // @todo: change this into a real Duration
		// Trigger?: any // TODO: Johan frågar vad denna gör,
		// MacroIn?: MosString128,
		// MacroOut?: MosString128,
		// MosExternalMetaData?: Array<IMOSExternalMetaData>,
		Stories: [
			literal<IMOSROStory>({
				ID: new MosString128('5983A501:0049B924:8390EF2B'),
				Slug: new MosString128('COLSTAT MURDER'),
				Number: new MosString128('A5'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<IMOSItem>({
						ID: new MosString128('0'),
						Slug: new MosString128('OLSTAT MURDER:VO'),
						ObjectID: new MosString128('M000224'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						Paths: [
							literal<IMOSObjectPath>({Type: IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'}),
							literal<IMOSObjectPath>({Type: IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'}),
							literal<IMOSObjectPath>({Type: IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'})
						],
						// Channel?: new MosString128(),
						// EditorialStart?: MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MosString128(),
						// MacroOut?: new MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			}),
			literal<IMOSROStory>({
				ID: new MosString128('3854737F:0003A34D:983A0B28'),
				Slug: new MosString128('AIRLINE INSPECTIONS'),
				Number: new MosString128('A6'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<IMOSItem>({
						ID: new MosString128('0'),
						// Slug: new MosString128(''),
						ObjectID: new MosString128('M000133'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						// Channel?: new MosString128(),
						EditorialStart: 55,
						EditorialDuration: 310,
						UserTimingDuration: 200
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MosString128(),
						// MacroOut?: new MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			})
		]
	}),
	'roReplace':  literal<IMOSRunningOrder>({
		ID: new MosString128('96857485'),
		Slug: new MosString128('5PM RUNDOWN'),
		// DefaultChannel?: MosString128,
		// EditorialStart: new MosTime('2009-04-17T17:02:00'),
		// EditorialDuration: '00:58:25', // @todo: change this into a real Duration
		// Trigger?: any // TODO: Johan frågar vad denna gör,
		// MacroIn?: MosString128,
		// MacroOut?: MosString128,
		// MosExternalMetaData?: Array<IMOSExternalMetaData>,
		Stories: [
			literal<IMOSROStory>({
				ID: new MosString128('5983A501:0049B924:8390EF2B'),
				Slug: new MosString128('COLSTAT MURDER'),
				Number: new MosString128('A1'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<IMOSItem>({
						ID: new MosString128('0'),
						Slug: new MosString128('OLSTAT MURDER:VO'),
						ObjectID: new MosString128('M000224'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						Paths: [
							literal<IMOSObjectPath>({Type: IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'}),
							literal<IMOSObjectPath>({Type: IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'}),
							literal<IMOSObjectPath>({Type: IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'})
						],
						// Channel?: new MosString128(),
						// EditorialStart?: MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MosString128(),
						// MacroOut?: new MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			}),
			literal<IMOSROStory>({
				ID: new MosString128('3852737F:0013A64D:923A0B28'),
				Slug: new MosString128('AIRLINE SAFETY'),
				Number: new MosString128('A2'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<IMOSItem>({
						ID: new MosString128('0'),
						// Slug: new MosString128(''),
						ObjectID: new MosString128('M000295'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						// Channel?: new MosString128(),
						EditorialStart: 500,
						EditorialDuration: 600,
						UserTimingDuration: 310
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MosString128(),
						// MacroOut?: new MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			})
		]
	}),
	'roDelete':  49478285,
	'roList':  literal<IMOSObject>({
		ID: new MosString128('M000123'),
		Slug: new MosString128('Hotel Fire'),
		// MosAbstract: string,
		Group: 'Show 7',
		Type: IMOSObjectType.VIDEO,
		TimeBase: 59.94,
		Revision: 1,
		Duration: 1800,
		Status: IMOSObjectStatus.NEW,
		AirStatus: IMOSObjectAirStatus.READY,
		Paths: [
			{Type: IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
			{Type: IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
			{Type: IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
		],
		CreatedBy: new MosString128('Chris'),
		Created: new MosTime('2009-10-31T23:39:12'),
		ChangedBy: new MosString128('Chris'),
		Changed: new MosTime('2009-10-31T23:39:12')
		// Description: string
		// mosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	'roMetadataReplace':  literal<IMOSRunningOrderBase>({
		ID: new MosString128('96857485'),
		Slug: new MosString128('5PM RUNDOWN'),
		// DefaultChannel?: new MosString128(''),
		EditorialStart: new MosTime('2009-04-17T17:02:00'),
		EditorialDuration: new MosDuration('00:58:25')
		// Trigger?: any // TODO: Johan frågar vad denna gör
		// MacroIn?: new MosString128(''),
		// MacroOut?: new MosString128(''),
		// MosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	'roElementStat_ro':  literal<IMOSRunningOrderStatus>({
		ID: new MosString128('5PM'),
		Status: IMOSObjectStatus.MANUAL_CTRL,
		Time: new MosTime('2009-04-11T14:13:53')
	}),
	'roElementStat_story':  literal<IMOSStoryStatus>({
		RunningOrderId: new MosString128('5PM'),
		ID: new MosString128('HOTEL FIRE'),
		Status: IMOSObjectStatus.PLAY,
		Time: new MosTime('1999-04-11T14:13:53')
	}),
	'roElementStat_item':  literal<IMOSItemStatus>({
		RunningOrderId: new MosString128('5PM'),
		StoryId: new MosString128('HOTEL FIRE '),
		ID: new MosString128('0'),
		ObjectId: new MosString128('A0295'),
		Channel: new MosString128('B'),
		Status: IMOSObjectStatus.PLAY,
		Time: new MosTime('2009-04-11T14:13:53')
	}),
	'roReadyToAir':  literal<IMOSROReadyToAir>({
		ID: new MosString128('5PM'),
		Status: IMOSObjectAirStatus.READY
	}),
	'roElementAction_insert_story_Action':  literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_insert_story_Stories':  [
		literal<IMOSROStory>({
			ID: new MosString128('17'),
			Slug: new MosString128('Barcelona Football'),
			Number: new MosString128('A2'),
			// MosExternalMetaData?: Array<IMOSExternalMetaData>,
			Items: [
				literal<IMOSItem>({
					ID: new MosString128('27'),
					// Slug?: new MosString128(''),
					ObjectID: new MosString128('M73627'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					Paths: [
						{Type: IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
						{Type: IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
						{Type: IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415
				}),
				literal<IMOSItem>({
					ID: new MosString128('28'),
					ObjectID: new MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315
				})
			]
		})
	],
	'roElementAction_insert_item_Action':  literal<IMOSItemAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2'),
		ItemID: new MosString128('23')
	}),
	'roElementAction_insert_item_Items':  [
		literal<IMOSItem>({
			ID: new MosString128('27'),
			Slug: new MosString128('NHL PKG'),
			ObjectID: new MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{Type: IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
				{Type: IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
				{Type: IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690
		})
	],
	'roElementAction_replace_story_Action':  literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_replace_story_Stories':  [
		literal<IMOSROStory>({
			ID: new MosString128('17'),
			Slug: new MosString128('Porto Football'),
			Number: new MosString128('A2'),
			// MosExternalMetaData?: Array<IMOSExternalMetaData>,
			Items: [
				literal<IMOSItem>({
					ID: new MosString128('27'),
					// Slug?: new MosString128(''),
					ObjectID: new MosString128('M73627'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					Paths: [
						{Type: IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
						{Type: IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
						{Type: IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415
				}),
				literal<IMOSItem>({
					ID: new MosString128('28'),
					ObjectID: new MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315
				})
			]
		})
	],
	'roElementAction_replace_item_Action':  literal<IMOSItemAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2'),
		ItemID: new MosString128('23')
	}),
	'roElementAction_replace_item_Items':  [
		literal<IMOSItem>({
			ID: new MosString128('27'),
			Slug: new MosString128('NHL PKG'),
			ObjectID: new MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{Type: IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
				{Type: IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
				{Type: IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690
		})
	],
	'roElementAction_move_story_Action':  literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_move_story_Stories':  [
		new MosString128('7')
	],
	'roElementAction_move_stories_Action':  literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_move_stories_Stories':  [
		new MosString128('7'),
		new MosString128('12')
	],
	'roElementAction_move_items_Action':  literal<IMOSItemAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2'),
		ItemID: new MosString128('12')
	}),
	'roElementAction_move_items_Items':  [
		new MosString128('23'),
		new MosString128('24')
	],
	'roElementAction_delete_story_Action':  literal<IMOSROAction>({
		RunningOrderID: new MosString128('5PM')
	}),
	'roElementAction_delete_story_Stories':  [
		new MosString128('3')
	],
	'roElementAction_delete_items_Action':  literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_delete_items_Items':  [
		new MosString128('23'),
		new MosString128('24')
	],
	'roElementAction_swap_stories_Action':  literal<IMOSROAction>({
		RunningOrderID: new MosString128('5PM')
	}),
	'roElementAction_swap_stories_StoryId0':  new MosString128('3'),
	'roElementAction_swap_stories_StoryId1':  new MosString128('5'),
	'roElementAction_swap_items_Action':  literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_swap_items_ItemId0':  new MosString128('23'),
	'roElementAction_swap_items_ItemId1':  new MosString128('24')
}

export { xmlApiData }
