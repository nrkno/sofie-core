declare module 'timecode' {
	export class TimecodeClass {
		init(initParams: { framerate: string; timecode: string | number | Date; drop_frame?: boolean }): TimecodeClass
		set(timecode: string | number | Date): void
		hours: number
		minutes: number
		seconds: number
		frames: number
		frame_count: number
		add(args: string | number | Date): void
		subtract(args: string | number | Date): void
		toString(): string
	}
	export const Timecode: TimecodeClass
}
