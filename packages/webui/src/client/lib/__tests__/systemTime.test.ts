import { getCurrentTime, systemTime } from '../systemTime'

test('getCurrentTime', () => {
	systemTime.diff = 5439
	expect(getCurrentTime() / 1000).toBeCloseTo((Date.now() - 5439) / 1000, 1)
})
