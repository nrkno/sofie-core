import { getCoreSystemCursor } from '../../lib/collections/CoreSystem';
import { meteorPublish } from './lib';
import { PubSub } from '../../lib/api/pubsub';

meteorPublish(PubSub.coreSystem, (selector) => {
	return getCoreSystemCursor();
});
