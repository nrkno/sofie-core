export type Time = number
export type TimeDuration = number

export function assertNever(_never: never): void {
	// Do nothing. This is a type guard
}
export function literal<T>(o: T): T {
	return o
}
export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
