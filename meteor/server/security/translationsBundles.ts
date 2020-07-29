import { TranslationsBundles, TranslationsBundle } from '../../lib/collections/TranslationsBundles'

export namespace TranslationsBundlesSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {
		return true
	}
	export function allowWriteAccess() {
		return false
	}
}

TranslationsBundles.allow({
	insert(userId: string, doc: TranslationsBundle): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
