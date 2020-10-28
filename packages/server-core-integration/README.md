# Sofie: The Modern TV News Studio Automation System (Server Core Integration)
[![CircleCI](https://circleci.com/gh/nrkno/tv-automation-server-core-integration.svg?style=svg)](https://circleci.com/gh/nrkno/tv-automation-server-core-integration)
[![codecov](https://codecov.io/gh/nrkno/tv-automation-server-core-integration/branch/master/graph/badge.svg)](https://codecov.io/gh/nrkno/tv-automation-server-core-integration)

This library is used to connect to the [**Sofie Server Core**](https://github.com/nrkno/tv-automation-server-core) from other Node processes.

This is a part of the [**Sofie** TV News Studio Automation System](https://github.com/nrkno/Sofie-TV-automation/).

# Getting started

## Typescript
```typescript
import { CoreConnection, PeripheralDeviceAPI } from 'tv-automation-server-core-integration'

// Set up our basic credentials:
let core = new CoreConnection({
	deviceId: 'device01', 			// Unique id
	deviceToken: 'mySecretToken',	// secret token, used to authenticate this device
	deviceType: PeripheralDeviceAPI.DeviceType.PLAYOUT,
	deviceName: 'My peripheral device'
})
core.on('error', console.log)
// Initiate connection to Core:
core.init({
	host: '127.0.0.1',
	port: 3000
}).then(() => {
	// Connection has been established
	console.log('Connected!')
	// Set device status:
	return core.setStatus({
		statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
		messages: ['Everything is awesome!']
	})
})
.catch((err) => {
	console.log(err)
})
```

## Development
* Installation
  * Install Yarn from https://yarnpkg.com
  * Install Jest, `yarn global add jest`
  * Install npm dependencies, `yarn`
* Build
  * Build, `yarn build`
  * Run tests, `yarn test`
  * Run tests & watch, `yarn watch`

## DDP Client

This library has a self-contained DDP client that can be used independently of the rest of the module.

```typescript
import { DDPClient, DDPConnectorOptions } from 'tv-automation-server-integration'

let options: DDPConnectorOptions = {
	host: '127.0.0.1',
	port: 5432
}

let ddp = new DDPClient(options)
ddp.on('connected', /* ... */ )
ddp.connect((err: any) => {
	if (err) {
		/* ... handle error ... */
		return
	} 
	let subId = ddp.subscribe('expectedMediaItems')
	ddp.observe('expectedMediaItems', /* added cb */, /* changed cb */, /* removed cb */)
	
	/* ... then later ... */
	ddp.unsub(subId)
	ddp.close()
})
```

See the documentation on the [DDP client class](./docs/classes/ddpclient.html) for more details.