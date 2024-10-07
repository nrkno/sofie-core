"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[2469],{52416:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>f,contentTitle:()=>u,default:()=>v,frontMatter:()=>d,metadata:()=>m,toc:()=>x});var i=n(62540),r=n(43023),a=n(63696);const o=.1,s={width:"100%",backgroundSize:"40px 40px",backgroundImage:"linear-gradient(to right, grey 1px, transparent 1px), linear-gradient(to bottom, grey 1px, transparent 1px)",overflowX:"hidden",display:"flex",flexDirection:"column",position:"relative"};function l(){const[e,t]=(0,a.useState)(0),[n,r]=(0,a.useState)(0),[o,l]=(0,a.useState)(0),[d,u]=(0,a.useState)(0),[m,f]=(0,a.useState)(0),[x,g]=(0,a.useState)(0),[v,b]=(0,a.useState)(0),[j,w]=(0,a.useState)(0),P=2400,y=m-j,T=Math.max(o,d)-v,k=Math.max(0,y,T),I=P+k,D={time:0,duration:I+j+e},B={time:0,duration:I+j+n},S={time:0,duration:Math.max(D.duration,B.duration)},O={time:S.time+S.duration-m-Math.max(e,n),duration:m},A={time:I,duration:x},C=2600,N={time:P,duration:C+k},V={time:I+v-o,duration:C+o},W={time:I+v-d,duration:C+d},M={time:I+v+300,duration:200};return(0,i.jsxs)("div",{children:[(0,i.jsxs)("div",{style:s,children:[(0,i.jsx)(c,{...A,name:"In Transition",color:"pink"}),(0,i.jsx)(c,{...O,name:"Out Transition",color:"lightblue"}),(0,i.jsx)(c,{...S,name:"PartGroup A",color:"green"}),(0,i.jsx)(c,{...D,name:"Piece A1",color:"orange"}),(0,i.jsx)(c,{...B,name:"Piece A2",color:"orange"}),(0,i.jsx)(c,{...N,name:"PartGroup B",color:"green"}),(0,i.jsx)(c,{...V,name:"Piece B1",color:"orange"}),(0,i.jsx)(c,{...W,name:"Piece B2",color:"orange"}),(0,i.jsx)(c,{...M,name:"Super B3",color:"orange"}),(0,i.jsx)(h,{time:P,title:"Take time"}),(0,i.jsx)(h,{time:I,title:"Take Delayed"}),(0,i.jsx)(h,{time:I+v,title:"Content Base time"})]}),(0,i.jsxs)("table",{className:"margin-top--md",children:[(0,i.jsx)(p,{label:"Piece B1 Preroll Duration",max:1e3,value:o,setValue:l}),(0,i.jsx)(p,{label:"Piece B2 Preroll Duration",max:1e3,value:d,setValue:u}),(0,i.jsx)(p,{label:"Piece A1 Postroll Duration",max:1e3,value:e,setValue:t}),(0,i.jsx)(p,{label:"Piece A2 Postroll Duration",max:1e3,value:n,setValue:r}),(0,i.jsx)(p,{label:"Part A Out Transition Duration",max:1e3,value:m,setValue:f}),(0,i.jsx)(p,{label:"Part B In Transition Block Duration",max:1e3,value:x,setValue:g}),(0,i.jsx)(p,{label:"Part B In Transition Contents Delay",max:1e3,value:v,setValue:b}),(0,i.jsx)(p,{label:"Part B In Transition Keepalive",max:1e3,value:j,setValue:w})]})]})}function c(e){let{duration:t,time:n,name:r,color:a}=e;return(0,i.jsx)("div",{style:{height:"25px",marginBottom:"2px",whiteSpace:"nowrap",marginLeft:n*o+"px",width:t*o+"px",background:a},children:r})}function h(e){let{time:t,title:n}=e;return(0,i.jsx)("div",{style:{borderLeft:"2px dashed red",display:"inline-block",width:"1px",float:"left",position:"absolute",top:0,height:"100%",marginLeft:t*o+"px"},title:n,children:"\xa0"})}function p(e){let{label:t,max:n,value:r,setValue:a}=e;return(0,i.jsxs)("tr",{children:[(0,i.jsx)("td",{children:t}),(0,i.jsx)("td",{children:(0,i.jsx)("input",{type:"range",min:0,max:n,value:r,onChange:e=>a(parseInt(e.currentTarget.value))})})]})}const d={},u="Part and Piece Timings",m={id:"for-developers/for-blueprint-developers/part-and-piece-timings",title:"Part and Piece Timings",description:"Parts and pieces are the core groups that form the timeline, and define start and end caps for the other timeline objects.",source:"@site/docs/for-developers/for-blueprint-developers/part-and-piece-timings.mdx",sourceDirName:"for-developers/for-blueprint-developers",slug:"/for-developers/for-blueprint-developers/part-and-piece-timings",permalink:"/sofie-core/docs/for-developers/for-blueprint-developers/part-and-piece-timings",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/docs/for-developers/for-blueprint-developers/part-and-piece-timings.mdx",tags:[],version:"current",frontMatter:{},sidebar:"forDevelopers",previous:{title:"Lookahead",permalink:"/sofie-core/docs/for-developers/for-blueprint-developers/lookahead"},next:{title:"Sync Ingest Changes",permalink:"/sofie-core/docs/for-developers/for-blueprint-developers/sync-ingest-changes"}},f={},x=[{value:"The properties",id:"the-properties",level:3},{value:"Concepts",id:"concepts",level:3},{value:"Piece Preroll",id:"piece-preroll",level:4},{value:"In Transition",id:"in-transition",level:4},{value:"Out Transition",id:"out-transition",level:4},{value:"Piece postroll",id:"piece-postroll",level:3},{value:"Autonext",id:"autonext",level:4},{value:"Infinites",id:"infinites",level:4},{value:"Interactive timings demo",id:"interactive-timings-demo",level:3}];function g(e){const t={br:"br",code:"code",h1:"h1",h3:"h3",h4:"h4",p:"p",pre:"pre",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h1,{id:"part-and-piece-timings",children:"Part and Piece Timings"}),"\n",(0,i.jsx)(t.p,{children:"Parts and pieces are the core groups that form the timeline, and define start and end caps for the other timeline objects."}),"\n",(0,i.jsxs)(t.p,{children:["When referring to the timeline in this page, we mean the built timeline objects that is sent to playout-gateway.",(0,i.jsx)(t.br,{}),"\n","It is made of the previous PartInstance, the current PartInstance and sometimes the next PartInstance."]}),"\n",(0,i.jsx)(t.h3,{id:"the-properties",children:"The properties"}),"\n",(0,i.jsx)(t.p,{children:"These are stripped down interfaces, containing only the properties that are relevant for the timeline generation:"}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-ts",children:"export interface IBlueprintPart {\n\t/** Should this item should progress to the next automatically */\n\tautoNext?: boolean\n\t/** How much to overlap on when doing autonext */\n\tautoNextOverlap?: number\n\n\t/** Timings for the inTransition, when supported and allowed */\n\tinTransition?: IBlueprintPartInTransition\n\n\t/** Should we block the inTransition when starting the next Part */\n\tdisableNextInTransition?: boolean\n\n\t/** Timings for the outTransition, when supported and allowed */\n\toutTransition?: IBlueprintPartOutTransition\n\n\t/** Expected duration of the line, in milliseconds */\n\texpectedDuration?: number\n}\n\n/** Timings for the inTransition, when supported and allowed */\nexport interface IBlueprintPartInTransition {\n\t/** Duration this transition block a take for. After this time, another take is allowed which may cut this transition off early */\n\tblockTakeDuration: number\n\t/** Duration the previous part be kept playing once the transition is started. Typically the duration of it remaining in-vision */\n\tpreviousPartKeepaliveDuration: number\n\t/** Duration the pieces of the part should be delayed for once the transition starts. Typically the duration until the new part is in-vision */\n\tpartContentDelayDuration: number\n}\n\n/** Timings for the outTransition, when supported and allowed */\nexport interface IBlueprintPartOutTransition {\n\t/** How long to keep this part alive after taken out  */\n\tduration: number\n}\n\nexport interface IBlueprintPiece {\n\t/** Timeline enabler. When the piece should be active on the timeline. */\n\tenable: {\n\t\tstart: number | 'now' // 'now' is only valid from adlib-actions when inserting into the current part\n\t\tduration?: number\n\t}\n\n\t/** Whether this piece is a special piece */\n\tpieceType: IBlueprintPieceType\n\n\t/// from IBlueprintPieceGeneric:\n\n\t/** Whether and how the piece is infinite */\n\tlifespan: PieceLifespan\n\n\t/**\n\t * How long this piece needs to prepare its content before it will have an effect on the output.\n\t * This allows for flows such as starting a clip playing, then cutting to it after some ms once the player is outputting frames.\n\t */\n\tprerollDuration?: number\n}\n\n/** Special types of pieces. Some are not always used in all circumstances */\nexport enum IBlueprintPieceType {\n\tNormal = 'normal',\n\tInTransition = 'in-transition',\n\tOutTransition = 'out-transition',\n}\n"})}),"\n",(0,i.jsx)(t.h3,{id:"concepts",children:"Concepts"}),"\n",(0,i.jsx)(t.h4,{id:"piece-preroll",children:"Piece Preroll"}),"\n",(0,i.jsxs)(t.p,{children:["Often, a Piece will need some time to do some preparation steps on a device before it should be considered as active. A common example is playing a video, as it often takes the player a couple of frames before the first frame is output to SDI.\nThis can be done with the ",(0,i.jsx)(t.code,{children:"prerollDuration"})," property on the Piece. A general rule to follow is that it should not have any visible or audible effect on the output until ",(0,i.jsx)(t.code,{children:"prerollDuration"})," has elapsed into the piece."]}),"\n",(0,i.jsx)(t.p,{children:"When the timeline is built, the Pieces get their start times adjusted to allow for every Piece in the part to have its preroll time. If you look at the auto-generated pieceGroup timeline objects, their times will rarely match the times specified by the blueprints. Additionally, the previous Part will overlap into the Part long enough for the preroll to complete."}),"\n",(0,i.jsx)(t.p,{children:"Try the interactive to see how the prerollDuration properties interact."}),"\n",(0,i.jsx)(t.h4,{id:"in-transition",children:"In Transition"}),"\n",(0,i.jsx)(t.p,{children:"The in transition is a special Piece that can be played when taking into a Part. It is represented as a Piece, partly to show the user the transition type and duration, and partly to allow for timeline changes to be applied when the timeline generation thinks appropriate."}),"\n",(0,i.jsxs)(t.p,{children:["When the ",(0,i.jsx)(t.code,{children:"inTransition"})," is set on a Part, it will be applied when taking into that Part. During this time, any Pieces with ",(0,i.jsx)(t.code,{children:"pieceType: IBlueprintPieceType.InTransition"})," will be added to the timeline, and the ",(0,i.jsx)(t.code,{children:"IBlueprintPieceType.Normal"})," Pieces in the Part will be delayed based on the numbers from ",(0,i.jsx)(t.code,{children:"inTransition"})]}),"\n",(0,i.jsx)(t.p,{children:"Try the interactive to see how the an inTransition affects the Piece and Part layout."}),"\n",(0,i.jsx)(t.h4,{id:"out-transition",children:"Out Transition"}),"\n",(0,i.jsx)(t.p,{children:"The out transition is a special Piece that gets played when taking out of the Part. It is intended to allow for some 'visual cleanup' before the take occurs."}),"\n",(0,i.jsxs)(t.p,{children:["In effect, when ",(0,i.jsx)(t.code,{children:"outTransition"})," is set on a Part, the take out of the Part will be delayed by the duration defined. During this time, any pieces with ",(0,i.jsx)(t.code,{children:"pieceType: IBlueprintPieceType.OutTransition"})," will be added to the timeline and will run until the end of the Part."]}),"\n",(0,i.jsx)(t.p,{children:"Try the interactive to see how this affects the Parts."}),"\n",(0,i.jsx)(t.h3,{id:"piece-postroll",children:"Piece postroll"}),"\n",(0,i.jsx)(t.p,{children:"Sometimes rather than extending all the pieces and playing an out transition piece on top we want all pieces to stop except for 1, this has the same goal of 'visual cleanup' as the out transition but works slightly different. The main concept is that an out transition delays the take slightly but with postroll the take executes normally however the pieces with postroll will keep playing for a bit after the take."}),"\n",(0,i.jsxs)(t.p,{children:["When the ",(0,i.jsx)(t.code,{children:"postrollDuration"})," is set on a piece the part group will be extended slightly allowing pieces to play a little longer, however any piece that do not have postroll will end at their regular time."]}),"\n",(0,i.jsx)(t.h4,{id:"autonext",children:"Autonext"}),"\n",(0,i.jsxs)(t.p,{children:["Autonext is a way for a Part to be made a fixed length. After playing for its ",(0,i.jsx)(t.code,{children:"expectedDuration"}),", core will automatically perform a take into the next part. This is commonly used for fullscreen videos, to exit back to a camera before the video freezes on the last frame. It is enabled by setting the ",(0,i.jsx)(t.code,{children:"autoNext: true"})," on a Part, and requires ",(0,i.jsx)(t.code,{children:"expectedDuration"})," to be set to a duration higher than ",(0,i.jsx)(t.code,{children:"1000"}),"."]}),"\n",(0,i.jsxs)(t.p,{children:["In other situations, it can be desirable for a Part to overlap the next one for a few seconds. This is common for Parts such as a title sequence or bumpers, where the sequence ends with an keyer effect which should reveal the next Part.\nTo achieve this you can set ",(0,i.jsx)(t.code,{children:"autoNextOverlap: 1000 // ms"})," to make the parts overlap on the timeline. In doing so, the in transition for the next Part will be ignored."]}),"\n",(0,i.jsxs)(t.p,{children:["The ",(0,i.jsx)(t.code,{children:"autoNextOverlap"})," property can be thought of an override for the intransition on the next part defined as:"]}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-ts",children:"const inTransition = {\n\tblockTakeDuration: 1000,\n\tpartContentDelayDuration: 0,\n\tpreviousPartKeepaliveDuration: 1000,\n}\n"})}),"\n",(0,i.jsx)(t.h4,{id:"infinites",children:"Infinites"}),"\n",(0,i.jsxs)(t.p,{children:["Pieces with an infinite lifespan (ie, not ",(0,i.jsx)(t.code,{children:"lifespan: PieceLifespan.WithinPart"}),") get handled differently to other pieces."]}),"\n",(0,i.jsxs)(t.p,{children:["Only one pieceGoup is created for an infinite Piece which is present in multiple of the current, next and previous Parts.",(0,i.jsx)(t.br,{}),"\n","The Piece calculates and tracks its own started playback times, which is preserved and reused in future takes. On the timeline it lives outside of the partGroups, but still gets the same caps applied when appropriate."]}),"\n",(0,i.jsx)(t.h3,{id:"interactive-timings-demo",children:"Interactive timings demo"}),"\n",(0,i.jsx)(t.p,{children:"Use the sliders below to see how various Preroll and In & Out Transition timing properties interact with each other."}),"\n",(0,i.jsx)(l,{})]})}function v(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(g,{...e})}):g(e)}},43023:(e,t,n)=>{n.d(t,{R:()=>o,x:()=>s});var i=n(63696);const r={},a=i.createContext(r);function o(e){const t=i.useContext(a);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function s(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:o(e.components),i.createElement(a.Provider,{value:t},e.children)}}}]);