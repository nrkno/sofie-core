class VMMock {
	run(str: string): any {
		return eval('let ' + str)
	}
}

class VMScriptMock {
	constructor(private str: string) {}
	toString() {
		return this.str
	}
}

function mockSetup() {
	return {
		VM: VMMock,
		VMScript: VMScriptMock,
	}
}

jest.mock('vm2', () => mockSetup(), { virtual: true })
