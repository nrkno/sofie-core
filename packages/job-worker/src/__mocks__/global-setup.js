module.exports = async () => {
	process.env.TZ = 'UTC'
	process.env.ROOT_URL = 'http://sofie-in-jest:3000'
}
