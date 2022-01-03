export enum StatusCode {
	/** Status unknown, for example at startup */
	UNKNOWN = 0,
	/** All good and green */
	GOOD = 1,
	/** Not everything is OK, but normal operation is not affected */
	WARNING_MINOR = 2,
	/** Not everything is OK, normal operation might be affected */
	WARNING_MAJOR = 3,
	/** Normal operation is affected, automatic recover might be possible */
	BAD = 4,
	/** Normal operation is affected, automatic recover is not possible (manual interference is required) */
	FATAL = 5,
}
