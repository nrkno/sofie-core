import { Picker } from 'meteor/meteorhacks:picker'
import * as bodyParser from 'body-parser'

// Set up and expose server-side router:

export const PickerPOST = Picker.filter((req) => req.method === 'POST')

PickerPOST.middleware(bodyParser.json({
	limit: '10mb' // Arbitrary limit
}))
PickerPOST.middleware(bodyParser.text({
	type: 'application/json',
	limit: '10mb'
}))
PickerPOST.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb' // 1
}))


export const PickerGET = Picker.filter((req, res) => req.method === 'GET')

export const PickerDELETE = Picker.filter((req, res) => req.method === 'DELETE')
