import { useState, useMemo, useRef, useEffect } from "react";

// --- 配置區：已填入您的 GAS 網址 ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwUdfgvymk3fCWTutVtm5TdWH9ww-S4cNcfWzR4KwZpRovQB2ImENPCubCopLgTwM3bOg/exec';

const TW_HOLIDAYS = new Set([
  '2024-01-01','2024-02-08','2024-02-09','2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14',
  '2024-02-28','2024-04-04','2024-04-05','2024-05-01','2024-06-10','2024-09-17','2024-10-10',
  '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-03','2025-02-04',
  '2025-02-28','2025-04-03','2025-04-04','2025-04-05','2025-05-01','2025-06-02','2025-10-06','2025-10-10',
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-23','2026-02-24',
  '2026-02-28','2026-04-03','2026-04-04','2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09','2026-10-10'
]);

function isWorkday(date) {
  const d = new Date(date);
  if (d.getDay()===0||d.getDay()===6) return false;
  return !TW_HOLIDAYS.has(d.toISOString().split('T')[0]);
}

function addWorkdays(startDate, days) {
  let d = new Date(startDate), count = 0;
  while (count < days) { d.setDate(d.getDate()+1); if (isWorkday(d)) count++; }
  return d;
}

function nextWorkday(date) {
  let d = new Date(date);
  while (!isWorkday(d)) d.setDate(d.getDate()+1);
  return d;
}

function dateToStr(d) { return d.toISOString().split('T')[0]; }

function formatDate(s) {
  if (!s) return '-';
  const d = new Date(s);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function calDays(a, b) { return Math.round((new Date(b)-new Date(a))/86400000); }

function tradeEndDate(trade) {
  return dateToStr(addWorkdays(new Date(trade.startDate), trade.days-1));
}

function initTrades(trades, projectStart) {
  let cur = new Date(projectStart);
  return trades.map(t => {
    const sd = dateToStr(nextWorkday(cur));
    cur = addWorkdays(new Date(sd), t.days);
    return { ...t, startDate: sd };
  });
}

const STATUS = {
  waiting: { label:'等待中', color:'#6b7280', bg:'#f3f4f6' },
  active:  { label:'施工中', color:'#b45309', bg:'#fef3c7' },
  done:    { label:'已完工', color:'#065f46', bg:'#d1fae5' },
};

// 這是完整的 15 工種範本 (用於新增案場時自動載入)
const DEFAULT_15_TRADES = [
  { name:'拆除工程', days:5, items:[{content:'現場隔間牆體拆除'},{content:'舊天花板拆除'},{content:'拆除廢棄物清運'}]},
  { name:'水電工程', days:18, items:[{content:'放樣定位'},{content:'切割打鑿埋管'},{content:'拉電源線、燈線'},{content:'配進水管、排水管、移糞管、排氣管'},{content:'改消防水管'},{content:'開燈孔'},{content:'裝開關插座／衛浴設備'},{content:'裝燈具／收尾'}]},
  { name:'泥作工程', days:12, items:[{content:'砌磚'},{content:'全室牆面整理粉光'},{content:'防水施作'},{content:'地坪施作'},{content:'養護'},{content:'貼磁磚（壁磚、地磚）'}]},
  { name:'門窗工程', days:5, items:[{content:'丈量門窗大小型式'},{content:'門窗製作'},{content:'門窗安裝'}]},
  { name:'冷氣工程', days:6, items:[{content:'現場勘驗'},{content:'拉銅管、確認室內機排水管位置'},{content:'安裝、周圍水泥填縫'},{content:'裝室內室外機'}]},
  { name:'木作工程', days:25, items:[{content:'保護工程、張貼布告'},{content:'進場放樣'},{content:'天花施作'},{content:'門片製作'},{content:'造型牆面木作'},{content:'木作收邊'}]},
  { name:'油漆工程', days:10, items:[{content:'進場抓AB膠、批土'},{content:'批土、打磨'},{content:'門片、鐵件烤漆'},{content:'牆面滾塗'},{content:'修整收尾'}]},
  { name:'廚具工程', days:3, items:[{content:'廚具丈量'},{content:'廚具安裝'}]},
  { name:'玻璃工程', days:4, items:[{content:'玻璃丈量'},{content:'玻璃安裝'}]},
  { name:'系統櫃工程', days:4, items:[{content:'系統櫃丈量'},{content:'系統櫃安裝'}]},
  { name:'木地板工程', days:5, items:[{content:'木地板丈量'},{content:'木地板施工'},{content:'打矽利康收邊'}]},
  { name:'其他工程', days:3, items:[{content:'人造石丈量'},{content:'人造石安裝'}]},
  { name:'清潔工程', days:2, items:[{content:'全室細清'}]},
  { name:'窗簾／壁紙', days:2, items:[{content:'裝窗簾'}]},
  { name:'家具／軟件', days:2, items:[{content:'送電器家具'},{content:'維修整理、驗收入宅'}]}
];

// 預設示範案場
const RAW = [
  { id:'p1', name:'中山北路辦公室', client:'台灣新創股份有限公司', startDate:'2025-03-03', maxWorkdays:95, trades:[
    { id:'t1',  name:'拆除工程',   days:5,  items:[{id:'i1',content:'現場隔間牆體拆除',status:'done'},{id:'i2',content:'舊天花板拆除',status:'done'},{id:'i3',content:'拆除廢棄物清運',status:'done'}]},
    { id:'t2',  name:'水電工程',   days:18, items:[{id:'i4',content:'放樣定位',status:'done'},{id:'i5',content:'切割打鑿埋管',status:'done'},{id:'i6',content:'拉電源線、燈線',status:'active'},{id:'i7',content:'配進水管、排水管、移糞管、排氣管',status:'active'}]},
    { id:'t3',  name:'泥作工程',   days:12, items:[{id:'i12',content:'砌磚',status:'waiting'},{id:'i13',content:'全室牆面整理粉光',status:'waiting'},{id:'i14',content:'防水施作',status:'waiting'}]},
    { id:'t4',  name:'門窗工程',   days:5,  items:[{id:'i18',content:'丈量門窗大小型式',status:'waiting'},{id:'i19',content:'門窗製作',status:'waiting'}]},
    { id:'t5',  name:'冷氣工程',   days:6,  items:[{id:'i21',content:'現場勘驗',status:'waiting'},{id:'i22',content:'拉銅管、確認室內機排水管位置',status:'waiting'}]},
    { id:'t6',  name:'木作工程',   days:25, items:[{id:'i25',content:'保護工程、張貼布告',status:'waiting'},{id:'i26',content:'進場放樣',status:'waiting'}]},
    { id:'t7',  name:'油漆工程',   days:10, items:[{id:'i31',content:'進場抓AB膠、批土',status:'waiting'}]},
    { id:'t8',  name:'廚具工程',   days:3,  items:[{id:'i36',content:'廚具丈量',status:'waiting'}]},
    { id:'t9',  name:'玻璃工程',   days:4,  items:[{id:'i38',content:'玻璃丈量',status:'waiting'}]},
    { id:'t10', name:'系統櫃工程', days:4,  items:[{id:'i40',content:'系統櫃丈量',status:'waiting'}]},
    { id:'t11', name:'木地板工程', days:5,  items:[{id:'i42',content:'木地板丈量',status:'waiting'}]},
    { id:'t12', name:'其他工程',   days:3,  items:[{id:'i45',content:'人造石丈量',status:'waiting'}]},
    { id:'t13', name:'清潔工程',   days:2,  items:[{id:'i47',content:'全室細清',status:'waiting'}]},
    { id:'t14', name:'窗簾／壁紙', days:2,  items:[{id:'i48',content:'裝窗簾',status:'waiting'}]},
    { id:'t15', name:'家具／軟件', days:2,  items:[{id:'i49',content:'送電器家具',status:'waiting'}]},
  ]},
  { id:'p2', name:'自由年代林宅', client:'林先生 / 林太太', startDate:'2025-04-25', maxWorkdays:95, trades:[
    { id:'t16', name:'拆除工程',   days:5,  items:[{id:'i51',content:'拆除清運工程',status:'done'}]},
    { id:'t17', name:'水電工程',   days:20, items:[{id:'i53',content:'放樣定位',status:'done'}]}
  ]}
];

function Badge({ status, onClick }) {
  const cfg = STATUS[status];
  const next = status==='waiting'?'active':status==='active'?'done':'waiting';
  return <span onClick={()=>onClick&&onClick(next)} style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,color:cfg.color,background:cfg.bg,cursor:onClick?'pointer':'default',userSelect:'none',whiteSpace:'nowrap'}}>{cfg.label}</span>;
}

function TradeCard({ trade, onStatus, onDays, onAdd, onDel, onStartDate }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [txt, setTxt] = useState('');
  const done = trade.items.filter(i=>i.status==='done').length;
  const hasActive = trade.items.some(i=>i.status==='active');
  const pct = trade.items.length ? Math.round(done/trade.items.length*100) : 0;
  const endDate = tradeEndDate(trade);
  return (
    <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:10,marginBottom:10,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',borderBottom:open?'1px solid #f3f4f6':'none',background:hasActive?'#fffbeb':'white'}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
            <span style={{fontWeight:700,fontSize:14}}>{trade.name}</span>
            {hasActive && <Badge status="active"/>}
            <span style={{fontSize:11,color:'#9ca3af'}}>{done}/{trade.items.length} 項</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#9ca3af'}}>
            <input type="date" value={trade.startDate} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();onStartDate(trade.id,e.target.value);}} style={{fontSize:11,border:'none',background:'transparent',color:'#6b7280',cursor:'pointer',padding:0,outline:'none'}}/>
            <span>→ {formatDate(endDate)} · {trade.days} 工作日</span>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,minWidth:200}}>
          <input type="range" min={1} max={45} value={trade.days} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();onDays(trade.id,+e.target.value);}} style={{flex:1,accentColor:'#065f46'}}/>
          <input type="number" min={1} max={60} value={trade.days} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();onDays(trade.id,+e.target.value||1);}} style={{width:50,textAlign:'center',padding:'4px',fontSize:13,border:'1px solid #d1d5db',borderRadius:6}}/>
        </div>
        <span style={{color:'#9ca3af',fontSize:12}}>{open?'▲':'▼'}</span>
      </div>
      {open && (
        <div style={{padding:'12px 16px'}}>
          <div style={{height:3,background:'#f3f4f6',borderRadius:2,marginBottom:12}}>
            <div style={{height:'100%',width:`${pct}%`,background:'#10b981',borderRadius:2,transition:'width 0.3s'}}/>
          </div>
          {trade.items.map(item=>(
            <div key={item.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid #f9fafb'}}>
              <Badge status={item.status} onClick={s=>onStatus(trade.id,item.id,s)}/>
              <span style={{flex:1,fontSize:13,color:item.status==='done'?'#9ca3af':'#111827',textDecoration:item.status==='done'?'line-through':''}}>{item.content}</span>
              <button onClick={()=>onDel(trade.id,item.id)} style={{background:'none',border:'none',color:'#d1d5db',cursor:'pointer',fontSize:16,padding:'0 4px'}}>×</button>
            </div>
          ))}
          {adding ? (
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="輸入施作項目..." style={{flex:1,padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13}} onKeyDown={e=>{if(e.key==='Enter'&&txt.trim()){onAdd(trade.id,txt.trim());setTxt('');setAdding(false);}}}/>
              <button onClick={()=>{if(txt.trim()){onAdd(trade.id,txt.trim());setTxt('');setAdding(false);}}} style={{background:'#065f46',color:'white',padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer'}}>新增</button>
              <button onClick={()=>{setAdding(false);setTxt('');}} style={{background:'#f3f4f6',color:'#374151',padding:'6px 10px',borderRadius:6,border:'none',cursor:'pointer'}}>取消</button>
            </div>
          ) : (
            <button onClick={()=>setAdding(true)} style={{marginTop:10,background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:12,padding:'4px 0'}}>＋ 新增施作項目</button>
          )}
        </div>
      )}
    </div>
  );
}

function GanttChart({ trades, ganttStart, ganttEnd, onTradeStartDate }) {
  const railsRef = useRef({});
  const dragRef = useRef(null); 
  const [dragOffsets, setDragOffsets] = useState({});
  const totalCalDays = calDays(ganttStart, ganttEnd) + 1;

  const months = useMemo(()=>{
    const result=[], gS=new Date(ganttStart), gE=new Date(ganttEnd);
    let cur=new Date(gS.getFullYear(),gS.getMonth(),1);
    while(cur<=gE){
      const mS=cur<gS?new Date(gS):new Date(cur);
      const mE=new Date(cur.getFullYear(),cur.getMonth()+1,0);
      const mEC=mE>gE?new Date(gE):mE;
      result.push({
        label:`${cur.getFullYear()}/${cur.getMonth()+1}月`,
        leftPct:calDays(ganttStart,mS)/totalCalDays*100,
        widthPct:(calDays(mS,mEC)+1)/totalCalDays*100,
        key:cur.toISOString()
      });
      cur=new Date(cur.getFullYear(),cur.getMonth()+1,1);
    }
    return result;
  },[ganttStart,ganttEnd,totalCalDays]);

  const today=new Date();
  const todayPct=(today>=new Date(ganttStart)&&today<=new Date(ganttEnd)) ? calDays(ganttStart,today)/totalCalDays*100 : null;
  const LABEL_W=80;

  function startDrag(clientX, trade) {
    const rail = railsRef.current[trade.id];
    if (!rail) return;
    dragRef.current = { tradeId: trade.id, startX: clientX, origSD: trade.startDate, railW: rail.getBoundingClientRect().width };

    function onMove(cx) {
      const info = dragRef.current; if (!info) return;
      const dm = Math.round(((cx - info.startX) / info.railW) * totalCalDays);
      setDragOffsets(s => ({ ...s, [info.tradeId]: dm }));
    }
    function onUp(cx) {
      const info = dragRef.current; if (!info) return;
      const { tradeId, startX, origSD, railW } = info;
      dragRef.current = null;
      const dm = Math.round(((cx - startX) / railW) * totalCalDays);
      const nd = new Date(origSD); nd.setDate(nd.getDate() + dm);
      const snapped = nextWorkday(nd);
      const gS = new Date(ganttStart), gE = new Date(ganttEnd);
      const clamped = snapped < gS ? gS : snapped > gE ? gE : snapped;
      onTradeStartDate(tradeId, dateToStr(clamped));
      setDragOffsets(s => { const n={...s}; delete n[tradeId]; return n; });
      window.removeEventListener('mousemove', mmH); window.removeEventListener('mouseup', muH);
      window.removeEventListener('touchmove', tmH); window.removeEventListener('touchend', tuH);
    }

    const mmH = e => onMove(e.clientX);
    const muH = e => onUp(e.clientX);
    const tmH = e => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const tuH = e => onUp(e.changedTouches[0]?.clientX ?? clientX);

    window.addEventListener('mousemove', mmH);
    window.addEventListener('mouseup', muH);
    window.addEventListener('touchmove', tmH, { passive: false });
    window.addEventListener('touchend', tuH);
  }

  return (
    <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:12,padding:'16px 20px',marginBottom:16,overflowX:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:11,color:'#9ca3af',fontWeight:700,letterSpacing:1}}>排程甘特視圖</span>
        <span style={{fontSize:10,color:'#b0b7c3'}}>← 拖拉色條可調整各工種起始日，工種間可自由重疊 →</span>
      </div>
      <div style={{minWidth:540}}>
        <div style={{display:'flex',marginBottom:2}}>
          <div style={{width:LABEL_W,flexShrink:0}}/>
          <div style={{flex:1,position:'relative',height:18}}>
            {months.map(m=>(
              <div key={m.key} style={{position:'absolute',left:`${m.leftPct}%`,width:`${m.widthPct}%`,fontSize:9,color:'#374151',fontWeight:700,borderLeft:'1px solid #d1d5db',paddingLeft:4,height:'100%',display:'flex',alignItems:'center',overflow:'hidden',whiteSpace:'nowrap'}}>{m.label}</div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',marginBottom:5}}>
          <div style={{width:LABEL_W,flexShrink:0}}/>
          <div style={{flex:1,position:'relative',height:4,background:'#f3f4f6',borderRadius:2}}>
            {months.map(m=><div key={m.key} style={{position:'absolute',left:`${m.leftPct}%`,top:0,bottom:0,borderLeft:'1px solid #d1d5db'}}/>)}
            {todayPct!==null&&<div style={{position:'absolute',left:`${todayPct}%`,top:-3,bottom:-3,borderLeft:'2px dashed #ef4444',zIndex:2}}/>}
          </div>
        </div>
        {trades.map(t=>{
          const offset = dragOffsets[t.id] || 0;
          const effS = new Date(t.startDate); effS.setDate(effS.getDate()+offset);
          const effE = addWorkdays(new Date(effS), t.days-1);
          const leftPct = calDays(ganttStart, effS) / totalCalDays * 100;
          const widthPct = Math.max(1, (calDays(effS, effE)+1) / totalCalDays * 100);
          const done = t.items.filter(i=>i.status==='done').length;
          const hasActive = t.items.some(i=>i.status==='active');
          const isDragging = dragOffsets[t.id] !== undefined;
          const bg = done===t.items.length&&t.items.length>0?'#065f46':hasActive?'#d97706':'#6366f1';
          return (
            <div key={t.id} style={{display:'flex',alignItems:'center',marginBottom:5}}>
              <div style={{width:LABEL_W,flexShrink:0,fontSize:10,color:'#374151',fontWeight:500,paddingRight:8,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{t.name}</div>
              <div ref={el=>railsRef.current[t.id]=el} style={{flex:1,position:'relative',height:26,background:'#f3f4f6',borderRadius:4}}>
                {months.map(m=><div key={m.key} style={{position:'absolute',left:`${m.leftPct}%`,top:0,bottom:0,borderLeft:'1px solid #e5e7eb'}}/>)}
                {todayPct!==null&&<div style={{position:'absolute',left:`${todayPct}%`,top:0,bottom:0,borderLeft:'1.5px dashed #ef4444',zIndex:2}}/>}
                <div
                  onMouseDown={e=>{e.preventDefault();startDrag(e.clientX,t);}}
                  onTouchStart={e=>{e.preventDefault();startDrag(e.touches[0].clientX,t);}}
                  style={{
                    position:'absolute',left:`${Math.max(0,leftPct)}%`,width:`${widthPct}%`,
                    top:3,bottom:3,background:bg,borderRadius:3,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    overflow:'hidden',zIndex:3,
                    cursor:isDragging?'grabbing':'grab',
                    boxShadow:isDragging?'0 4px 14px rgba(0,0,0,0.22)':'none',
                    opacity:isDragging?0.82:1,
                    transition:isDragging?'none':'left 0.1s',
                    userSelect:'none',
                  }}
                >
                  <span style={{fontSize:9,color:'white',fontWeight:700,whiteSpace:'nowrap',padding:'0 5px',overflow:'hidden',pointerEvents:'none'}}>
                    {formatDate(dateToStr(effS)).slice(5)} – {formatDate(dateToStr(effE)).slice(5)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({name:'',client:'',startDate:''});

  // 1. 雲端讀取 (維持完美的巢狀結構)
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        
        const dbRow = data.find(row => row.id === 'DB_V3');
        if (dbRow && dbRow.progress) {
          const savedData = JSON.parse(dbRow.progress);
          setProjects(savedData);
          setPid(savedData[0]?.id || null);
        } else {
          const initial = RAW.map(p=>({...p, trades:initTrades(p.trades, p.startDate)}));
          setProjects(initial);
          setPid(initial[0].id);
        }
      } catch (e) {
        console.error("讀取失敗:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 2. 雲端儲存 (一併儲存所有案場)
  useEffect(() => {
    if (loading) return; // 讀取中不存檔
    const timer = setTimeout(async () => {
      const payload = [{
        id: 'DB_V3', 
        task: 'DO_NOT_DELETE', 
        startDate: dateToStr(new Date()), 
        days: 1, 
        progress: JSON.stringify(projects) 
      }];
      try {
        await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      } catch (e) { console.error("備份失敗:", e); }
    }, 2000); 
    return () => clearTimeout(timer);
  }, [projects, loading]);

  const proj = projects.find(p=>p.id===pid);
  const allItems = proj?.trades.flatMap(t=>t.items)||[];
  const doneCnt = allItems.filter(i=>i.status==='done').length;
  const lastEnd = proj ? proj.trades.reduce((l,t)=>{const e=tradeEndDate(t);return e>l?e:l;}, proj.startDate) : '';

  const totalWDSpan = proj ? (()=>{
    let cnt=0; let d=new Date(proj.startDate); const end=new Date(lastEnd);
    while(d<=end){ if(isWorkday(d)) cnt++; d.setDate(d.getDate()+1); }
    return cnt;
  })() : 0;

  const isOver = totalWDSpan > (proj?.maxWorkdays||95);

  const ganttStart = useMemo(()=>{
    if(!proj||!proj.trades.length) return '';
    const earliest=proj.trades.reduce((e,t)=>t.startDate<e?t.startDate:e, proj.trades[0].startDate);
    const d=new Date(earliest); d.setDate(d.getDate()-7); return dateToStr(d);
  },[proj]);

  const ganttEnd = useMemo(()=>{
    if(!proj) return '';
    const d=new Date(lastEnd); d.setDate(d.getDate()+14); return dateToStr(d);
  },[proj,lastEnd]);

  function upd(fn){ setProjects(ps=>ps.map(p=>p.id===pid?fn(p):p)); }

  const h = {
    onStatus:    (tid,iid,s) => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,items:t.items.map(i=>i.id===iid?{...i,status:s}:i)}:t)})),
    onDays:      (tid,d)     => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,days:Math.max(1,d)}:t)})),
    onAdd:       (tid,c)     => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,items:[...t.items,{id:'i'+Date.now(),content:c,status:'waiting'}]}:t)})),
    onDel:       (tid,iid)   => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,items:t.items.filter(i=>i.id!==iid)}:t)})),
    onStartDate: (tid,sd)    => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,startDate:sd}:t)})),
  };

  // --- 刪除案場功能 ---
  function handleDeleteProject() {
    if (!proj) return;
    if (window.confirm(`確定要刪除「${proj.name}」案場嗎？\n⚠️ 刪除後資料將無法復原。`)) {
      const remainingProjects = projects.filter(p => p.id !== proj.id);
      setProjects(remainingProjects);
      setPid(remainingProjects.length > 0 ? remainingProjects[0].id : null);
    }
  }

  if (loading) return <div style={{padding:50, textAlign:'center'}}>正在載入您的專屬工程進度...</div>;

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
      <div style={{background:'#064e3b',color:'white',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:10,letterSpacing:3,color:'#6ee7b7',marginBottom:2}}>INTERIOR WORKS</div>
          <div style={{fontSize:18,fontWeight:800}}>工程進度管理系統</div>
        </div>
        <div style={{fontSize:11,color:'#6ee7b7'}}>已連線至 Google 雲端</div>
      </div>

      <div style={{background:'white',borderBottom:'2px solid #e5e7eb',display:'flex',alignItems:'center',paddingLeft:24,overflowX:'auto'}}>
        {projects.map(p=>(
          <button key={p.id} onClick={()=>setPid(p.id)} style={{padding:'14px 20px',border:'none',background:'none',cursor:'pointer',color:p.id===pid?'#064e3b':'#6b7280',fontWeight:p.id===pid?700:400,fontSize:13,borderBottom:p.id===pid?'2px solid #064e3b':'2px solid transparent',marginBottom:-2,whiteSpace:'nowrap'}}>{p.name}</button>
        ))}
        <button onClick={()=>setShowNew(!showNew)} style={{marginLeft:'auto',marginRight:16,padding:'8px 14px',background:'#ecfdf5',color:'#065f46',border:'1px solid #a7f3d0',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>＋ 新增案場</button>
      </div>

      {showNew && (
        <div style={{background:'#f0fdf4',borderBottom:'1px solid #d1fae5',padding:'14px 24px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          {[{k:'name',l:'案場名稱',ph:'例：信義路住宅',t:'text'},{k:'client',l:'客戶',ph:'例：陳先生',t:'text'},{k:'startDate',l:'開工日',ph:'',t:'date'}].map(({k,l,ph,t})=>(
            <div key={k} style={{flex:'1 1 160px'}}>
              <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} placeholder={ph} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13}}/>
            </div>
          ))}
          <button onClick={()=>{
            if(!form.name.trim()||!form.startDate) return;
            
            // 替每個新案場的工種與項目產生唯一的 ID，避免 React 報錯
            const tradesWithUniqueIds = DEFAULT_15_TRADES.map((t, tIdx) => ({
              id: 't' + Date.now() + tIdx,
              name: t.name,
              days: t.days,
              items: t.items.map((i, iIdx) => ({
                id: 'i' + Date.now() + tIdx + iIdx,
                content: i.content,
                status: 'waiting'
              }))
            }));

            const np={id:'p'+Date.now(),name:form.name.trim(),client:form.client.trim(),startDate:form.startDate,maxWorkdays:95,trades:initTrades(tradesWithUniqueIds,form.startDate)};
            setProjects(ps=>[...ps,np]); setPid(np.id); setShowNew(false); setForm({name:'',client:'',startDate:''});
          }} style={{padding:'8px 20px',background:'#064e3b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>建立案場</button>
        </div>
      )}

      {proj ? (
        <div style={{maxWidth:900,margin:'0 auto',padding:'20px 16px'}}>
          <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:12,padding:'20px',marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:16}}>
              <div style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:20,fontWeight:800,color:'#111827'}}>{proj.name}</div>
                  <div style={{fontSize:13,color:'#6b7280',marginTop:2}}>客戶：{proj.client}</div>
                </div>
                {/* 刪除案場按鈕 */}
                <button 
                  onClick={handleDeleteProject}
                  style={{background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:600, height:'fit-content'}}
                >
                  🗑️ 刪除此案場
                </button>
              </div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'stretch'}}>
                {[
                  {l:'開工日',   v:formatDate(proj.startDate), c:'#111827'},
                  {l:'預計完工', v:formatDate(lastEnd),        c:isOver?'#dc2626':'#065f46'},
                ].map(({l,v,c})=>(
                  <div key={l} style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'10px 16px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'#9ca3af',marginBottom:3}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                  </div>
                ))}
                <div style={{background:isOver?'#fef2f2':'#f9fafb',border:`1px solid ${isOver?'#fecaca':'#e5e7eb'}`,borderRadius:8,padding:'10px 16px',textAlign:'center',minWidth:130}}>
                  <div style={{fontSize:10,color:'#9ca3af',marginBottom:4}}>總工期 / 上限工作日</div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                    <span style={{fontSize:14,fontWeight:700,color:isOver?'#dc2626':'#065f46'}}>{totalWDSpan}</span>
                    <span style={{fontSize:12,color:'#9ca3af'}}>/</span>
                    <input type="number" min={1} max={365} value={proj.maxWorkdays} onChange={e=>upd(p=>({...p,maxWorkdays:Math.max(1,+e.target.value||95)}))} style={{width:46,textAlign:'center',fontSize:14,fontWeight:700,color:isOver?'#dc2626':'#065f46',border:'none',borderBottom:`1.5px solid ${isOver?'#fca5a5':'#a7f3d0'}`,background:'transparent',outline:'none',padding:'0 2px'}} />
                    <span style={{fontSize:11,color:'#9ca3af'}}>天</span>
                  </div>
                </div>
              </div>
            </div>
            {isOver&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626',marginBottom:12}}>⚠ 總工期超過上限 <strong>{totalWDSpan-proj.maxWorkdays} 天</strong></div>}
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{fontSize:12,color:'#6b7280'}}>整體工項完成 {doneCnt}/{allItems.length} 項</span>
                <span style={{fontSize:12,fontWeight:700,color:'#065f46'}}>{allItems.length?Math.round(doneCnt/allItems.length*100):0}%</span>
              </div>
              <div style={{height:8,background:'#f3f4f6',borderRadius:4}}>
                <div style={{height:'100%',width:`${allItems.length?Math.round(doneCnt/allItems.length*100):0}%`,background:'linear-gradient(90deg,#065f46,#10b981)',borderRadius:4,transition:'width 0.4s'}}/>
              </div>
            </div>
          </div>

          {proj.trades.length>0&&ganttStart&&ganttEnd&&(
            <GanttChart trades={proj.trades} ganttStart={ganttStart} ganttEnd={ganttEnd} onTradeStartDate={h.onStartDate}/>
          )}

          <div style={{marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,fontWeight:700,color:'#111827'}}>工項施作清單</span>
            <span style={{fontSize:11,color:'#9ca3af'}}>點狀態切換 · 滑桿調整工期 · 起始日可直接點選</span>
          </div>
          {proj.trades.map(trade=><TradeCard key={trade.id} trade={trade} {...h}/>)}

        </div>
      ) : (
        <div style={{padding:50, textAlign:'center', color:'#6b7280'}}>
          目前沒有案場，請點擊右上方「＋ 新增案場」來建立。
        </div>
      )}
    </div>
  );
}
