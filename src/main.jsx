import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import demoData from './data/journey_demo_data.json';

const WALK_SPEED = 12;
const PLACE_FALLBACK = [
  ['Gandhinagar Sector 21',23.2247,72.6478], ['GIFT City',23.1630,72.6844],
  ['CG Road',23.0300,72.5580], ['Kalupur Railway Station',23.02796,72.59982],
  ['Ahmedabad Airport',23.0729,72.6347], ['Infocity',23.1902,72.6350]
];

function hav(a,b){const x=(a.lat-b.lat)*111,y=(a.lon-b.lon)*102;return Math.sqrt(x*x+y*y)}
function norm(s=''){return s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function fmt(m){m=Math.round(m);return m<60?`${m} min`:`${Math.floor(m/60)}h ${m%60?m%60+'m':''}`}
function edgeWait(data,e,lastRoute){if(e[3]==='walk'||lastRoute===e[5])return 0;if(e[3]==='metro')return 4;const h=data.headways?.[`${e[4]}|${e[5]}`]||20;return Math.min(25,Math.max(2,Math.round(h/2)))}

function normalizeData(data){
  if(data.nodes && data.edges) return data;
  const nodes=(data.stops||[]).map((s,i)=>({id:s[0],name:s[1],lat:s[2],lon:s[3],kind:'bus',idx:i}));
  const metroCoords={
    'AMM_GNLU':[23.1878,72.6276],
    'AMM_INFOCITY':[23.1902,72.6350],
    'AMM_GIFT_CITY':[23.1630,72.6844]
  };
  const metroNodes=(data.metroStops||[]).map(s=>({
    id:s[0],name:s[1],lat:s[2]??metroCoords[s[0]]?.[0],lon:s[3]??metroCoords[s[0]]?.[1],kind:'metro',line:s[4]
  }));
  const all=[...nodes,...metroNodes];
  const byIndex=nodes;
  const edges=[];

  // Bus edges are supplied as directed stop-to-stop segments.
  for(const e of (data.busEdges||[])){
    const a=byIndex[e[0]],b=byIndex[e[1]];
    if(a&&b) edges.push([a.id,b.id,e[2],'bus',e[3],e[4]]);
  }

  // Build a complete Metro graph from the published station ordering.
  const metroLine=Object.fromEntries(metroNodes.map(n=>[n.id,n.line]));
  const lineIds=[...new Set(metroNodes.flatMap(n=>(n.line||'').split(';').filter(Boolean)))];
  for(const line of lineIds){
    const seq=metroNodes.filter(n=>(n.line||'').split(';').includes(line));
    for(let i=0;i<seq.length-1;i++){
      const a=seq[i],b=seq[i+1];
      const minutes=(Number.isFinite(a.lat)&&Number.isFinite(b.lat)) ? Math.max(2,Math.round(hav(a,b)*2.4)) : 4;
      edges.push([a.id,b.id,minutes,'metro',line,line]);
      edges.push([b.id,a.id,minutes,'metro',line,line]);
    }
  }

  // Preserve the supplied Metro segment estimates as well.
  for(const e of (data.metroEdges||[])){
    const line=metroLine[e[0]]||'Metro';
    edges.push([e[0],e[1],e[2],'metro',line,line]);
  }

  // Add walking links between nearby bus and Metro stops. This is the missing
  // multimodal connection in the raw demo graph: without these links a bus
  // journey can never transfer to Metro (or vice versa).
  const buses=nodes.filter(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lon));
  const metros=metroNodes.filter(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lon));
  for(const b of buses){
    for(const m of metros){
      const d=hav(b,m);
      if(d<=0.9){
        const mins=Math.max(1,Math.ceil(d/WALK_SPEED*60));
        edges.push([b.id,m.id,mins,'walk','WALK','walk']);
        edges.push([m.id,b.id,mins,'walk','WALK','walk']);
      }
    }
  }

  return {...data,nodes:all,edges,places:PLACE_FALLBACK};
}
function createRouter(raw){
  const data=normalizeData(raw);
  const N=data.nodes||[];
  const E=data.edges||[];
  const places=data.places||PLACE_FALLBACK;
  const byId=Object.fromEntries(N.map(n=>[n.id,n]));
  function resolve(input,gps){
    const raw=String(input||'').trim();
    if(raw==='My current location'&&gps)return {name:raw,...gps};
    const q=norm(raw); if(!q)return null;
    // Exact station/stop matches always win over a similarly named generic place.
    const exactNode=N.find(n=>norm(n.name)===q || norm(n.name.replace(/\s+(metro\s+)?station$/i,''))===q);
    if(exactNode)return {name:exactNode.name,lat:exactNode.lat,lon:exactNode.lon,node:exactNode};
    let best=null,bs=0;
    for(const n of N){
      const nn=norm(n.name);
      const sc=nn===q?110:(nn.startsWith(q+' ')||q.startsWith(nn+' ')?76:(nn.includes(q)||q.includes(nn)?62:0));
      if(sc>bs){bs=sc;best={name:n.name,lat:n.lat,lon:n.lon,node:n}}
    }
    for(const p of places){
      const pn=norm(p[0]);
      const sc=pn===q?100:(pn.startsWith(q+' ')||q.startsWith(pn+' ')?78:(pn.includes(q)||q.includes(pn)?65:0));
      if(sc>bs){bs=sc;best={name:p[0],lat:p[1],lon:p[2]}}
    }
    return best;
  }
  function nearestCandidates(pt,maxDist=4,limit=10){
    return N.map(n=>({node:n,dist:(n.lat==null||n.lon==null)?Infinity:hav(pt,n)}))
      .filter(x=>Number.isFinite(x.dist)&&x.dist<=maxDist)
      .sort((x,y)=>x.dist-y.dist).slice(0,limit);
  }
  function findRoutes(fromQ,toQ,pref,gps){
    const a=resolve(fromQ,gps),b=resolve(toQ,gps);if(!a||!b)return [];
    const sources=a.node?[{node:a.node,dist:0}]:nearestCandidates(a);
    const targets=b.node?[{node:b.node,dist:0}]:nearestCandidates(b);
    if(!sources.length||!targets.length)return [];
    const targetAccess=new Map(targets.map(t=>[t.node.id,t.dist*WALK_SPEED]));
    const adj=Object.fromEntries(N.map(n=>[n.id,[]]));
    for(const e of E)if(adj[e[0]])adj[e[0]].push(e);
    const results=[];
    for(const source of sources){
      const s=source.node,initial=source.dist*WALK_SPEED;
      const dist=new Map(),prev=new Map(),pq=[[initial,s.id,null]];
      dist.set(s.id+'|',initial);
      let bestGoal=null;
      while(pq.length){
        pq.sort((x,y)=>x[0]-y[0]);
        const [cost,u,lastRoute]=pq.shift();
        const key=u+'|'+(lastRoute||'');
        if(cost>(dist.get(key)??Infinity)+1e-6)continue;
        const access=targetAccess.get(u);
        if(access!==undefined){
          const total=cost+access;
          if(!bestGoal||total<bestGoal.total)bestGoal={total,cost,u,lastRoute,access,key};
        }
        if(bestGoal&&cost>=bestGoal.total)continue;
        for(const e of (adj[u]||[])){
          const wait=edgeWait(data,e,lastRoute),nc=cost+e[2]+wait,nr=e[5]||lastRoute,nkey=e[1]+'|'+(nr||'');
          if(nc<(dist.get(nkey)??Infinity)){dist.set(nkey,nc);prev.set(nkey,[key,e]);pq.push([nc,e[1],nr])}
        }
      }
      if(!bestGoal)continue;
      let key=bestGoal.key,legs=[];
      while(prev.has(key)){const [pk,e]=prev.get(key);legs.push(e);key=pk}
      legs.reverse();
      const walkScore=initial+bestGoal.access+legs.filter(e=>e[3]==='walk').reduce((sum,e)=>sum+e[2],0);
      const walkDisplay=legs.filter(e=>e[3]==='walk').reduce((sum,e)=>sum+e[2],0);
      let grouped=[];
      for(const e of legs){
        const type=e[3],label=type==='metro'?'Metro':type==='walk'?'Walk':(e[4]==='AJL'?'BRTS':e[4]==='GTSL'?'GTSL':'AMTS'),route=e[5];
        const last=grouped.at(-1);
        if(last&&last.type===type&&last.route===route){last.mins+=e[2];last.to=byId[e[1]]?.name||e[1]}
        else grouped.push({type,label,route,mins:e[2],from:byId[e[0]]?.name||e[0],to:byId[e[1]]?.name||e[1]});
      }
      const transfers=Math.max(0,grouped.filter(x=>x.type!=='walk').length-1);
      const score=bestGoal.total+(pref==='walk'?walkScore*1.8:pref==='transfer'?transfers*8:pref==='cheap'?transfers*3:0);
      results.push({score,total:Math.round(bestGoal.total),walk:Math.round(walkDisplay),transfers,legs:grouped,source:s.id});
    }
    // Several nearby access stops can yield the same itinerary; retain the best unique ones.
    results.sort((x,y)=>x.score-y.score);
    const unique=[],seen=new Set();
    for(const r of results){
      // Deduplicate on transit-only legs so that routes with the same metro/bus journey
      // but a slightly different access walk are not shown as separate options.
      const transitLegs=r.legs.filter(l=>l.type!=='walk');
      const sig=transitLegs.length
        ? transitLegs.map(l=>`${l.type}:${l.route}:${l.from}>${l.to}`).join('|')
        : r.legs.map(l=>`${l.type}:${l.route}:${l.from}>${l.to}`).join('|');
      if(!seen.has(sig)){seen.add(sig);unique.push(r)}
      if(unique.length===3)break
    }
    return unique;
  }
  return {findRoutes,places,N};
}

function App(){
  const [data]=useState(demoData),[from,setFrom]=useState(''),[to,setTo]=useState(''),[pref,setPref]=useState('fast');
  const [results,setResults]=useState([]),[status,setStatus]=useState('Choose an origin and destination');
  const [prompt,setPrompt]=useState(''),[insight,setInsight]=useState(''),[gps,setGps]=useState(null),[error,setError]=useState('');
  const [activeChip,setActiveChip]=useState(null),[loading,setLoading]=useState(false);
  const router=useMemo(()=>data?createRouter(data):null,[data]);
  const stats=data?.meta||{};
  const run=(f=from,t=to,p=pref)=>{
    if(!router)return;
    if(!f||!t){setResults([]);setStatus('Enter both locations or choose an example');return}
    setLoading(true);
    setTimeout(()=>{
      const r=router.findRoutes(f,t,p,gps);
      setResults(r);
      setStatus(`${r.length} option${r.length===1?'':'s'} · offline routing`);
      setLoading(false);
    },0);
  };
  const gpsClick=()=>{if(!navigator.geolocation){setError('Geolocation is not supported by this browser.');return}navigator.geolocation.getCurrentPosition(pos=>{setGps({lat:pos.coords.latitude,lon:pos.coords.longitude});setFrom('My current location');setStatus('GPS location captured');},()=>setError('Location permission was not granted.'))};
  const examples=[['Gandhinagar Sector 21','GIFT City'],['Gandhinagar Sector 21','CG Road'],['Kalupur Railway Station','GIFT City'],['Ahmedabad Airport','GIFT City']];
  const interpret=()=>{const n=norm(prompt);let dest='GIFT City',p='fast';for(const x of router?.places||[])if(n.includes(norm(x[0])))dest=x[0];if(/less walk|little walk|minimum walking/.test(n))p='walk';if(/fewest|minimum transfers/.test(n))p='transfer';const tm=prompt.match(/before\s+(\d{1,2})(?::(\d{2}))?/);setTo(dest);setPref(p);setInsight(<><b>Interpreted request</b><br/>Destination: {dest}<br/>Preference: {p==='walk'?'less walking':p==='transfer'?'fewer transfers':'fastest'}{tm?<><br/>Arrival target: {tm[1]}{tm[2]?':'+tm[2]:''}</>:<><br/>Time target not yet used for ranking.</>}<br/><br/><span>This local intent parser is a stand-in for the future LLM layer.</span></>)};
  return <main className="app"><header className="hero"><div><div className="eyebrow">Responsive React prototype · Ahmedabad & Gandhinagar</div><h1>One Journey.<br/><em>Four networks.</em></h1><p>Plan across <b>Metro + AMTS + BRTS + GTSL</b> from one place. The routing core is deterministic and works from the supplied offline transit dataset.</p></div><div className="live-badge"><i></i>Offline timetable engine</div></header>
    {error&&<div className="error">{error}<button onClick={()=>setError('')}>×</button></div>}
    <section className="search-card"><div className="search-grid"><Field label="From" value={from} onChange={v=>{setFrom(v);setActiveChip(null)}} placeholder="Sector 21, GIFT City, current location" action={gpsClick}/><Field label="To" value={to} onChange={v=>{setTo(v);setActiveChip(null)}} placeholder="CG Road, Infocity, Airport"/><button className="primary search-button" onClick={()=>run()}>Find best journey <span>→</span></button></div>
      <div className="chips">{examples.map(([a,b],i)=><button key={a+b} className={activeChip===i?'active':''} onClick={()=>{setActiveChip(i);setFrom(a);setTo(b);run(a,b,pref)}}>{a.replace('Gandhinagar ','')} → {b}</button>)}</div>
      <div className="preferences"><span>Optimize for</span>{[['fast','Fastest'],['walk','Less walking'],['transfer','Fewer transfers'],['cheap','Lower fare*']].map(([v,l])=><button className={pref===v?'selected':''} key={v} onClick={()=>{setPref(v);if(from&&to)run(from,to,v)}}>{l}</button>)}<small>* Fare comparison is limited by the published prototype dataset.</small></div>
    </section>
    <div className="content"><section className="journeys"><div className="section-head"><h2>Recommended journeys</h2><span>{loading?'Calculating…':status}</span></div>{loading?<div className="calculating"><div className="calc-bar"><div className="calc-fill"/></div><span>Finding best routes…</span></div>:!results.length?<div className="empty"><div className="empty-icon">↗</div><b>Start with a journey</b><p>Try one of the examples above. The router considers walking access, route headways, transfers and the supplied Metro timetable structure.</p></div>:results.map((r,i)=><RouteCard key={i} route={r} best={i===0}/>)}</section>
      <aside><div className="assistant"><div className="assistant-kicker">AI LAYER · PROTOTYPE</div><h3>Describe your journey</h3><p>Use plain language such as “Reach GIFT City before 9, little walking”.</p><div className="ai-row"><input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&interpret()} placeholder="Reach GIFT City before 9…"/><button onClick={interpret}>Interpret</button></div>{insight&&<div className="insight">{insight}</div>}</div>
        <div className="stats"><Stat n={stats.selectedBusStops||619} t="bus stops"/><Stat n={stats.busEdges||8529} t="bus connections"/><Stat n={stats.metroStops||53} t="Metro stations"/><Stat n="4" t="networks"/></div>
        <div className="boundary"><b>Prototype boundary</b><p>Bus routing uses the supplied GTFS stop sequences with median segment times and route headways. Metro routing uses the supplied GMRC timetable data. This is schedule-based, not live vehicle tracking.</p></div>
      </aside></div>
    <footer>Built as a responsive React/Vite prototype. GPS is requested only after user permission. The next routing iteration can add true time-dependent departures for “leave at 8:15” and “arrive before 9”.</footer>
  </main>
}
function Field({label,value,onChange,placeholder,action}){return <label className="field"><span>{label}</span><div><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{action&&<button className="gps" onClick={action} title="Use current location">◎ GPS</button>}</div></label>}
function RouteCard({route,best}){return <article className={'route '+(best?'best':'')}><div className="route-top"><div><span className="route-badge">{best?'BEST MATCH':'ALTERNATIVE'}</span><div className="route-time">{fmt(route.total)}</div><div className="route-meta">{route.transfers} transfer{route.transfers===1?'':'s'} · ~{route.walk} min walking · schedule-based</div></div>{best&&<span className="recommended">Recommended</span>}</div><div className="legs">{route.legs.map((l,i)=><div className={`leg ${l.type}`} key={i}><div className="leg-title">{l.label}{l.route&&l.route!=='Metro'&&<small> · {l.route}</small>}</div><div className="leg-line">{l.from}</div><div className="leg-time">↓ {fmt(l.mins)}</div><div className="leg-line">{l.to}</div></div>)}</div></article>}
function Stat({n,t}){return <div className="stat"><b>{n}</b><span>{t}</span></div>}

createRoot(document.getElementById('root')).render(<App/>);
