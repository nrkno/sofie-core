// import Agent from 'meteor/kschingiz:meteor-elastic-apm'

class Profiler {
	startSpan(_name: string): { end: () => {}; addLabels: (str: any) => {} } | undefined {
		return undefined
		// return Agent.startSpan(_name)
	}

	startTransaction(_description: string, _name: string): { end: () => {} } | undefined {
		return
		// Agent.startTransaction(description, 'userAction')
	}
}

const profiler = new Profiler()

export { profiler }
