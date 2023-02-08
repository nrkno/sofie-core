# AB Playback

:::caution
This page talks about various sections that are in NRK's blueprints which are not yet public. Other blueprints (such as those from [TV 2 Danmark](https://github.com/tv2/sofie-blueprints-inews)) make use of AB playback, but may not match up completely with what is documented here.  
We are looking into pushing more of this logic into Sofie to aid reusability.
:::

_AB Playback_ is a common technique for clip playback. The aim is to be able to play multiple clips back to back, alternating which player is used for each clip.  
At first glance it sounds simple to handle, but it quickly becomes complicated when we consider the need to allow users to run adlibs and that the system needs to seamlessly update pre-programmed clips when this happens.

To avoid this problem, we take an approach of simply labelling pieces as needing an AB assignment and leaving timeline objects to have some unresolved values during the ingest blueprint operations, and use the `onTimelineGenerate` blueprint function to do the assignment and modify the timeline as needed at the time of playout.

There are other challenges to think about too:

- Users get confused if the player of a clip changes without a reason
- Reloading an already loaded clip can be costly, so should be avoided when possible
- Adlibbing a clip, or changing what Part is nexted can result in needing to move what player a clip has assigned
- Postroll or preroll is often needed
- Some studios can have less players available than ideal. (eg, going back to back between two clips, and a clip is playing on the studio monitor)

## Defining

:::info
This method of defining sessions is just a suggestion, it could be done in many other ways depending on how you wish to implement it.
:::

As AB playback is currently mostly blueprints driven, Sofie Core is unaware of which pieces want AB playback. Instead, we track AB session requests in the `metaData` field on each Piece using the structure:

```ts
export interface AbSessionInfo {
	name: string
	pool: AbSessionPool
	optional?: boolean
}

export interface IPieceMetaData {
	abSessions?: AbSessionInfo[]
	// Unrelated properties here
}
```

This allows each piece to request multiple AB sessions, with the information we need about each session. In the simplest form, `pool` and `optional` are not required. `pool` allows us to have multiple AB pools for different purposes (eg clips and DVE channels). `optional` allows us to know that it is safe to ignore this request if there is no available player. For example, if there are not enough players to allocate one to the studio monitor, it can be left on the holding loop.

`name` is used as an identifier for this session. It is used to allow for multiple sessions to exist in the same Piece or Part, while being able to match up Pieces which should be using the same session. Make sure you don't reuse a name accidentally within a Segment, or it will be treated as the same session.

In addition to labelling the pieces, we are labelling the timeline objects which are affected by this too. This allows us to easily update any affected timeline objects with generic logic.  
This is done in a similar way to Pieces, using the `metaData` property on the objects:

```ts
export interface TimelineObjectMetaData {
	abSessions?: Omit<AbSessionInfo, 'optional'>[]
}
```

The value of these sessions must match one of those used by the Piece, or our logic will not create the needed session for the object.

If you are defining an object which needs to target a different layer mapping depending on which layer is chosen, we put these objects on a `pending` layer. For the pool of `casparcg_player_clip_1` and `casparcg_player_clip_2`, all our objects get generated for the abstract layer `casparcg_player_clip_pending`. It is on this pending layer that we enable lookahead, not the real layers. This allows lookahead to run, and the resulting objects get handled by our AB resolving logic below.

## Resolving

Resolving is done as a multi-stage process. At each stage we only consider one AB pool at a time, processing each in turn.

1. Build an array of all the requested sessions
2. Resolve the sessions
3. Apply the result

Finding all the requested sessions is a fairly straight-forward process, and is checking the `abSessions` property inside the `metaData` for each Piece.  
To do this we convert each session `name` into an id with `context.getPieceABSessionId()`. This is a method provided by core to help make a persistent id, while allowing for the id to change when playing Parts out of order. We then track the bounds needed for each sessionId, considering that the session may span multiple Pieces which might overlap or might be disconnected.  
We also create sessions for each of the lookahead objects that are in the timeline with a session request, making sure to order them by their priority. We use `context.getTimelineObjectAbSessionId()` to generate the sessionId for these objects. The sessionId will be remembered through to when we have a PieceInstance for the object and can use `context.getPieceABSessionId()`.

Next up is assigning each session to a player. We prepare by re-assigning any session which is currently on air (or will be within a couple of seconds) the same value as last time we ran. To persist this we make use of `TimelinePersistentState` that is available to `onTimelineGenerate`. This ensures that anything currently playing doesnt move player unexpectedly. Anything which has no chance of being preloaded or being played yet has any existing assignment removed.  
Any sessions which clash or collide with an on-air session are also cleared.

Then we iterate through each pending session, in the order they will start in. There are a load of checks here, to choose a player which has been refined over time and a lot of experimentation, which are not worth attempting to describe here.  
We run a limited number of iterations here, as it is possible for it to clear the session assigned to another player in certain conditions. And crucially, if both players are good candidates, we go with the player we chose last time (as recorded in `TimelinePersistentState`) to avoid confusion from users.
Once all the Piece bases sessions have been allocated, we assign a lookahead to each player to be used once its sessions have finished. We expect to not have enough players for each lookahead.

Now we are ready to track the result on the new `TimelinePersistentState` and apply the result to the timeline.

## Applying the result

Now that all the AB sessions are resolved, and we know what player to use for each Piece we can update the timeline objects to reflect this.

To make this as simple and generic as possible, we developed a shortcut to achieving this by using keyframes.

For example, ingest will create the following object intended to put the clip on air:

```ts
let obj = {
	id: id || '',
	enable: { start: 0 },
	layer: 'atem_me_program',
	content: {
		deviceType: TSR.DeviceType.ATEM,
		type: TSR.TimelineContentTypeAtem.ME,
		me: {
			input: 0, // fallback
			transition: TSR.AtemTransitionStyle.CUT,
		},
	},
	keyframes: [
		{
			id: `mp_1`,
			enable: { while: '1' },
			disabled: true,
			content: {
				input: 10,
			},
			preserveForLookahead: true,
			metaData: {
				abSession: {
					pool: 'clip',
					index: 1,
				},
			},
		},
		{
			id: `mp_2`,
			enable: { while: '1' },
			disabled: true,
			content: {
				input: 11,
			},
			preserveForLookahead: true,
			metaData: {
				abSession: {
					pool: 'clip',
					index: 2,
				},
			},
		},
	],
	metaData: {
		abSessions: [
			{
				pool: 'clip',
				name: 'abcdef',
			},
		],
	},
}
```

This object is long, but by using keyframes we have defined how to modify it for each AB player that it could be assigned to. By looking at the `abSession` inside `metaData` for each keyframe, we can determine if the keyframe is for the player it was assigned. If the keyframe matches, we unset the `disabled` property, and that is it.  
The main benefit here is that everything needed to handle AB for this object is defined at the time the Piece was created.

While this works in some cases, it does not work in others. For example, it does not let us correctly direct the object playing the clip to the correct player as that requires changing the `layer` property of the object.

Instead we solve this by having a simple lookup table defining how to translate different layers.
For casparcg this looks like:

```ts
interface MoveRule {
	pools: AbSessionPool[]
	newLayer: (playerId: number) => string
	allowsLookahead: boolean
}

const MOVABLE_LAYERS: {
	[layer: string]: MoveRule | undefined
} = {
	['casparcg_player_clip_pending']: {
		pools: [AbSessionPool.CLIP],
		newLayer: (i: number) => `casparcg_player_clip_${i}`,
		allowsLookahead: true,
	},
}
```

Notice that this is also using the `casparcg_player_clip_pending` layer as we described above. After this step, the objects are now on the correct layers to be consumed by playout-gateway.

Finally, we have some very custom logic to handle some layers that need properties to be changed deep inside their content. This is a hack and may no longer be necessary. We would encourage avoiding this if possible.
