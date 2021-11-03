import * as React from 'react'
import { MeteorCall } from '../../../lib/api/methods'
import { useTranslation } from 'react-i18next'
import { PerformanceTestResult } from '../../../lib/api/system'
import Tooltip from 'rc-tooltip'

export const PerformanceTestPage: React.FC<{}> = function PerformanceTestPage() {
	const [errorMessage, setErrorMessage] = React.useState<string>('')
	const [results, setResults] = React.useState<PerformanceTestResult[]>([])

	function runPerformanceTest() {
		setErrorMessage(`Running test...`)

		MeteorCall.system
			.runPerformanceTests()
			.then((newResults) => {
				setErrorMessage(``)
				setResults(results.concat(newResults))
			})
			.catch((err) => {
				setErrorMessage(`${err}`)
			})
	}
	function getColor(result: PerformanceTestResult): string {
		const val = result.baseline && result.valueMean ? result.baseline / result.valueMean : 0

		// Using HSL to get a nice color band from green (100) -> yellow -> red (0):
		const h = Math.round(Math.min(100, Math.max(0, val * 100)))
		return `hsl(${h}deg 100% 50%)`
	}

	const { t } = useTranslation()

	return (
		<div className="mtl gutter">
			<header className="mvs">
				<h1>{t('Performance test')}</h1>
			</header>

			<p>
				<i>{t(`Only run the performance test when the system is idle`)}</i>
			</p>

			<button className="btn btn-secondary" onClick={() => runPerformanceTest()}>
				{t('Run performance test')}
			</button>

			<div>
				{errorMessage ? <p>{errorMessage}</p> : null}
				{results.length ? (
					<>
						<i>({t('Lower is better')})</i>
						<table className="table">
							<tbody>
								<tr>
									<th>{t('Name')}</th>
									<th>
										<Tooltip overlay={t('Average time it took for the test to run')} placement="top">
											<span>{t('Average')}</span>
										</Tooltip>
									</th>
									<th>
										<Tooltip overlay={t('Highest 95 percentile')} placement="top">
											<span>{t('Max 95%')}</span>
										</Tooltip>
									</th>
									<th>
										<Tooltip overlay={t('Lowest 95 percentile')} placement="top">
											<span>{t('Min 95%')}</span>
										</Tooltip>
									</th>
									<th>
										<Tooltip overlay={t('Highest value')} placement="top">
											<span>{t('Max')}</span>
										</Tooltip>
									</th>
									<th>
										<Tooltip overlay={t('Lowest value')} placement="top">
											<span>{t('Min')}</span>
										</Tooltip>
									</th>
									<th>
										<Tooltip overlay={t('The number of times the test was run')} placement="top">
											<span>{t('Run Count')}</span>
										</Tooltip>
									</th>
								</tr>
								{results.map((result, index) => (
									<tr key={index}>
										<td>
											<Tooltip overlay={result.description} placement="top">
												<span>{result.label}</span>
											</Tooltip>
										</td>
										<td style={{ backgroundColor: getColor(result) }}>
											{t(`{{value}} ms`, { value: result.valueMean })}
										</td>
										<td>{result.valueMax95}</td>
										<td>{result.valueMin95}</td>
										<td>{result.valueMax}</td>
										<td>{result.valueMin}</td>
										<td>{result.count}</td>
									</tr>
								))}
							</tbody>
						</table>
					</>
				) : null}
			</div>
		</div>
	)
}
