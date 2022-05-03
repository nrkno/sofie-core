import {
	ExternalMessageQueueObjRabbitMQ,
	IBlueprintExternalMessageQueueType,
	Time,
} from '@sofie-automation/blueprints-integration'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { IDirectCollections } from '../db'
import { getCurrentTime } from '../lib'
import { sendRabbitMQMessage } from './integration/rabbitMQ'
import { stringify } from 'querystring'
import { clone, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { sendSlackMessageToWebhook } from './integration/slack'
import { StudioCacheContext } from '../jobs'
import {
	InvalidateWorkerDataCache,
	invalidateWorkerDataCache,
	loadWorkerDataCache,
	WorkerDataCache,
} from '../workers/caches'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { StudioCacheContextImpl } from '../workers/context'
import { ReadonlyDeep } from 'type-fest'
import deepmerge = require('deepmerge')
import { ChangeStream, Db as MongoDb } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import pTimeout = require('p-timeout')
import { logger } from '../logging'

const TRIGGER_DELAY_DEFAULT = 1000 // TODO: Now that this is in its own thread, does it need a delay?
const TRIGGER_DELAY_STARTUP = 5000
const SEND_MESSAGE_TIMEOUT = 10000

interface TimeoutWithTime {
	timeout: NodeJS.Timeout
	target: Time
}

export class ExternalMessageQueueRunner {
	readonly #mongoDatabase: MongoDb
	readonly #collections: IDirectCollections
	#changesStream: ChangeStream<any> | undefined

	// Maintain our own dataCache, as we run on our own timer and need to control when to clear it
	readonly #dataCache: WorkerDataCache
	#pendingCacheInvalidations: InvalidateWorkerDataCache | undefined

	#triggerTimeout: TimeoutWithTime | null = null
	#lastRunHadError = false

	#destroyed = false
	#running = false

	private constructor(mongoDatabase: MongoDb, collections: IDirectCollections, dataCache: WorkerDataCache) {
		this.#mongoDatabase = mongoDatabase
		this.#collections = collections
		this.#dataCache = dataCache

		this.triggerDoMessageQueue(TRIGGER_DELAY_STARTUP)
	}

	static async create(
		mongoDatabase: MongoDb,
		collections: IDirectCollections,
		studioId: StudioId
	): Promise<ExternalMessageQueueRunner> {
		const dataCache = await loadWorkerDataCache(collections, studioId)

		const runner = new ExternalMessageQueueRunner(mongoDatabase, collections, dataCache)

		await runner.startListeningForEvents()

		return runner
	}

	invalidateCaches(data: ReadonlyDeep<InvalidateWorkerDataCache>): void {
		// Store the invalidation for later
		if (!this.#pendingCacheInvalidations) {
			this.#pendingCacheInvalidations = clone<InvalidateWorkerDataCache>(data)
		} else {
			this.#pendingCacheInvalidations = deepmerge<InvalidateWorkerDataCache>(
				this.#pendingCacheInvalidations,
				data as InvalidateWorkerDataCache
			)
		}
	}

	private tryRestartListeningForEvents(): void {
		if (!this.#destroyed && (!this.#changesStream || this.#changesStream.closed)) {
			// Try and restart the stream
			this.startListeningForEvents().catch((e) => {
				logger.error(`Failed to restart changes stream: ${stringifyError(e)}`)

				// Try again in a few seconds
				setTimeout(() => {
					this.tryRestartListeningForEvents()
				}, 5000)
			})
		}
	}

	private async startListeningForEvents(): Promise<void> {
		if (this.#changesStream) {
			try {
				await this.#changesStream.close()
			} catch (e) {
				logger.warn(`Failed to stop changes stream: ${e}`)
			}
		}

		const stream = (this.#changesStream = this.#mongoDatabase
			.collection(CollectionName.ExternalMessageQueue)
			.watch([{ $match: { [`fullDocument.studioId`]: this.#dataCache.studio._id } }], {
				batchSize: 1,
			}))

		stream.on('error', () => {
			logger.warn(`Changes stream for ExternalMessageQueue errored`)
			this.#changesStream = undefined

			this.tryRestartListeningForEvents()
		})
		stream.on('change', (_change) => {
			// we have a change to flag
			this.triggerDoMessageQueue(5000) // TODO - why this long?
		})
		stream.on('end', () => {
			logger.warn(`Changes stream for ExternalMessageQueue ended`)
			this.#changesStream = undefined

			this.tryRestartListeningForEvents()
		})
	}

	async destroy(): Promise<void> {
		this.#destroyed = true

		if (this.#changesStream) {
			try {
				await this.#changesStream.close()
			} catch (e) {
				logger.warn(`Failed to stop changes stream: ${e}`)
			}
		}

		if (this.#triggerTimeout) {
			clearTimeout(this.#triggerTimeout.timeout)
			this.#triggerTimeout = null
		}

		// TODO - wait for current run to complete?
	}

	triggerDoMessageQueue(delay?: number): void {
		if (this.#destroyed) return

		if (!delay) delay = TRIGGER_DELAY_DEFAULT
		const targetTime = Date.now() + delay

		// If there is already a timeout, check if it needs recreating
		if (this.#triggerTimeout && this.#triggerTimeout.target > targetTime) {
			clearTimeout(this.#triggerTimeout.timeout)
			this.#triggerTimeout = null
		}

		// If there isnt a pending timeout, schedule it
		if (!this.#triggerTimeout) {
			this.#triggerTimeout = {
				target: targetTime,
				timeout: setTimeout(() => {
					this.#triggerTimeout = null

					this.#doMessageQueue().catch((e) => {
						logger.error(stringify(e))
					})
				}, delay),
			}
		}
	}

	async #doMessageQueue(): Promise<void> {
		if (this.#destroyed) return
		if (this.#running) {
			// Already running, delay next attempt
			// TODO - should we do more granular run tracking?
			this.triggerDoMessageQueue()
			return
		}

		this.#running = true

		try {
			// handle any cache invalidations
			if (this.#pendingCacheInvalidations) {
				const invalidations = this.#pendingCacheInvalidations
				this.#pendingCacheInvalidations = undefined
				await invalidateWorkerDataCache(this.#collections, this.#dataCache, invalidations)
			}

			try {
				const tryInterval = 1 * 60 * 1000 // 1 minute
				const limit = !this.#lastRunHadError ? 100 : 5 // if there were errors on last send, don't run too many next time

				const now = getCurrentTime()
				const messagesToSend = await this.#collections.ExternalMessageQueue.findFetch(
					{
						studioId: this.#dataCache.studio._id,
						sent: { $not: { $gt: 0 } },
						lastTry: { $not: { $gt: now - tryInterval } },
						expires: { $gt: now },
						hold: { $not: { $eq: true } },
						errorFatal: { $not: { $eq: true } },
						queueForLaterReason: { $exists: false },
					},
					{
						sort: {
							lastTry: 1,
						},
						limit: limit,
					}
				)

				const probablyHasMoreToSend = messagesToSend.length === limit

				const context: StudioCacheContext = new StudioCacheContextImpl(this.#collections, this.#dataCache)

				const ps = messagesToSend.map(async (msg): Promise<SendResult> => {
					// TODO - what happens if we get too many of these messages queued up? that could block things?
					if (msg.retryUntil !== undefined && !msg.manualRetry && now > msg.retryUntil)
						return { failed: false }

					try {
						const pSend = this.sendMessage(context, msg, now)

						return await pTimeout(pSend, SEND_MESSAGE_TIMEOUT)
					} catch (e) {
						return this.#logMessageError(msg, e)
					}
				})

				const results = await Promise.all(ps)

				this.#lastRunHadError = !results.every((r) => !r.failed)

				// all messages have been sent
				if (probablyHasMoreToSend) {
					// trigger another batch immediately
					this.triggerDoMessageQueue(0)
				}
			} catch (e: unknown) {
				logger.error(stringifyError(e))
			}
		} finally {
			this.#running = false
		}
	}

	private async sendMessage(
		context: StudioCacheContext,
		msg: ExternalMessageQueueObj,
		now: Time
	): Promise<SendResult> {
		try {
			logger.debug(`Trying to send externalMessage, id: ${msg._id}, type: "${msg.type}"`)
			msg.manualRetry = false

			// Mark it as started
			await this.#collections.ExternalMessageQueue.update(msg._id, {
				$set: {
					tryCount: (msg.tryCount || 0) + 1,
					lastTry: now,
					manualRetry: false,
				},
			})

			let result: string | undefined
			try {
				if (msg.type === IBlueprintExternalMessageQueueType.SLACK) {
					// let m = msg as ExternalMessageQueueObjSlack & ExternalMessageQueueObj
					result = (await sendSlackMessageToWebhook(msg.message, msg.receiver)).text
				} else if (msg.type === IBlueprintExternalMessageQueueType.RABBIT_MQ) {
					await sendRabbitMQMessage(context, msg as ExternalMessageQueueObjRabbitMQ & ExternalMessageQueueObj)
					result = undefined
				} else {
					throw new Error(`Unknown / Unsupported externalMessage type: "${msg.type}"`)
				}
			} catch (e) {
				return this.#logMessageError(msg, e)
			}

			await this.#collections.ExternalMessageQueue.update(msg._id, {
				$set: {
					sent: getCurrentTime(),
					sentReply: result,
				},
			})

			logger.debug(`ExternalMessage sucessfully sent, id: ${msg._id}, type: "${msg.type}"`)

			return { failed: false }
		} catch (e) {
			return this.#logMessageError(msg, e)
		}
	}

	async #logMessageError(msg: ExternalMessageQueueObj, e: any): Promise<SendResult> {
		try {
			// errorOnLastRunCount++
			logger.warn(stringifyError(e))
			await this.#collections.ExternalMessageQueue.update(msg._id, {
				$set: {
					errorMessage: e['reason'] || e['message'] || e.toString(),
					errorMessageTime: getCurrentTime(),
					errorFatal: e instanceof FatalExternalMessageError,
				},
			})
		} catch (e2: unknown) {
			logger.error(stringifyError(e2))
		}

		return {
			failed: true,
		}
	}
}

interface SendResult {
	failed: boolean
}

export class FatalExternalMessageError extends Error {
	// Custom error type to allow for detection of a 'fatal' error
}
