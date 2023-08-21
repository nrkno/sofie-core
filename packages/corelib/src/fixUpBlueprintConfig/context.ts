import {
	IBlueprintConfig,
	ICommonContext,
	IFixUpConfigContext,
	ITranslatableMessage,
	JSONSchema,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { literal, objectPathGet, objectPathSet } from '../lib'
import {
	applyAndValidateOverrides,
	filterOverrideOpsForPrefix,
	findParentOpToUpdate,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	ObjectWithOverrides,
} from '../settings/objectWithOverrides'

interface MatchedSchemaEntry {
	path: string
	subpath: string
	type: 'value' | 'array' | 'object'
}

export class FixUpBlueprintConfigContext implements IFixUpConfigContext {
	readonly #commonContext: ICommonContext
	readonly #configSchema: ReadonlyDeep<JSONSchema>
	readonly #configObject: ObjectWithOverrides<IBlueprintConfig>

	constructor(
		commonContext: ICommonContext,
		configSchema: ReadonlyDeep<JSONSchema>,
		configObject: ObjectWithOverrides<IBlueprintConfig>
	) {
		this.#commonContext = commonContext
		this.#configSchema = configSchema
		this.#configObject = configObject
	}

	#findParentSchemaEntry(path: string): MatchedSchemaEntry | null {
		if (!path) return null

		const fragments = path.split('.')

		let subSchema: ReadonlyDeep<JSONSchema> | undefined = this.#configSchema
		const subSchemaPath: string[] = []
		for (const fragment of fragments) {
			const newSubSchema: ReadonlyDeep<JSONSchema> | undefined = subSchema?.properties?.[fragment]
			if (!newSubSchema) break
			subSchemaPath.push(fragment)
			subSchema = newSubSchema

			const flatPath = subSchemaPath.join('.')
			const subpath = path.slice(flatPath.length + 1)

			switch (subSchema.type) {
				case 'array': {
					// This looks like a table object
					return {
						path: flatPath,
						subpath: subpath,
						type: 'array',
					}
				}
				case 'object':
					if (subSchema.patternProperties) {
						// This looks like a table object
						return {
							path: flatPath,
							subpath: subpath,
							type: 'object',
						}
					} else {
						// Run the loop again
					}
					break
				default: {
					if (subpath) throw new Error('Cannot set a path inside of a value object')
					return {
						path: flatPath,
						subpath: subpath,
						type: 'value',
					}
				}
			}
		}

		return null
	}

	getConfig(): IBlueprintConfig {
		return applyAndValidateOverrides(this.#configObject).obj
	}

	listPaths(): string[] {
		return this.#configObject.overrides.map((op) => op.path)
	}

	listInvalidPaths(): string[] {
		const appliedConfig = applyAndValidateOverrides(this.#configObject)
		return appliedConfig.invalid.map((op) => op.path)
	}

	hasOperations(path: string): boolean {
		const { opsForPrefix } = filterOverrideOpsForPrefix(this.#configObject.overrides, path)
		return opsForPrefix.length > 0
	}

	addSetOperation(path: string, value: unknown): void {
		const parentSchemaEntry = this.#findParentSchemaEntry(path)
		if (!parentSchemaEntry) throw new Error(`Path "${path}" does not exist in the current config schema`)

		if (parentSchemaEntry.type === 'array') {
			this.#addSetOperationForObjectArray(parentSchemaEntry, value)
		} else if (parentSchemaEntry.type === 'object') {
			this.#addSetOperationForObjectTable(parentSchemaEntry, path, value)
		} else {
			this.#addSetOperationForValue(parentSchemaEntry, path, value)
		}
	}

	#addSetOperationForObjectTable(tableSchemaEntry: MatchedSchemaEntry, path: string, value: any) {
		if (tableSchemaEntry.subpath === '') throw new Error('Cannot set an object to a value')

		const { opsForPrefix: opsForRoot } = filterOverrideOpsForPrefix(
			this.#configObject.overrides,
			tableSchemaEntry.path
		)

		const existingParentOp = findParentOpToUpdate(opsForRoot, tableSchemaEntry.subpath)
		if (existingParentOp) {
			// Found an op at a higher level that can be modified instead
			objectPathSet(existingParentOp.op.value, existingParentOp.newSubPath, value)

			// Mutation was performed in place
		} else {
			// Insert new op
			const setOp = literal<ObjectOverrideSetOp>({
				op: 'set',
				path: path,
				value: value,
			})

			const { otherOps } = filterOverrideOpsForPrefix(this.#configObject.overrides, path)

			this.#configObject.overrides = [...otherOps, setOp]
		}
	}
	#addSetOperationForObjectArray(arraySchemaEntry: MatchedSchemaEntry, value: any) {
		// Arrays can only be overwritten as a single object

		let newOpForArray: ObjectOverrideSetOp
		if (arraySchemaEntry.subpath === '') {
			newOpForArray = { op: 'set', path: arraySchemaEntry.path, value: value }
		} else {
			const currentObj = applyAndValidateOverrides(this.#configObject).obj // Note: this will not be very performant, but it is safer
			const currentValue = objectPathGet(currentObj, arraySchemaEntry.path)

			// Mutate in place, as we have a clone
			objectPathSet(currentValue, arraySchemaEntry.subpath, value)

			newOpForArray = { op: 'set', path: arraySchemaEntry.path, value: currentValue }
		}

		const { otherOps } = filterOverrideOpsForPrefix(this.#configObject.overrides, arraySchemaEntry.path)

		this.#configObject.overrides = [...otherOps, newOpForArray]
	}
	#addSetOperationForValue(valueSchemaEntry: MatchedSchemaEntry, path: string, value: any) {
		// Insert new op
		const setOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: path,
			value: value,
		})

		const { otherOps } = filterOverrideOpsForPrefix(this.#configObject.overrides, valueSchemaEntry.path)

		this.#configObject.overrides = [...otherOps, setOp]
	}

	addDeleteOperation(path: string): void {
		const { otherOps } = filterOverrideOpsForPrefix(this.#configObject.overrides, path)

		const parentSchemaEntry = this.#findParentSchemaEntry(path)
		if (!parentSchemaEntry) throw new Error(`Path "${path}" does not exist in the current config schema`)

		// nocommit this isnt 'safe' and could make a mess that will confuse the ui
		const deleteOp: ObjectOverrideDeleteOp = {
			op: 'delete',
			path,
		}

		this.#configObject.overrides = [...otherOps, deleteOp]
	}

	removeOperations(path: string): void {
		const { opsForPrefix, otherOps } = filterOverrideOpsForPrefix(this.#configObject.overrides, path)
		if (opsForPrefix.length === 0) return

		this.#configObject.overrides = otherOps
	}

	renameOperations(fromPath: string, toPath: string): void {
		const { opsForPrefix, otherOps } = filterOverrideOpsForPrefix(this.#configObject.overrides, fromPath)
		if (opsForPrefix.length === 0) return

		const opsWithUpdatedPrefix = opsForPrefix.map((op) => ({
			...op,
			path: `${toPath}${op.path.slice(fromPath.length)}`,
		}))

		this.#configObject.overrides = [...otherOps, ...opsWithUpdatedPrefix]
	}

	warnUnfixable(_path: string, _message: ITranslatableMessage): void {
		throw new Error('Method not implemented.')
	}

	// Forward to wrapped ICommonContext
	getHashId(...args: Parameters<ICommonContext['getHashId']>): string {
		return this.#commonContext.getHashId(...args)
	}
	unhashId(...args: Parameters<ICommonContext['unhashId']>): string {
		return this.#commonContext.unhashId(...args)
	}
	logDebug(...args: Parameters<ICommonContext['logDebug']>): void {
		return this.#commonContext.logDebug(...args)
	}
	logInfo(...args: Parameters<ICommonContext['logInfo']>): void {
		return this.#commonContext.logInfo(...args)
	}
	logWarning(...args: Parameters<ICommonContext['logWarning']>): void {
		return this.#commonContext.logWarning(...args)
	}
	logError(...args: Parameters<ICommonContext['logError']>): void {
		return this.#commonContext.logError(...args)
	}
}
