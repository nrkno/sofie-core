import * as Agent from 'elastic-apm-node'

// TODO - replace with methods on JobContext
class Profiler {
	private active = false

	startSpan(_name: string) {
		if (!this.active) return
		return Agent.startSpan(_name)
	}

	startTransaction(description: string, name: string) {
		if (!this.active) return
		return Agent.startTransaction(description, name)
	}

	setActive(active: boolean) {
		this.active = active
		// if (active) {
		//     Agent.start()
		// } else {
		//     Agent.destroy()
		// }
	}
}

const profiler = new Profiler()

export { profiler }
