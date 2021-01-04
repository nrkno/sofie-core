import { TimeSync } from '../timeSync'

test('timeSync', async () => {
	// let time = 1000
	// Date.now = jest.fn(() => {
	// 	return time
	// })
	let serverDiff = -5000

	let getServerTime = jest.fn(async (): Promise<number> => {

		return new Promise<number>((resolve) => {

			// simulate delay to the server:
			setTimeout(() => {
				let serverTime = Date.now() + serverDiff // simulate that the server is 5 seconds ahead
				// simulate delay back from the server:
				setTimeout(() => {
					resolve(serverTime)
				}, 5)
			}, 5)
		})
	})

	let ts = new TimeSync({}, getServerTime)

	let syncPossible = await ts.init()

	expect(syncPossible).toEqual(true)
	expect(getServerTime).toHaveBeenCalledTimes(4)

	expect(ts.quality).toBeLessThanOrEqual(20)
	expect(Math.abs(-5000 - ts.diff)).toBeLessThan(10)
	expect(Math.abs(
		ts.currentTime() -
		(Date.now() + serverDiff))
	).toBeLessThan(5)

	ts.stop()
})
