# HOLD

HOLD is a feature in Sofie to allow for a special form of take between two parts. It allows for the new part to start with some portions of the old part being retained, with the next 'take' stopping the remaining portions of the old part and not performing a true take.

For example, it could be setup to hold back the video when going between two clips. The first take would start the audio from the second clip, but keep the video from the first clip. The second take would stop the first clip, and show the video for the second clip.

## Flow

While HOLD is active or in progress, an indicator is shown in the header of the UI.  
![HOLD in Rundown View header](/img/docs/rundown-header-hold.png)

It is not possible to run any adlibs while a hold is active, or to change the nexted part. Once it is in progress, it is not possible to abort or cancel the HOLD and it must be run to completion. If the second part has an autonext and that gets reached before the HOLD is completed, the HOLD will be treated as completed and the autonext will execute as normal.

When the part to be held is playing, with the correct part as next, the flow for the users is:

- Activate HOLD (By hotkey or other source)
- Perform a take into the HOLD
- Perform a take to complete the HOLD

Before the first take in the HOLD, it can be cancelled in the same way it was activated.

## Supporting HOLD in blueprints

The functionality here is a bit limited, as it was originally written for one situation and has not been expanded to support more complex scenarios.
Some unanswered questions we have are:

- Should HOLD be rewritten to be done with adlib-actions instead to allow for more complex scenarios?
- Should there be a way to more intelligently check if HOLD can be done between two Parts? (perhaps a new blueprint method?)

The blueprints have to label parts as supporting HOLD.  
You can do this with the [`holdMode`](https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintPart.html#holdMode) property, and labelling it possible to HOLD from or to the part.

Note: If the user manipulates what part is set as next, they will be able to do a HOLD between parts that are not sequential in the Rundown.

You also have to label Pieces as something to extend into the HOLD. Not every piece will be wanted, so it is opt-in.  
You can do this with the [`extendOnHold`](https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintPiece.html#extendOnHold) property. The pieces will get extended in the same way as infinite pieces, but limited to only be extended into the one part. The usual piece collision and priority logic applies.

Finally, you may find that there are some timeline objects that you don't want to use inside of the extended pieces, or there are some objects in the part that you don't want active while the HOLD is.  
You can mark an object with the [`holdMode`](https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.TimelineObjectCoreExt.html#holdMode) property to specify its presence during a HOLD.  
The `HoldMode.ONLY` mode tells the object to only be used when in a HOLD, which allows for doing some overrides in more complex scenarios.