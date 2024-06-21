import React, { memo, useEffect, useState } from 'react'
import { CreateTestingRundownOption } from '../../../lib/api/showStyles'
import { MeteorCall } from '../../../lib/api/methods'
import { UserAction, doUserAction } from '../../../lib/clientUserAction'
import { useTranslation } from 'react-i18next'

export const CreateTestingRundownPanel = memo(function CreateTestingRundownPanel(): JSX.Element | null {
	const { t } = useTranslation()

	const [options, setOptions] = useState<CreateTestingRundownOption[]>([])

	useEffect(() => {
		let isDisposed = false

		const doPoll = () => {
			MeteorCall.showstyles
				.getCreateTestingRundownOptions()
				.then((newOptions) => {
					if (isDisposed) return
					setOptions(newOptions)
				})
				.catch((e) => {
					console.error(`Failed to get create testing rundown options: ${e}`)
				})
		}

		const interval = setInterval(doPoll, 30000)
		doPoll()

		return () => {
			isDisposed = true
			clearInterval(interval)
		}
	}, [])

	const doCreateTestingRundown = (e: React.MouseEvent, option: CreateTestingRundownOption) => {
		doUserAction(t, e, UserAction.CREATE_TESTING_RUNDOWN, (e, ts) =>
			MeteorCall.userAction.createTestingRundownForShowStyleVariant(e, ts, option.studioId, option.showStyleVariantId)
		)
	}

	if (options.length === 0) return null

	return (
		<div className="mtl gutter create-testing-rundown">
			<h2>{t('Create Testing Rundown')}</h2>
			<p>
				{options.map((option) => (
					<button
						key={JSON.stringify(option)}
						className="btn btn-primary"
						onClick={(e) => doCreateTestingRundown(e, option)}
					>
						{option.label}
					</button>
				))}
			</p>
		</div>
	)
})
