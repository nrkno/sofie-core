import * as inspector from 'node:inspector'

export const FORCE_CLEAR_CACHES_JOB = '__forceClearCaches__'

export const IS_INSPECTOR_ENABLED = !!inspector.url()
