import Agent from 'meteor/julusian:meteor-elastic-apm'

class Profiler {
	private active: boolean = false

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
	}
}

const profiler = new Profiler()

export { profiler }
