import { setMeteorMethods } from '../methods'

setMeteorMethods({
	'logger': (type: string, ...args: any[]) => {
		// @ts-ignore
		let l: any = logger[type] || logger.log
		l(...args)
	}
})
