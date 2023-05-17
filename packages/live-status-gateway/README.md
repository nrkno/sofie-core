# Sofie Live Status Gateway

The Sofie Live Status Gateway is intended to be used to provide a **Stable API** that can **stream live updates** to external applications.
## For Developers
### Starting the gateway
`yarn start -id [SOME_ID_VALUE]` e.g. `yarn start -id live_status_gateway0`.

### How to write an external application that interfaces with this gateway

Minimal example:

```js
const ws = new WebSocket(`ws://mysofie:8080`)
ws.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    switch (data.event) {
        case 'pong':
            handlePong(data);
            break;
        case 'heartbeat':
            handleHeartbeat(data);
            break;
        case 'subscriptionStatus':
            handleSubscriptionStatus(data);
            break;
        case 'studio':
            handleStudio(data);
            break;
        case 'activePlaylist':
            handleActivePlaylist(data);
            break;
    }
});

ws.addEventListener('open', () => {
    console.log('socket open');
});

ws.addEventListener('close', () => {
    console.log('socket close');
});

ws.addEventListener('error', (error) => {
    console.log('socket error', error);
});
```
