import {
	IBlueprintConfig,
	ICommonContext,
	IFixUpConfigContext,
	ITranslatableMessage,
	JSONSchema,
} from '@sofie-automation/blueprints-integration'
import { literal, objectPathSet } from '../lib'
import {
	applyAndValidateOverrides,
	filterOverrideOpsForPrefix,
	findParentOpToUpdate,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	ObjectWithOverrides,
} from '../settings/objectWithOverrides'

export class FixUpBlueprintConfigContext implements IFixUpConfigContext {
	readonly #commonContext: ICommonContext
	readonly #configObject: ObjectWithOverrides<IBlueprintConfig>

	constructor(
		commonContext: ICommonContext,
		_schema: JSONSchema,
		configObject: ObjectWithOverrides<IBlueprintConfig>
	) {
		this.#commonContext = commonContext
		this.#configObject = configObject
	}

	#findParentSchemaEntry(
		_path: string
	): { path: string; subpath: string; type: 'value' | 'array' | 'object' } | null {
		throw new Error('Method not implemented.')
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

		const { opsForPrefix: opsForParent } = filterOverrideOpsForPrefix(
			this.#configObject.overrides,
			parentSchemaEntry.path
		)

		const existingParentOp = findParentOpToUpdate(opsForParent, parentSchemaEntry.subpath)
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
			path: `${toPath}${op.path.slice(0, fromPath.length)}`,
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
