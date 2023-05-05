import { register, collectDefaultMetrics } from 'prom-client'

/**
 * HTTP Content-type header for the metrics
 */
export const PrometheusHTTPContentType = register.contentType

/**
 * Stringified metrics for serving over HTTP
 */
export async function getPrometheusMetricsString(): Promise<string> {
	return register.metrics()
}

/**
 * Setup metric reporting for this thread
 * @param threadName The `threadName` label to add to each metric
 */
export function setupPrometheusMetrics(threadName: string): void {
	// Label all metrics with the source 'thread'
	register.setDefaultLabels({
		threadName: threadName,
	})

	// Collect the default metrics nodejs metrics
	collectDefaultMetrics()
}
