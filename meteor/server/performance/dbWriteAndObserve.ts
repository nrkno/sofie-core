import { createMongoCollection } from '../../lib/collections/lib'
import { ProtectedString, protectString } from '../../lib/lib'
import { TransformedCollection } from '../../lib/typings/meteor'
import { PerformanceTest } from './lib'

export function dbWriteAndObserve(): PerformanceTest {
	return {
		label: 'DB: Write & observe',
		description: 'Write to MongoDB and wait for observer to update',
		baseline: 200,
		testFunction: async () => {
			// Prepare test: ----------------------------------------------------------
			prepareDbTest()
			if (!cache) throw new Error('cache not set up!')

			const testData: {
				[key: string]: any
			} = {}
			for (let i = 0; i < 1000; i++) {
				const key = 'Key' + randomInt()
				testData[key] = {
					_id: key,
					prop0: 'randomValue_qwertyuiopasdfghjklzxcvbnm' + Math.random(),
					prop1: 'randomValue_qwertyuiopasdfghjklzxcvbnm' + Math.random(),
					prop2: 'randomValue_qwertyuiopasdfghjklzxcvbnm' + Math.random(),
					prop3: 'randomValue_qwertyuiopasdfghjklzxcvbnm' + Math.random(),
					prop4: 'randomValue_qwertyuiopasdfghjklzxcvbnm' + Math.random(),
				}
			}
			const keys = Object.keys(testData)

			let triggerPromise: Promise<void>
			let triggerPromiseResolve: () => void | undefined

			const obs = cache.collection.find().observe({
				added: () => triggerPromiseResolve?.(),
				changed: () => triggerPromiseResolve?.(),
			})

			const id = protectString('testId')
			// Start the test: --------------------------------------------------------
			const startTime = Date.now()

			for (let i = 0; i < 10; i++) {
				triggerPromise = new Promise((resolve) => {
					triggerPromiseResolve = resolve
				})

				// Make a tiny adjustment to the data:
				testData[keys[i]].prop0 += 1

				cache.collection.upsert(id, {
					$set: {
						_id: id,
						data: testData,
						i: i,
					},
				})

				// Wait for observer to trigger:
				await triggerPromise
			}

			const result = Date.now() - startTime

			// Clean up: --------------------------------------------------------------
			obs.stop()
			cache.collection.remove(id)

			return result
		},
	}
}

let cache: null | {
	collection: TransformedCollection<CollectionObject, CollectionObject>
} = null

interface CollectionObject {
	_id: ProtectedString<'CollectionObjectId'>
	data: any
}

function prepareDbTest() {
	if (!cache) {
		cache = {
			collection: createMongoCollection<CollectionObject, CollectionObject>('__performanceTest_dbTest'),
		}
	}
}
function randomInt() {
	return Math.floor(Math.random() * 1000000)
}
