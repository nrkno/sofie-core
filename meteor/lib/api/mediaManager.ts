export namespace MediaManagerAPI {
	// Note: These are just the enums from media-manager that core needs to be aware of

	export enum WorkStepStatus {
		IDLE = 'idle',
		WORKING = 'working',
		DONE = 'done',
		ERROR = 'error',
		CANCELED = 'canceled',
		SKIPPED = 'skipped',
		BLOCKED = 'blocked',
	}

	export enum WorkStepAction {
		COPY = 'copy',
		DELETE = 'delete',
		SCAN = 'scan',
		GENERATE_PREVIEW = 'generate_preview',
		GENERATE_THUMBNAIL = 'generate_thumbnail',
		GENERATE_METADATA = 'generate_metadata',
	}
}
