// eslint-disable-next-line node/no-missing-import
import { Configuration, PlaylistsApi, ResponseError } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false
let testServer = false
if (process.env.SERVER_TYPE === 'TEST') {
	testServer = true
}

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const playlistsApi = new PlaylistsApi(config)
	const playlistIds: string[] = []
	test('can request all playlists available in Sofie', async () => {
		const playlists = await playlistsApi.playlists()
		expect(playlists.status).toBe(200)
		expect(playlists).toHaveProperty('result')
		expect(playlists.result.length).toBeGreaterThanOrEqual(1)
		playlists.result.forEach((playlist) => {
			expect(typeof playlist).toBe('object')
			expect(typeof playlist.id).toBe('string')
			playlistIds.push(playlist.id)
		})
	})

	if (!testServer) {
		class NoErrorThrownError extends Error {}
		const doActivateWithBadId = async () => {
			try {
				await playlistsApi.activate({
					playlistId: playlistIds[0] + 'err',
					activateRequest: { rehearsal: true },
				})
				return new NoErrorThrownError()
			} catch (error) {
				return error
			}
		}
		test('fails to activate a playlist with a bad id', async () => {
			const error = await doActivateWithBadId()
			expect(error).not.toBeInstanceOf(NoErrorThrownError)
			const resErr = await (error as ResponseError).response.json()
			expect(resErr).toHaveProperty('status')
			expect(resErr.status).toBe(404)
			expect(resErr).toHaveProperty('message')
			expect(typeof resErr.message).toBe('string')
		})
	}

	test('can activate a playlist', async () => {
		const active = await playlistsApi.activate({
			playlistId: playlistIds[0],
			activateRequest: { rehearsal: true },
		})
		expect(active.status).toBe(200)
	})

	let partId = ''
	test('can move next part in a playlist', async () => {
		const move = await playlistsApi.moveNextPart({
			playlistId: playlistIds[0],
			moveNextPartRequest: { delta: 2 },
		})
		expect(move.status).toBe(200)
		expect(typeof move.result).toBe('string')
		partId = move.result
	})

	test('can reset a playlist', async () => {
		const reset = await playlistsApi.resetPlaylist({ playlistId: playlistIds[0] })
		expect(reset.status).toBe(200)
	})

	test('can set next part in a playlist', async () => {
		const setNext = await playlistsApi.setNextPart({
			playlistId: playlistIds[0],
			setNextPartRequest: { partId: partId },
		})
		expect(setNext.status).toBe(200)
	})

	test('can move next segment in a playlist', async () => {
		await playlistsApi.resetPlaylist({ playlistId: playlistIds[0] })
		const move = await playlistsApi.moveNextSegment({
			playlistId: playlistIds[0],
			moveNextSegmentRequest: { delta: 2 },
		})
		expect(move.status).toBe(200)
		expect(typeof move.result).toBe('string')
	})

	if (testServer) {
		test('can set next segment in a playlist', async () => {
			await playlistsApi.resetPlaylist({ playlistId: playlistIds[0] })
			const setNext = await playlistsApi.setNextSegment({
				playlistId: playlistIds[0],
				setNextSegmentRequest: { segmentId: 'cIt0kEWuHOvQVMDEKzCrBpgGWSs_' },
			})
			expect(setNext.status).toBe(200)
		})
	} else {
		test.todo('set next segment in a playlist - need to read a segmentId')
	}

	test('can send take action to the Sofie application', async () => {
		const take = await playlistsApi.take({ playlistId: playlistIds[0] })
		expect(take.status).toBe(200)
	})

	if (testServer) {
		test('can execute an adLib', async () => {
			const execute = await playlistsApi.executeAdLib({
				playlistId: playlistIds[0],
				executeAdLibRequest: { adLibId: 'JustDoIt' },
			})
			expect(execute.status).toBe(200)
		})
	} else {
		test.todo('execute adlib - need to have an adlib to run')
	}

	test('can deactivate a playlist', async () => {
		const deactive = await playlistsApi.deactivate({ playlistId: playlistIds[0] })
		expect(deactive.status).toBe(200)
	})

	if (testServer) {
		test('can reload a playlist', async () => {
			const reload = await playlistsApi.reloadPlaylist({ playlistId: playlistIds[0] })
			expect(reload.status).toBe(200)
		})
	} else {
		test.todo('Reload playlist can be dependant on test order')
	}
})
