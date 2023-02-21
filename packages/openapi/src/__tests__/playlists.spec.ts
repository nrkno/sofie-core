// eslint-disable-next-line node/no-missing-import
import { Configuration, PlaylistsApi } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false
const testServer = process.env.SERVER_TYPE === 'TEST'

describe('Network client', () => {
	if (testServer) {
		const config = new Configuration({
			basePath: process.env.ACTIONS_URL,
			middleware: httpLogging ? [new Logging()] : [],
		})

		beforeAll(async () => await checkServer(config))

		const playlistsApi = new PlaylistsApi(config)
		test('can activate a playlist', async () => {
			const active = await playlistsApi.activate({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				activateRequest: { rehearsal: true },
			})
			expect(active.success).toBe(200)
		})

		test('can set next part in a playlist', async () => {
			const setNext = await playlistsApi.setNextPart({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				setNextPartRequest: { partId: '9Qk3eNHtqwBRGxsGqQiVCxJsYwE_' },
			})
			expect(setNext.success).toBe(200)
		})

		test('can set next segment in a playlist', async () => {
			const setNext = await playlistsApi.setNextSegment({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				setNextSegmentRequest: { segmentId: 'cIt0kEWuHOvQVMDEKzCrBpgGWSs_' },
			})
			expect(setNext.success).toBe(200)
		})

		test('can move next part in a playlist', async () => {
			const move = await playlistsApi.moveNextPart({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				moveNextPartRequest: { delta: 2 },
			})
			expect(move.success).toBe(200)
			expect(move.result).toBe('3Y9at66pZipxE8Kkn850LLV9Cz0_')
		})

		test('can move next segment in a playlist', async () => {
			const move = await playlistsApi.moveNextSegment({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				moveNextSegmentRequest: { delta: 2 },
			})
			expect(move.success).toBe(200)
			expect(move.result).toBe('YjGd_1dWjta_E1ZuDaOczP1lsgk_')
		})

		test('can send take action to the Sofie application', async () => {
			const take = await playlistsApi.take({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(take.success).toBe(200)
		})

		test('can execute an adLib', async () => {
			const execute = await playlistsApi.executeAdLib({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				executeAdLibRequest: { adLibId: 'JustDoIt' },
			})
			expect(execute.success).toBe(200)
		})

		test('can deactivate a playlist', async () => {
			const deactive = await playlistsApi.deactivate({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(deactive.success).toBe(200)
		})

		test('can reset a playlist', async () => {
			const reset = await playlistsApi.resetPlaylist({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(reset.success).toBe(200)
		})

		test('can reload a playlist', async () => {
			const reload = await playlistsApi.reloadPlaylist({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(reload.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
