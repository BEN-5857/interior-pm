import { useState, useMemo, useRef, useEffect } from "react";

// --- 1. 配置區：已自動填入您的 GAS 網址 ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwUdfgvymk3fCWTutVtm5TdWH9ww-S4cNcfWzR4KwZpRovQB2ImENPCubCopLgTwM3bOg/exec'; 

const TW_HOLIDAYS = new Set([
  '2024-01-01','2024-02-08','2024-02-09','2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14',
  '2024-02-28','2024-04-04','2024-04-05','2024-05-01','2024-06-10','2024-09-17','2024-10-10',
  '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-03','2025-02-04',
  '2025-02-28','2025-04-03','2025-04-04','2025-04-05','2025-05-01','2025-06-02','2025-10-06','2025-10-10',
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-23','2026-02-24',
  '2026-02-28','2026-04-03','2026-04-04','2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09','2026-10-10'
]);

// --- 2. 預設 15 工種模板 ---
const DEFAULT_TRADES_TEMPLATE = [
  { name:'拆除工程', days:5, items:[{id:'i1',content:'保護工程',status:'waiting'},{id:'i2',content:'天花板拆除',status:'waiting'}] },
  { name:'水電工程', days:18, items:[{id:'i3',content:'冷熱水管遷移',status:'waiting'},{id:'i4',content:'開關插座移位',status:'waiting'}] },
  { name:'泥作工程', days:12, items:[] },
  { name:'門窗工程', days:5, items:[] },
  { name:'冷氣工程', days:6, items:[] },
  { name:'木作工程', days:25, items:[] },
  { name:'油漆工程', days:10, items:[] },
  { name:'廚具工程', days:3, items:[] },
  { name:'玻璃工程', days:4, items:[] },
  { name:'系統櫃工程', days:4, items:[] },
  { name:'木地板工程', days:5, items:[] },
  { name:'其他工程', days:3, items:[] },
  { name:'清潔工程', days:2, items:[] },
  { name:'窗簾／壁紙', days:2, items:[] },
  { name:'家具／軟件', days:2, items:[] }
];

// --- 3. 安全工具函數 ---
function safeDate(d) {
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
}
function isWorkday(date) {
  const d = safeDate(date);
  if (d.getDay()===0||d.getDay()===6) return false;
  return !TW_HOLIDAYS.has(d.toISOString().split('T')[0]);
}
function addWorkdays(startDate, days) {
  let d = safeDate(startDate), count = 0;
  const target = Math.max(1, days);
  while (count < target) { d.setDate(d.getDate()+1); if (isWorkday(d)) count++; }
  return d;
}
function nextWorkday(date) {
  let d = safeDate(date);
  while (!isWorkday(d)) d.setDate(d.getDate()+1);
  return d;
}
function dateToStr(d) { return safeDate(d).toISOString().split('T')[0]; }
function formatDate(s) {
  const d = safeDate(s);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function calDays(a, b) { return Math.round((safeDate(b)-safeDate(a))/86400000); }
function tradeEndDate(trade) { return dateToStr(addWorkdays(trade.startDate, trade.days-1)); }

function initTrades(trades, projectStart) {
  let cur = safeDate(projectStart);
  return trades.map((t, idx) => {
    const sd = dateToStr(nextWorkday(cur));
    cur = addWorkdays(new Date(sd), t.days);
    return { ...t, id: 't' + Date.now() + idx, startDate: sd };
  });
}

const STATUS = {
  waiting: { label:'等待中', color:'#6b7280', bg:'#f3f4f6' },
  active:  { label:'施工中', color:'#b45309', bg:'#fef3c7' },
  done:    { label:'已完工', color:'#065f46', bg:'#d1fae5' },
};

// --- UI 組件 ---
function Badge({ status, onClick }) {
  const cfg = STATUS[status];
  const next = status==='waiting'?'active':status==='active'?'done':'waiting';
  return <span onClick={()=>onClick&&onClick(next)} style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,color:cfg.color,background:cfg.bg,cursor:onClick?'pointer':'default',userSelect:'none',whiteSpace:'nowrap'}}>{cfg.label}</span>;
}

function TradeCard({ trade, onStatus, onDays, onAdd, onDel, onStartDate }) {
  const [open, setOpen] = useState(true);
  const done = trade.items.filter(i=>i.status==='done').length;
  const pct = trade.items.length ? Math.round(done/trade.items.length*100) : 0;
  return (
    <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:10,marginBottom:10,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14}}>{trade.name} ({done}/{trade.items.length})</div>
          <div style={{fontSize:11,color:'#9ca3af'}}>{formatDate(trade.startDate)} → {formatDate(tradeEndDate(trade))}</div>
        </div>
        <div style={{display:'flex', gap:10, alignItems:'center'}} onClick={e=>e.stopPropagation()}>
           <input type="range" min={1} max={60} value={trade.days} onChange={e=>onDays(trade.id,+e.target.value)} style={{width:80}}/>
           <input type="number" min={1} value={trade.days} onChange={e=>onDays(trade.id,+e.target.value||1)} style={{width:40, textAlign:'center', border:'1px solid #ddd', borderRadius:4}}/>
        </div>
      </div>
      {open && (
        <div style={{padding:'10px 16px', borderTop:'1px solid #f3f4f6'}}>
          <div style={{height:4, background:'#f3f4f6', borderRadius:2, marginBottom:10}}>
            <div style={{height:'100%', width:`${pct}%`, background:'#10b981', borderRadius:2}}/>
          </div>
          {trade.items.map(item=>(
            <div key={item.id} style={{display:'flex', gap:10, marginBottom:4, alignItems:'center'}}>
              <Badge status={item.status} onClick={s=>onStatus(trade.id, item.id, s)}/>
              <span style={{fontSize:13, flex:1, color:item.status==='done'?'#9ca3af':'#333'}}>{item.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GanttChart({ trades, ganttStart, ganttEnd, onTradeStartDate }) {
  const totalCalDays = calDays(ganttStart, ganttEnd) + 1;
  return (
    <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:12,padding:16,marginBottom:16,overflowX:'auto'}}>
      <div style={{minWidth:600}}>
        {trades.map(t=>{
          const leftPct = calDays(ganttStart, t.startDate) / totalCalDays * 100;
          const widthPct = Math.max(2, (calDays(t.startDate, tradeEndDate(t))+1) / totalCalDays * 100);
          const hasActive = t.items.some(i=>i.status==='active');
          return (
            <div key={t.id} style={{display:'flex', marginBottom:6, alignItems:'center'}}>
              <div style={{width:80, fontSize:10, fontWeight:600}}>{t.name}</div>
              <div style={{flex:1, position:'relative', height:20, background:'#f3f4f6', borderRadius:4}}>
                <div style={{position:'absolute', left:`${leftPct}%`, width:`${widthPct}%`, top:2, bottom:2, background:hasActive?'#d97706':'#6366f1', borderRadius:3}} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 主程式 ---
export default function App() {
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({name:'', client:'', startDate: dateToStr(new Date())});

  // 1. 初始化讀取
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        if (data && data.length) {
          const synced = data.map(r=>({
            id:r.id, name:r.task, days:parseInt(r.days)||1, startDate:r.startDate, items:JSON.parse(r.items||'[]')
          }));
          setProjects([{id:'p1', name:'中山北路辦公室', client:'台灣新創', startDate:synced[0].startDate, maxWorkdays:95, trades:synced}]);
          setPid('p1');
        } else {
          const init = {id:'p1', name:'中山北路辦公室', client:'台灣新創', startDate:'2025-03-03', maxWorkdays:95, trades:initTrades(DEFAULT_TRADES_TEMPLATE, '2025-03-03')};
          setProjects([init]); setPid('p1');
        }
      } catch(e) { 
        setProjects([{id:'p1', name:'離線模式案場', client:'測試', startDate:'2025-03-03', maxWorkdays:95, trades:initTrades(DEFAULT_TRADES_TEMPLATE, '2025-03-03')}]);
        setPid('p1');
      } finally { setLoading(false); }
    }
    load();
  }, []);

  // 2. 自動儲存
  useEffect(() => {
    if (loading || !projects.length) return;
    const p = projects.find(x=>x.id===pid);
    const timer = setTimeout(()=> {
      const payload = p.trades.map(t=>({id:t.id, task:t.name, startDate:t.startDate, days:t.days, items:JSON.stringify(t.items)}));
      fetch(GAS_URL, {method:'POST', mode:'no-cors', body:JSON.stringify(payload)});
    }, 2000);
    return ()=>clearTimeout(timer);
  }, [projects, pid]);

  function upd(fn){ setProjects(ps=>ps.map(p=>p.id===pid?fn(p):p)); }
  const h = {
    onStatus:(tid,iid,s)=>upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,items:t.items.map(i=>i.id===iid?{...i,status:s}:i)}:t)})),
    onDays:(tid,d)=>upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,days:d}:t)})),
    onStartDate:(tid,sd)=>upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,startDate:sd}:t)}))
  };

  if (loading) return <div style={{padding:50, textAlign:'center'}}>同步雲端資料庫中...</div>;
  const proj = projects.find(p=>p.id===pid);

  return (
    <div style={{minHeight:'100vh', background:'#f9fafb', padding:20, fontFamily:'sans-serif'}}>
      <div style={{maxWidth:900, margin:'0 auto'}}>
        <div style={{background:'#064e3b', color:'white', padding:20, borderRadius:12, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:10, color:'#6ee7b7'}}>INTERIOR PM SYSTEM</div>
            <div style={{fontSize:20, fontWeight:800}}>{proj?.name || "案場管理"}</div>
          </div>
          <button onClick={()=>setShowNew(!showNew)} style={{background:'#ecfdf5', color:'#065f46', border:'none', padding:'8px 16px', borderRadius:6, cursor:'pointer', fontWeight:600}}>+ 新增案場</button>
        </div>

        {showNew && (
          <div style={{background:'#f0fdf4', padding:20, borderRadius:12, marginBottom:16, border:'1px solid #d1fae5', display:'flex', gap:10, alignItems:'flex-end'}}>
            <div style={{flex:1}}><label style={{fontSize:11}}>案場名稱</label><input style={{width:'100%', padding:8, borderRadius:6, border:'1px solid #d1d5db'}} value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
            <div style={{flex:1}}><label style={{fontSize:11}}>開工日期</label><input type="date" style={{width:'100%', padding:8, borderRadius:6, border:'1px solid #d1d5db'}} value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})}/></div>
            <button onClick={()=>{
              const newProj = {id:'p'+Date.now(), name:form.name||"新案場", client:form.client, startDate:form.startDate, maxWorkdays:95, trades:initTrades(DEFAULT_TRADES_TEMPLATE, form.startDate)};
              setProjects([...projects, newProj]); setPid(newProj.id); setShowNew(false);
            }} style={{background:'#064e3b', color:'white', border:'none', padding:'10px 20px', borderRadius:6, cursor:'pointer', fontWeight:600}}>建立案場</button>
          </div>
        )}

        {proj && (
          <>
            <GanttChart trades={proj.trades} ganttStart="2025-02-24" ganttEnd="2025-07-31" onTradeStartDate={h.onStartDate}/>
            {proj.trades.map(t=><TradeCard key={t.id} trade={t} {...h}/>)}
          </>
        )}
      </div>
    </div>
  );
}
