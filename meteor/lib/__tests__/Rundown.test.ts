import { testInFiber } from '../../__mocks__/helpers/jest';
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundown
} from '../../__mocks__/helpers/database';
import { getResolvedSegment } from '../Rundown';
import { Rundowns } from '../collections/Rundowns';

describe('lib/Rundown', () => {
	let env: DefaultEnvironment;
	let rundownId: string;
	beforeAll(() => {
		env = setupDefaultStudioEnvironment();
		rundownId = setupDefaultRundown(env);
	});
	testInFiber('getResolvedSegment', () => {
		const showStyleBase = env.showStyleBase;
		const rundown = Rundowns.findOne(rundownId);
		if (!rundown) throw new Error('Rundown not found');

		const segments = rundown.getSegments();
		const segment = segments[0];
		const nextSegment = segments[1];

		const resolvedSegment = getResolvedSegment(showStyleBase, rundown, segment, true);
		expect(resolvedSegment).toBeTruthy();
		expect(resolvedSegment.parts).toHaveLength(2);
		expect(resolvedSegment).toMatchObject({
			// segmentExtended: SegmentExtended,
			// parts: Array<PartExtended>,
			isLiveSegment: false,
			isNextSegment: false,
			currentLivePart: undefined,
			hasRemoteItems: false,
			hasGuestItems: false,
			hasAlreadyPlayed: false,
			autoNextPart: false,
			followingPart: nextSegment.getParts()[0]
		});
		expect(resolvedSegment).toMatchSnapshot();
	});
});
