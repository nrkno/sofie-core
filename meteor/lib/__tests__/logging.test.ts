import { testInFiber } from '../../__mocks__/helpers/jest';
import { transformTimeline } from '../timeline';
import { DeviceType } from 'timeline-state-resolver-types';
import { TimelineObjGeneric, TimelineObjType } from '../collections/Timeline';
import { logger } from '../logging';

describe('lib/logger', () => {
	testInFiber('logger', () => {
		expect(typeof logger.error).toEqual('function');
		expect(typeof logger.warn).toEqual('function');
		expect(typeof logger.help).toEqual('function');
		expect(typeof logger.info).toEqual('function');
		expect(typeof logger.debug).toEqual('function');
	});
});
