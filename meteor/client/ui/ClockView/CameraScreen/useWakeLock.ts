import { useEffect, useRef } from 'react'

export function useWakeLock(): void {
	const wakeLockRef = useRef<WakeLockSentinel | null>(null)
	useEffect(() => {
		if (!wakeLockRef.current) {
			;(async () => {
				wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null
			})().catch((e) => console.error(`Could not get wake lock: ${e}`))
		}

		async function onVisibilityChange() {
			if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
				wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null
			}
		}

		document.addEventListener('visibilitychange', onVisibilityChange)

		return () => {
			if (wakeLockRef.current !== null) {
				wakeLockRef.current.release()
				wakeLockRef.current = null
			}

			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	}, [])
}
