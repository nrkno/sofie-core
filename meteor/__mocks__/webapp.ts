export const WebAppMock = {
	rawHandlers: {
		use: (): void => {
			// No web server to setup
		},
	},
	// Nothing yet
}
export function setup(): any {
	return {
		WebApp: WebAppMock,
	}
}
