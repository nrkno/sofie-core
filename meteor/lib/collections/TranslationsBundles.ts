import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString } from '../lib'

import { TranslationsBundle as BlueprintTranslationsBundle } from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'

/** A string identifying a translations bundle */
export type TranslationsBundleId = ProtectedString<'TranslationsBundleId'>

export interface TranslationsBundle extends BlueprintTranslationsBundle {
	_id: TranslationsBundleId
}

export const TranslationsBundles: TransformedCollection<TranslationsBundle, TranslationsBundle> = createMongoCollection<
	TranslationsBundle
>('translationsBundles')
registerCollection('TranslationsBundles', TranslationsBundles)
