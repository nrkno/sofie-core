import { objectToXml } from '../xml/creator.js'

export { create }

function create({ title, guid, clipFrameCount }) {
	return objectToXml(
		{
			ncsItem: {
				item: {
					itemID: 2,
					itemSlug: title,
					objID: guid,
					mosID: 'quantelplugin.sofie',
					mosPlugInID: 'Sofie.QuantelPlugin',
					mosAbstract: {},
					objPaths: {
						objPath: {
							['@techDescription']: 'Quantel clip',
							['#textContent']: guid
						}
					},
					itemEdDur: clipFrameCount,
					mosExternalMetadata: {}
				}
			}
		},
		'mos'
	)
}

/*
<mos>
  <ncsItem>
    <item>
      <itemID>2</itemID>
<itemSlug>[FILENAME HERE]</itemSlug>
<objID>[CLIP GUID HERE]</objID> 
<mosID>quantelplugin.sofie</mosID>
<mosPlugInID>Sofie.QuantelPlugin</mosPlugInID>
<mosAbstract></mosAbstract>
<objPaths>
        <objPath techDescription="Quantel clip">[QUANTEL GUID HERE]</objPath>
      </objPaths>
<itemEdDur>[CLIP DURATION IN FRAMES?]</itemEdDur>
<mosExternalMetadata>
</mosExternalMetadata>
    </item>
  </ncsItem>
</mos>
*/
