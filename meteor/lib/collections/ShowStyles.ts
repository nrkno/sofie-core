import { Mongo } from 'meteor/mongo';

export interface ShowStyle {
  _id: String,
  name: String,
  splitConfigurations: Array<object>,
  graphicsTemplates: Array<object>,
  wipesAndBumpers: Array<object>,
  logicalSegmentLineItems: Array<object>
}

export const ShowStyles = new Mongo.Collection<ShowStyle>('showStyles');
