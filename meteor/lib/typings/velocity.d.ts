declare module 'velocity-animate' {
	function Velocity(target: HTMLElement, command: string, commandProps?: Record<string, any>): void
	function Velocity(target: HTMLElement, command: string, stopAll?: boolean): void
	function Velocity(target: HTMLElement, props: Record<string, any>, animationProps: Record<string, any>): void

	export default Velocity
}
