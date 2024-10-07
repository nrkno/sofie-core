"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[6529],{35900:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>h,frontMatter:()=>r,metadata:()=>s,toc:()=>c});var i=n(62540),a=n(43023);const r={},o="Timeline Datastore",s={id:"for-developers/for-blueprint-developers/timeline-datastore",title:"Timeline Datastore",description:"The timeline datastore is a key-value store that can be used in conjuction with the timeline. The benefit of modifying values in the datastore is that the timings in the timeline are not modified so we can skip a lot of complicated calculations which reduces the system response time. An example usecase of the datastore feature is a fastpath for cutting cameras.",source:"@site/versioned_docs/version-1.46.0/for-developers/for-blueprint-developers/timeline-datastore.md",sourceDirName:"for-developers/for-blueprint-developers",slug:"/for-developers/for-blueprint-developers/timeline-datastore",permalink:"/sofie-core/docs/1.46.0/for-developers/for-blueprint-developers/timeline-datastore",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.46.0/for-developers/for-blueprint-developers/timeline-datastore.md",tags:[],version:"1.46.0",frontMatter:{},sidebar:"forDevelopers",previous:{title:"Part and Piece Timings",permalink:"/sofie-core/docs/1.46.0/for-developers/for-blueprint-developers/part-and-piece-timings"},next:{title:"Applications & Libraries",permalink:"/sofie-core/docs/1.46.0/for-developers/libraries"}},l={},c=[{value:"API",id:"api",level:2},{value:"Timeline API",id:"timeline-api",level:3},{value:"Timeline API example",id:"timeline-api-example",level:3},{value:"Blueprints API",id:"blueprints-api",level:3},{value:"Example use case: camera cutting fast path",id:"example-use-case-camera-cutting-fast-path",level:2}];function d(e){const t={code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",li:"li",ol:"ol",p:"p",pre:"pre",ul:"ul",...(0,a.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h1,{id:"timeline-datastore",children:"Timeline Datastore"}),"\n",(0,i.jsx)(t.p,{children:"The timeline datastore is a key-value store that can be used in conjuction with the timeline. The benefit of modifying values in the datastore is that the timings in the timeline are not modified so we can skip a lot of complicated calculations which reduces the system response time. An example usecase of the datastore feature is a fastpath for cutting cameras."}),"\n",(0,i.jsx)(t.h2,{id:"api",children:"API"}),"\n",(0,i.jsx)(t.p,{children:"In order to use the timeline datastore feature 2 API's are to be used. The timeline object has to contain a reference to a key in the datastore and the blueprints have to add a value for that key to the datastore. These references are added on the content field."}),"\n",(0,i.jsx)(t.h3,{id:"timeline-api",children:"Timeline API"}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-ts",children:"/**\n * An object containing references to the datastore\n */\nexport interface TimelineDatastoreReferences {\n\t/**\n\t * localPath is the path to the property in the content object to override\n\t */\n\t[localPath: string]: {\n\t\t/** Reference to the Datastore key where to fetch the value */\n\t\tdatastoreKey: string\n\t\t/**\n\t\t * If true, the referenced value in the Datastore is only applied after the timeline-object has started (ie a later-started timeline-object will not be affected)\n\t\t */\n\t\toverwrite: boolean\n\t}\n}\n"})}),"\n",(0,i.jsx)(t.h3,{id:"timeline-api-example",children:"Timeline API example"}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-ts",children:"const tlObj = {\n\tid: 'obj0',\n\tenable: { start: 1000 },\n\tlayer: 'layer0',\n\tcontent: {\n\t\tdeviceType: DeviceType.Atem,\n\t\ttype: TimelineObjectAtem.MixEffect,\n\n\t\t$references: {\n\t\t\t'me.input': {\n\t\t\t\tdatastoreKey: 'camInput',\n\t\t\t\toverwrite: true,\n\t\t\t},\n\t\t},\n\n\t\tme: {\n\t\t\tinput: 1,\n\t\t\ttransition: TransitionType.Cut,\n\t\t},\n\t},\n}\n"})}),"\n",(0,i.jsx)(t.h3,{id:"blueprints-api",children:"Blueprints API"}),"\n",(0,i.jsx)(t.p,{children:"Values can be added and removed from the datastore through the adlib actions API."}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-ts",children:"interface DatastoreActionExecutionContext {\n\tsetTimelineDatastoreValue(key: string, value: unknown, mode: DatastorePersistenceMode): Promise<void>\n\tremoveTimelineDatastoreValue(key: string): Promise<void>\n}\n\nenum DatastorePersistenceMode {\n\tTemporary = 'temporary',\n\tindefinite = 'indefinite',\n}\n"})}),"\n",(0,i.jsx)(t.p,{children:"The data persistence mode work as follows:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsx)(t.li,{children:"Temporary: this key-value pair may be cleaned up if it is no longer referenced to from the timeline, in practice this will currently only happen during deactivation of a rundown"}),"\n",(0,i.jsxs)(t.li,{children:["This key-value pair may ",(0,i.jsx)(t.em,{children:"not"})," be automatically removed (it can still be removed by the blueprints)"]}),"\n"]}),"\n",(0,i.jsxs)(t.p,{children:["The above context methods may be used from the usual adlib actions context but there is also a special path where none of the usual cached data is available, as loading the caches may take some time. The ",(0,i.jsx)(t.code,{children:"executeDataStoreAction"})," method is executed just before the ",(0,i.jsx)(t.code,{children:"executeAction"})," method."]}),"\n",(0,i.jsx)(t.h2,{id:"example-use-case-camera-cutting-fast-path",children:"Example use case: camera cutting fast path"}),"\n",(0,i.jsx)(t.p,{children:"Assuming a set of blueprints where we can cut camera's a on a vision mixer's mix effect by using adlib pieces, we want to add a fast path where the camera input is changed through the datastore first and then afterwards we add the piece for correctness."}),"\n",(0,i.jsxs)(t.ol,{children:["\n",(0,i.jsxs)(t.li,{children:["If you haven't yet, convert the current camera adlibs to adlib actions by exporting the ",(0,i.jsx)(t.code,{children:"IBlueprintActionManifest"})," as part of your ",(0,i.jsx)(t.code,{children:"getRundown"})," implementation and implementing an adlib action in your ",(0,i.jsx)(t.code,{children:"executeAction"})," handler that adds your camera piece."]}),"\n",(0,i.jsx)(t.li,{children:"Modify any camera pieces (including the one from your adlib action) to contain a reference to the datastore (See the timeline API example)"}),"\n",(0,i.jsxs)(t.li,{children:["Implement an ",(0,i.jsx)(t.code,{children:"executeDataStoreAction"})," handler as part of your blueprints, when this handler receives the action for your camera adlib it should call the ",(0,i.jsx)(t.code,{children:"setTimelineDatastoreValue"})," method with the key you used in the timeline object (In the example it's ",(0,i.jsx)(t.code,{children:"camInput"}),"), the new input for the vision mixer and the ",(0,i.jsx)(t.code,{children:"DatastorePersistenceMode.Temporary"})," persistence mode."]}),"\n"]})]})}function h(e={}){const{wrapper:t}={...(0,a.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}},43023:(e,t,n)=>{n.d(t,{R:()=>o,x:()=>s});var i=n(63696);const a={},r=i.createContext(a);function o(e){const t=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function s(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:o(e.components),i.createElement(r.Provider,{value:t},e.children)}}}]);