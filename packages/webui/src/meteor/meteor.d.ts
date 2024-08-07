import { Mongo } from './mongo'
import { EJSONable, EJSONableProperty } from 'meteor/ejson'
import { Blaze } from 'meteor/blaze'
import { DDP } from 'meteor/ddp'

// declare module 'meteor/meteor' {
type global_Error = Error
export namespace Meteor {
	/** Global props **/

	/** User **/
	interface UserEmail {
		address: string
		verified: boolean
	}
	/**
	 * UserProfile is left intentionally underspecified here, to allow you
	 * to override it in your application (but keep in mind that the default
	 * Meteor configuration allows users to write directly to their user
	 * record's profile field)
	 */
	interface UserProfile {}
	interface User {
		_id: string
		username?: string | undefined
		emails?: UserEmail[] | undefined
		createdAt?: Date | undefined
		profile?: UserProfile
		services?: any
	}

	/** User **/

	function user(options?: { fields?: Mongo.FieldSpecifier | undefined }): unknown | null

	/** Error **/
	/**
	 * This class represents a symbolic error thrown by a method.
	 */
	var Error: ErrorStatic
	interface ErrorStatic {
		/**
		 * @param error A string code uniquely identifying this kind of error.
		 * This string should be used by callers of the method to determine the
		 * appropriate action to take, instead of attempting to parse the reason
		 * or details fields. For example:
		 *
		 * ```
		 * // on the server, pick a code unique to this error
		 * // the reason field should be a useful debug message
		 * throw new Meteor.Error("logged-out",
		 *   "The user must be logged in to post a comment.");
		 *
		 * // on the client
		 * Meteor.call("methodName", function (error) {
		 *   // identify the error
		 *   if (error && error.error === "logged-out") {
		 *     // show a nice error message
		 *     Session.set("errorMessage", "Please log in to post a comment.");
		 *   }
		 * });
		 * ```
		 *
		 * For legacy reasons, some built-in Meteor functions such as `check` throw
		 * errors with a number in this field.
		 *
		 * @param reason Optional. A short human-readable summary of the
		 * error, like 'Not Found'.
		 * @param details Optional. Additional information about the error,
		 * like a textual stack trace.
		 */
		new (error: string | number, reason?: string, details?: string): Error
	}
	interface Error extends global_Error {
		error: string | number
		reason?: string | undefined
		details?: string | undefined
	}
	var TypedError: TypedErrorStatic
	interface TypedErrorStatic {
		new (message: string, errorType: string): TypedError
	}
	interface TypedError extends global_Error {
		message: string
		errorType: string
	}
	/** Error **/

	/** Method **/
	interface MethodThisType {
		/** Access inside a method invocation. Boolean value, true if this invocation is a stub. */
		isSimulation: boolean
		/** The id of the user that made this method call, or `null` if no user was logged in. */
		userId: string | null
		/**
		 * Access inside a method invocation. The connection that this method was received on. `null` if the method is not associated with a connection, eg. a server initiated method call. Calls
		 * to methods made from a server method which was in turn initiated from the client share the same `connection`. */
		connection: Connection | null
		/**
		 * Set the logged in user.
		 * @param userId The value that should be returned by `userId` on this connection.
		 */
		setUserId(userId: string | null): void
		/** Call inside a method invocation. Allow subsequent method from this client to begin running in a new fiber. */
		unblock(): void
	}

	/**
	 * Defines functions that can be invoked over the network by clients.
	 * @param methods Dictionary whose keys are method names and values are functions.
	 */
	function methods(methods: { [key: string]: (this: MethodThisType, ...args: any[]) => any }): void

	/**
	 * Invokes a method passing any number of arguments.
	 * @param name Name of method to invoke
	 * @param args Optional method arguments
	 */
	function call(name: string, ...args: any[]): any

	/** Url **/
	/**
	 * Generate an absolute URL pointing to the application. The server reads from the `ROOT_URL` environment variable to determine where it is running. This is taken care of automatically for
	 * apps deployed to Galaxy, but must be provided when using `meteor build`.
	 */
	var absoluteUrl: {
		/**
		 * @param path A path to append to the root URL. Do not include a leading "`/`".
		 */
		(path?: string, options?: absoluteUrlOptions): string
		defaultOptions: absoluteUrlOptions
	}

	/** Timeout **/
	/**
	 * Call a function repeatedly, with a time delay between calls.
	 * @param func The function to run
	 * @param delay Number of milliseconds to wait between each function call.
	 */
	function setInterval(func: Function, delay: number): number

	/**
	 * Call a function in the future after waiting for a specified delay.
	 * @param func The function to run
	 * @param delay Number of milliseconds to wait before calling function
	 */
	function setTimeout(func: Function, delay: number): number
	/**
	 * Cancel a repeating function call scheduled by `Meteor.setInterval`.
	 * @param id The handle returned by `Meteor.setInterval`
	 */
	function clearInterval(id: number): void

	/**
	 * Cancel a function call scheduled by `Meteor.setTimeout`.
	 * @param id The handle returned by `Meteor.setTimeout`
	 */
	function clearTimeout(id: number): void
	/**
	 * Defer execution of a function to run asynchronously in the background (similar to `Meteor.setTimeout(func, 0)`.
	 * @param func The function to run
	 */
	function defer(func: Function): void
	/** Timeout **/

	/** utils **/
	/**
	 * Run code when a client or a server starts.
	 * @param func A function to run on startup.
	 */
	function startup(func: Function): void

	/**
	 * Cancel a function call scheduled by `Meteor.setTimeout`.
	 * @param id The handle returned by `Meteor.setTimeout`
	 */
	function clearTimeout(id: number): void
	/**
	 * Defer execution of a function to run asynchronously in the background (similar to `Meteor.setTimeout(func, 0)`.
	 * @param func The function to run
	 */
	function defer(func: Function): void
	/** Timeout **/

	function bindEnvironment<TFunc extends Function>(func: TFunc): TFunc

	/** utils **/

	class EnvironmentVariable<T> {
		readonly slot: number
		constructor()
		get(): T
		getOrNullIfOutsideFiber(): T | null
		withValue<U>(value: T, fn: () => U): U
	}
	/** utils **/

	/** Pub/Sub **/
	interface SubscriptionHandle {
		/** Cancel the subscription. This will typically result in the server directing the client to remove the subscription’s data from the client’s cache. */
		stop(): void
		/** True if the server has marked the subscription as ready. A reactive data source. */
		ready(): boolean
	}
	interface LiveQueryHandle {
		stop(): void
	}
	/** Pub/Sub **/

	/** Login **/

	function loginWithPassword(
		user: Object | string,
		password: string,
		callback?: (error?: global_Error | Meteor.Error | Meteor.TypedError) => void
	): void

	function logout(callback?: (error?: global_Error | Meteor.Error | Meteor.TypedError) => void): void

	/** Login **/

	/** Connection **/
	function reconnect(): void

	/** Connection **/

	/** Status **/
	function status(): DDP.DDPStatus
	/** Status **/

	/** Pub/Sub **/
	/**
	 * Subscribe to a record set.  Returns a handle that provides
	 * `stop()` and `ready()` methods.
	 * @param name Name of the subscription.  Matches the name of the
	 * server's `publish()` call.
	 * @param args Optional arguments passed to publisher
	 * function on server.
	 * @param callbacks Optional. May include `onStop`
	 * and `onReady` callbacks. If there is an error, it is passed as an
	 * argument to `onStop`. If a function is passed instead of an object, it
	 * is interpreted as an `onReady` callback.
	 */
	function subscribe(name: string, ...args: any[]): Meteor.SubscriptionHandle
	/** Pub/Sub **/
}
