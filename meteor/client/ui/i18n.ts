import i18n, { TFunction } from 'i18next'
import Backend from 'i18next-xhr-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

let i18nTranslator: TFunction
const i18nInstancePromise = i18n
	.use(Backend)
	.use(LanguageDetector)
	.use(initReactI18next)
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
				useSuspense: false,
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

export { i18nInstancePromise, i18nTranslator }

/*
 Notes:
 * How to use i18n in React:
	export const MyReactClass = withTranslation()(class MyReactClass extends React.Component<IProps & WithTranslation, IState> {
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
