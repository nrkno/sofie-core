import * as i18n from 'i18next'
import * as Backend from 'i18next-xhr-backend'
import * as LanguageDetector from 'i18next-browser-languagedetector'
import { reactI18nextModule } from 'react-i18next'

let i18nTranslator: i18n.TranslationFunction<any, object, string>
const i18nInstance = i18n
	.use(Backend)
	.use(LanguageDetector)
	.use(reactI18nextModule)
	.init(
		{
			fallbackLng: {
				nn: ['nb', 'en'],
				default: ['en'],
			},

			// have a common namespace used around the full app
			ns: ['translations'],
			defaultNS: 'translations',

			debug: false,
			joinArrays: '\n',

			whitelist: ['en', 'nb', 'nn', 'sv'],

			keySeparator: '→',
			nsSeparator: '⇒',
			pluralSeparator: '⥤',
			contextSeparator: '⥤',

			interpolation: {
				escapeValue: false, // not needed for react!!
			},

			react: {
				wait: true,
			},
		},
		(err, t) => {
			if (err) {
				console.error('Error initializing i18Next', err)
			} else {
				i18nTranslator = t
			}
		}
	)

export { i18nInstance, i18nTranslator }

/*
 Notes:
 * How to use i18n in React:
	export const MyReactClass = translate()(class MyReactClass extends React.Component<IProps & InjectedTranslateProps, IState> {
		render () {
			const {t} = this.props
			t('My name is {{name}}', {name: 'foobar'})
		}
	})

 * How to use in script:
	import { i18nTranslator } from '../i18n'
	const t = i18nTranslator
	return t('My name is {{name}}', {name: 'foobar'})
 */
