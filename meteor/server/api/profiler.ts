/*
	Note: meteor-elastic-apm has been temporarily disabled due to being incompatible Meteor 2.3
	See https://github.com/Meteor-Community-Packages/meteor-elastic-apm/pull/61
	So instead I've just added a temporary black-hole replacement for now /Johan Nyman 2022-01-18
*/
type StartSpan = (name: string) => undefined | { end: Function; addLabels: Function }
type StartTransaction = (
	description: string,
	name: string
) => undefined | { end: Function; addLabels: Function; startSpan: StartSpan }

const Agent: {
	startSpan: StartSpan
	startTransaction: StartTransaction
} = {
	startSpan: (_name: string) => {
		return undefined
	},
	startTransaction: (_descr: string, _name: string) => {
		return undefined
	},
}

// import Agent from 'meteor/kschingiz:meteor-elastic-apm'

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
