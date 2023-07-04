declare module 'meteor/meteor' {
	export namespace Meteor {
		/**
		 * Pending https://github.com/meteor/meteor/pull/12645
		 */

		interface MethodApplyOptions {
			/**
			 * (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
			 */
			wait?: boolean | undefined
			/**
			 * (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
			 */
			onResultReceived?: ((error: global_Error | Meteor.Error | undefined, result?: Result) => void) | undefined
			/**
			 * (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
			 */
			noRetry?: boolean | undefined
			/**
			 * (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
			 */
			returnStubValue?: boolean | undefined
			/**
			 * (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
			 */
			throwStubExceptions?: boolean | undefined
		}

		/**
		 * Invokes a method with an async stub, passing any number of arguments.
		 * @param name Name of method to invoke
		 * @param args Method arguments
		 * @param options Optional execution options
		 * @param asyncCallback Optional callback
		 */
		function applyAsync<Result extends EJSONable | EJSONable[] | EJSONableProperty | EJSONableProperty[]>(
			name: string,
			args: ReadonlyArray<EJSONable | EJSONableProperty>,
			options?: MethodApplyOptions
		): Promise<Result>
	}
}
