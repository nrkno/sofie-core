

declare module 'data-store' {
    interface Options {
      /* Milliseconds to delay writing the JSON file to the file system. This can make the store more performant by preventing multiple subsequent writes after calling .set or setting/getting store.data, but comes with the potential side effect that the config file will be outdated during the timeout. To get around this, use data-store's API to (re-)load the file instead of directly reading the file (using fs.readFile for example). */
      debounce?: number
      /* The indent value to pass to JSON.stringify() when writing the file to the fs, or when .json() is called */
      indent?: number | null
      /* The name to use for the store file stem (name + '.json' is the store's file name) */
      name?: string
      /* The root home directory to use */
      home?: string
      /* The directory to use for data-store config files. This value is joined to home */
      base?: string
      /* ... */
      path?: string	
    }
    interface DataObject {
      [key: string]: any
    }
    /**
     * Initialize a new Store with the given name, options and default data.
     */
    class Store {
  
      constructor (name?: string, options?: Options, defaults?: any)
      constructor (options?: Options, defaults?: any)
  
      /**
       * Assign value to key and save to the file system. Can be a key-value pair, array of objects, or an object.
       */
      set: (key: string, val: any) => Store
      /**
       * Add the given value to the array at key. Creates a new array if one doesn't exist, and only adds unique values to the array.
       */
      union: (key: string, val: any) => Store
      /**
       * Get the stored value of key.
       */
      get: (key: string) => any
      /**
       * Returns true if the specified key has a value.
       */
      has: (key: string) => boolean
      /**
       * Returns true if the specified key exists.
       */
      hasOwn: (key: string) => boolean
      /**
       * Delete one or more properties from the store.
       */
      del: (...keys: string[]) => void
      /**
       * Return a clone of the store.data object.
       */
      clone: () => DataObject
      /**
       * Reset store.data to an empty object.
       */
      clear: () => undefined
      /**
       * Stringify the store. Takes the same arguments as JSON.stringify.
       */
      json: () => string
      /**
       * Calls .writeFile() to persist the store to the file system, after an optional debounce period. This method should probably not be called directly as it's used internally by other methods.
       */
      save: () => undefined
      /**
       * Delete the store from the file system.
       */
      unlink: () => undefined
    }
    export = Store
  }