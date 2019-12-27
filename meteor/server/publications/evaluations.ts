import { EvaluationsSecurity } from '../security/evaluations';
import { Evaluations } from '../../lib/collections/Evaluations';
import { meteorPublish } from './lib';
import { PubSub } from '../../lib/api/pubsub';

meteorPublish(PubSub.evaluations, (selector) => {
	if (EvaluationsSecurity.allowReadAccess({}, this)) {
		return Evaluations.find(selector);
	}
	return null;
});
