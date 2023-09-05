import { useEffect, useRef } from 'react'
import { catchError } from '../../../lib/lib'

export function useWakeLock(): void {
	const wakeLockRef = useRef<WakeLockSentinel | null>(null)
	useEffect(() => {
		if (!wakeLockRef.current) {
			;(async () => {
				wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null
			})().catch(catchError('request wakeLock'))
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
