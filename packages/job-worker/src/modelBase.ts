/**
 * A base type for loaded Models
 */
export interface BaseModel {
	/**
	 * Name to display in debug logs about this Model
	 */
	readonly displayName: string

	/**
	 * Mark the model as disposed
	 * After this call, the model should discard any pending changes, and reject any requests to persist the changes
	 */
	dispose(): void

	/**
	 * Assert that no changes should have been made to the model, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code owning the model expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void
}

export interface DatabasePersistedModel {
	/**
	 * Issue a save of the contents of this model to the database
	 */
	saveAllToDatabase(): Promise<void>
}
