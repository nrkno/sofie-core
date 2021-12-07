module.exports = async () => {
	process.env.TZ = 'UTC'
	process.env.REDIS_URL = 'redis://localhost:8'
}
