import { URL } from 'url'

export interface RedisOptionsMinimal {
	host: string
	port?: number

	username?: string
	password?: string
}

export function parseRedisEnvVariables(): RedisOptionsMinimal {
	const rawUrl = process.env.REDIS_URL
	if (!rawUrl) throw new Error('Missing required REDIS_URL environment variable')

	const parsed = new URL(rawUrl)
	if (parsed.protocol !== 'redis:') {
		throw new Error(`Invalid protool in REDIS_URL protocol: ${parsed.protocol}`)
	}

	const res: RedisOptionsMinimal = {
		host: parsed.hostname,
	}

	if (parsed.port !== '') res.port = Number(parsed.port)
	if (parsed.username !== '') res.username = parsed.username
	if (parsed.password !== '') res.password = parsed.password

	return res
}
