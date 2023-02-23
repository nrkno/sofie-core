import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../lib/api/trpc/server'

// Notice the <AppRouter> generic here.
const trpc = createTRPCProxyClient<AppRouter>({
	links: [
		httpBatchLink({
			url: 'http://localhost:3000/trpc',
		}),
	],
})
window['trpc'] = trpc

export { trpc as trpcClient }
