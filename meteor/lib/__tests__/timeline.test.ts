import { testInFiber } from '../../__mocks__/helpers/jest';
import { transformTimeline } from '../timeline';
import { DeviceType } from 'timeline-state-resolver-types';
import { TimelineObjGeneric, TimelineObjType } from '../collections/Timeline';

describe('lib/timeline', () => {
	testInFiber('transformTimeline', () => {
		const timeline: TimelineObjGeneric[] = [
			{
				_id: '0',
				id: '0',
				studioId: 'studio0',
				objectType: TimelineObjType.RUNDOWN,
				enable: {
					start: 0
				},
				content: {
					deviceType: DeviceType.ABSTRACT
				},
				layer: 'L1'
			},
			{
				_id: 'child0',
				id: 'child0',
				studioId: 'studio0',
				objectType: TimelineObjType.RUNDOWN,
				enable: {
					start: 0
				},
				content: {
					deviceType: DeviceType.ABSTRACT
				},
				layer: 'L1',
				inGroup: 'group0'
			},
			{
				_id: 'child1',
				id: 'child1',
				studioId: 'studio0',
				objectType: TimelineObjType.RUNDOWN,
				enable: {
					start: 0
				},
				content: {
					deviceType: DeviceType.ABSTRACT
				},
				layer: 'L1',
				inGroup: 'group0'
			},
			{
				_id: 'group0',
				id: 'group0',
				studioId: 'studio0',
				objectType: TimelineObjType.RUNDOWN,
				enable: {
					start: 0
				},
				content: {
					deviceType: DeviceType.ABSTRACT
				},
				layer: 'L1',
				isGroup: true
			},
			{
				_id: '2',
				id: '2',
				studioId: 'studio0',
				objectType: TimelineObjType.RUNDOWN,
				enable: {
					start: 0
				},
				content: { deviceType: DeviceType.ABSTRACT },
				layer: 'L1',
				rundownId: 'myRundown0',
				// @ts-ignore
				partId: 'myPart0'
			},
			{
				_id: '3',
				id: '3',
				studioId: 'studio0',
				objectType: TimelineObjType.RUNDOWN,
				enable: {
					start: 0
				},
				// @ts-ignore .content missing
				// content: { deviceType: DeviceType.ABSTRACT },
				layer: 'L1',
				rundownId: 'myRundown0',
				// @ts-ignore
				pieceId: 'myPiece0'
			}
		];
		const transformedTimeline = transformTimeline(timeline);

		expect(transformedTimeline).toHaveLength(4);

		expect(transformedTimeline[0]).toMatchObject({
			id: '0'
		});
		expect(transformedTimeline[1]).toMatchObject({
			id: 'group0'
		});
		expect(transformedTimeline[1].children).toHaveLength(2);

		expect(transformedTimeline[2]).toMatchObject({
			id: '2',
			content: {
				callBack: 'partPlaybackStarted',
				callBackData: {
					rundownId: 'myRundown0',
					partId: 'myPart0'
				},
				callBackStopped: 'partPlaybackStopped'
			}
		});
		expect(transformedTimeline[3]).toMatchObject({
			id: '3',
			content: {
				callBack: 'piecePlaybackStarted',
				callBackData: {
					rundownId: 'myRundown0',
					pieceId: 'myPiece0'
				},
				callBackStopped: 'piecePlaybackStopped'
			}
		});
	});
	testInFiber('missing id', () => {
		expect(() => {
			transformTimeline([
				// @ts-ignore missing: id
				{
					_id: '0',
					studioId: 'studio0',
					objectType: TimelineObjType.RUNDOWN,
					enable: { start: 0 },
					content: { deviceType: DeviceType.ABSTRACT },
					layer: 'L1'
				}
			] as TimelineObjGeneric[]);
		}).toThrowError(/missing id/);
	});
});
