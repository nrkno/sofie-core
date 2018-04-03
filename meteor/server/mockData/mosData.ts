import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
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
	IMOSObjectPathType,
	IMOSObjectPath,
	MosDuration,
	IMOSObjectStatus,
	IMOSObjectAirStatus,
	IMOSObject,
	IMOSObjectType
} from 'mos-connection'

import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { getCurrentTime, saveIntoDb, literal, DBObj, partialExceptId } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Segment, Segments } from '../../lib/collections/Segments'
import { ServerPeripheralDeviceAPI } from '../api/peripheralDevice'

// These are temporary methods, used during development to put some data into the database

Meteor.methods({
	'debug_roCreate' () {
		ServerPeripheralDeviceAPI.mosRoCreate(xmlApiData.roCreate)
	},
	'debug_roReplace' () {
		ServerPeripheralDeviceAPI.mosRoReplace(xmlApiData.roReplace)
	},
	'debug_roDelete' () {
		ServerPeripheralDeviceAPI.mosRoDelete(new MosString128('' + xmlApiData.roDelete))
	}
})

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Note: The data below is copied straight from the test data in mos-connection
let xmlApiData = {
	'roCreate': literal<IMOSRunningOrder>({
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
	'roReplace': literal<IMOSRunningOrder>({
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
	'roDelete': 49478285,
	'roList': literal<IMOSObject>({
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
	'roMetadataReplace': literal<IMOSRunningOrderBase>({
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
	'roElementStat_ro': literal<IMOSRunningOrderStatus>({
		ID: new MosString128('5PM'),
		Status: IMOSObjectStatus.MANUAL_CTRL,
		Time: new MosTime('2009-04-11T14:13:53')
	}),
	'roElementStat_story': literal<IMOSStoryStatus>({
		RunningOrderId: new MosString128('5PM'),
		ID: new MosString128('HOTEL FIRE'),
		Status: IMOSObjectStatus.PLAY,
		Time: new MosTime('1999-04-11T14:13:53')
	}),
	'roElementStat_item': literal<IMOSItemStatus>({
		RunningOrderId: new MosString128('5PM'),
		StoryId: new MosString128('HOTEL FIRE '),
		ID: new MosString128('0'),
		ObjectId: new MosString128('A0295'),
		Channel: new MosString128('B'),
		Status: IMOSObjectStatus.PLAY,
		Time: new MosTime('2009-04-11T14:13:53')
	}),
	'roReadyToAir': literal<IMOSROReadyToAir>({
		ID: new MosString128('5PM'),
		Status: IMOSObjectAirStatus.READY
	}),
	'roElementAction_insert_story_Action': literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_insert_story_Stories': [
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
	'roElementAction_insert_item_Action': literal<IMOSItemAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2'),
		ItemID: new MosString128('23')
	}),
	'roElementAction_insert_item_Items': [
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
	'roElementAction_replace_story_Action': literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_replace_story_Stories': [
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
	'roElementAction_replace_item_Action': literal<IMOSItemAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2'),
		ItemID: new MosString128('23')
	}),
	'roElementAction_replace_item_Items': [
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
	'roElementAction_move_story_Action': literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_move_story_Stories': [
		new MosString128('7')
	],
	'roElementAction_move_stories_Action': literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_move_stories_Stories': [
		new MosString128('7'),
		new MosString128('12')
	],
	'roElementAction_move_items_Action': literal<IMOSItemAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2'),
		ItemID: new MosString128('12')
	}),
	'roElementAction_move_items_Items': [
		new MosString128('23'),
		new MosString128('24')
	],
	'roElementAction_delete_story_Action': literal<IMOSROAction>({
		RunningOrderID: new MosString128('5PM')
	}),
	'roElementAction_delete_story_Stories': [
		new MosString128('3')
	],
	'roElementAction_delete_items_Action': literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_delete_items_Items': [
		new MosString128('23'),
		new MosString128('24')
	],
	'roElementAction_swap_stories_Action': literal<IMOSROAction>({
		RunningOrderID: new MosString128('5PM')
	}),
	'roElementAction_swap_stories_StoryId0': new MosString128('3'),
	'roElementAction_swap_stories_StoryId1': new MosString128('5'),
	'roElementAction_swap_items_Action': literal<IMOSStoryAction>({
		RunningOrderID: new MosString128('5PM'),
		StoryID: new MosString128('2')
	}),
	'roElementAction_swap_items_ItemId0': new MosString128('23'),
	'roElementAction_swap_items_ItemId1': new MosString128('24')
}

export { xmlApiData }
