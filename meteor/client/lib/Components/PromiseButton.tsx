import React, { useCallback, useEffect, useState } from 'react'
import ClassNames from 'classnames'
import { logger } from '../../../lib/logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'

import './PromiseButton.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Spinner } from '../Spinner'

/** The PromiseButton renders a button which when clicked, disables the button while the onClick-promise is resolving. */
export const PromiseButton: React.FC<{
	className?: string
	disabled?: boolean
	/**
	 * Action to execute when user clicks the button.
	 * The callback should return a promise, which will be awaited before re-enabling the button.
	 * If the action succeeds, the promise should resolve to true, otherwise false (or undefined).
	 */
	onClick: (event: React.MouseEvent<HTMLButtonElement>) => Promise<boolean | undefined>
	children: React.ReactNode
}> = (props) => {
	const [isPending, setIsPending] = useState(false)
	const [actionResult, setActionResult] = useState<boolean | undefined>(undefined)

	const onClickButton = useCallback(
		async (e: React.MouseEvent<HTMLButtonElement>) => {
			setIsPending(true)
			try {
				setActionResult(await props.onClick(e))
			} catch (error) {
				logger.error(`PromiseButton: Error in onClick: ${stringifyError(error)}`)
			} finally {
				setIsPending(false)
			}
		},
		[props.onClick]
	)

	useEffect(() => {
		if (!isPending && actionResult !== undefined) {
			// Reset the actionResult after 3 seconds
			const timeout = setTimeout(() => {
				setActionResult(undefined)
			}, 3000)
			return () => {
				clearTimeout(timeout)
			}
		}
	}, [isPending, actionResult])

	const overlayContent = isPending ? (
		<Spinner size="small" className="spinner" />
	) : actionResult === true ? (
		<FontAwesomeIcon icon={faCheck} />
	) : actionResult === false ? (
		<FontAwesomeIcon icon={faExclamationTriangle} />
	) : null

	return (
		<button
			className={ClassNames('promise-button', props.className, {
				'is-pending': isPending,
				'is-success': !isPending && actionResult === true,
				'is-failure': !isPending && actionResult === false,
			})}
			disabled={props.disabled || isPending}
			onClick={onClickButton}
		>
			<div className={ClassNames('content', overlayContent && 'content-hidden')}>{props.children}</div>
			<div className="overlay">{overlayContent}</div>
		</button>
	)
}
