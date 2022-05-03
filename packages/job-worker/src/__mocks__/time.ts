let currentTime: number | null = null

export function getCurrentTime(): number {
	return currentTime ?? Date.now()
}

export function useFakeCurrentTime(time?: number): void {
	currentTime = time ?? Date.now()
}
export function useRealCurrentTime(): void {
	currentTime = null
}

export function adjustFakeTime(offset: number): number {
	if (typeof currentTime !== 'number') throw new Error('Time is not faked')
	currentTime += offset
	return currentTime
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function setup() {
	return {
		getCurrentTime: getCurrentTime,
	}
}
