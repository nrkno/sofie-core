export default async function got (url: string) {
	if (url.indexOf('127.0.0.1') <= 0) {
		throw new Error('Network error')
	}
	return Promise.resolve({ body: { base_url: '' } })
}
