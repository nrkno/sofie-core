class VMMock {
	run(str: string): any {
		return eval('let ' + str)
	}
}

function mockSetup() {
	return {
		VM: VMMock,
	}
}

jest.mock('vm2', () => mockSetup(), { virtual: true })
