import { useState, useMemo, useRef, useEffect } from "react";

// --- 1. 配置區：請貼上您的 GAS 網址 ---
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwUdfgvymk3fCWTutVtm5TdWH9ww-S4cNcfWzR4KwZpRovQB2ImENPCubCopLgTwM3bOg/exec'; 

const TW_HOLIDAYS = new Set([
  '2024-01-01','2024-02-08','2024-02-09','2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14',
  '2024-02-28','2024-04-04','2024-04-05','2024-05-01','2024-06-10','2024-09-17','2024-10-10',
  '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-03','2025-02-04',
  '2025-02-28','2025-04-03','2025-04-04','2025-04-05','2025-05-01','2025-06-02','2025-10-06','2025-10-10',
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-23','2026-02-24',
  '2026-02-28','2026-04-03','2026-04-04','2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09','2026-10-10'
]);

// --- 2. 工具函數 (含安全防禦邏輯) ---
function safeDate(d) {
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date('2025-03-03') : date;
}
function isWorkday(date) {
  const d = safeDate(date);
  if (d.getDay()===0||d.getDay()===6) return false;
  return !TW_HOLIDAYS.has(d.toISOString().split('T')[0]);
}
function addWorkdays(startDate, days) {
  let d = safeDate(startDate), count = 0;
  while (count < Math.max(1, days)) { d.setDate(d.getDate()+1); if (isWorkday(d)) count++; }
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

const STATUS = {
  waiting: { label:'等待中', color:'#6b7280', bg:'#f3f4f6' },
  active:  { label:'施工中', color:'#b45309', bg:'#fef3c7' },
  done:    { label:'已完工', color:'#065f46', bg:'#d1fae5' },
};

// --- 3. UI 組件 (Badge, TradeCard, GanttChart) ---
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
              <input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="輸入項目..." style={{flex:1,padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13}} onKeyDown={e=>{if(e.key==='Enter'&&txt.trim()){onAdd(trade.id,txt.trim());setTxt('');setAdding(false);}}}/>
              <button onClick={()=>{if(txt.trim()){onAdd(trade.id,txt.trim());setTxt('');setAdding(false);}}} style={{background:'#065f46',color:'white',padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer'}}>新增</button>
            </div>
          ) : (
            <button onClick={()=>setAdding(true)} style={{marginTop:10,background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:12}}>＋ 新增施作項目</button>
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
    const result=[], gS=safeDate(ganttStart), gE=safeDate(ganttEnd);
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

  function startDrag(clientX, trade) {
    const rail = railsRef.current[trade.id];
    if (!rail) return;
    dragRef.current = { tradeId: trade.id, startX: clientX, origSD: trade.startDate, railW: rail.getBoundingClientRect().width };
    const onMove = cx => {
      const info = dragRef.current; if (!info) return;
      const dm = Math.round(((cx - info.startX) / info.railW) * totalCalDays);
      setDragOffsets(s => ({ ...s, [info.tradeId]: dm }));
    };
    const onUp = cx => {
      const info = dragRef.current; if (!info) return;
      const dm = Math.round(((cx - info.startX) / info.railW) * totalCalDays);
      const nd = safeDate(info.origSD); nd.setDate(nd.getDate() + dm);
      onTradeStartDate(info.tradeId, dateToStr(nextWorkday(nd)));
      dragRef.current = null; setDragOffsets({});
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu);
    };
    const mm = e => onMove(e.clientX); const mu = e => onUp(e.clientX);
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
  }

  return (
    <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:12,padding:'16px 20px',marginBottom:16,overflowX:'auto'}}>
      <div style={{minWidth:540}}>
        <div style={{display:'flex',marginBottom:10}}>{months.map(m=><div key={m.key} style={{position:'relative',width:`${m.widthPct}%`,fontSize:10,fontWeight:700,color:'#374151',borderLeft:'1px solid #d1d5db',paddingLeft:4}}>{m.label}</div>)}</div>
        {trades.map(t=>{
          const offset = dragOffsets[t.id] || 0;
          const s = safeDate(t.startDate); s.setDate(s.getDate()+offset);
          const e = addWorkdays(s, t.days-1);
          const leftPct = calDays(ganttStart, s) / totalCalDays * 100;
          const widthPct = Math.max(1, (calDays(s, e)+1) / totalCalDays * 100);
          return (
            <div key={t.id} style={{display:'flex',alignItems:'center',marginBottom:5}}>
              <div style={{width:80,fontSize:10,fontWeight:500,color:'#374151',overflow:'hidden',whiteSpace:'nowrap'}}>{t.name}</div>
              <div ref={el=>railsRef.current[t.id]=el} style={{flex:1,position:'relative',height:24,background:'#f3f4f6',borderRadius:4}}>
                <div onMouseDown={ev=>startDrag(ev.clientX,t)} style={{position:'absolute',left:`${leftPct}%`,width:`${widthPct}%`,top:3,bottom:3,background:'#6366f1',borderRadius:3,cursor:'grab'}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 4. 主程式 ---
export default function App() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  // 初始化讀取：若資料庫沒東西，會自動幫您填入中山北路預設值
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        if (data && data.length > 0) {
          const cleaned = data.map(row => ({
            id: String(row.id), name: row.task, days: parseInt(row.days) || 1,
            startDate: row.startDate, items: JSON.parse(row.items || '[]')
          }));
          setTrades(cleaned);
        } else { throw new Error(); }
      } catch (e) {
        setTrades([
          { id:'t1', name:'拆除工程', days:5, startDate:'2025-03-03', items:[{id:'i1',content:'保護工程',status:'done'}] },
          { id:'t2', name:'水電工程', days:18, startDate:'2025-03-10', items:[] }
        ]);
      } finally { setLoading(false); }
    }
    fetchData();
  }, []);

  // 資料變動自動存檔
  useEffect(() => {
    if (loading || trades.length === 0) return;
    const timer = setTimeout(() => {
      const payload = trades.map(t => ({ id: t.id, task: t.name, startDate: t.startDate, days: t.days, items: JSON.stringify(t.items) }));
      fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
    }, 1500);
    return () => clearTimeout(timer);
  }, [trades]);

  if (loading) return <div style={{padding:50, textAlign:'center'}}>正在載入案場資料庫...</div>;

  const h = {
    onStatus: (tid,iid,s) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,items:t.items.map(i=>i.id===iid?{...i,status:s}:i)}:t)),
    onDays: (tid,d) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,days:Math.max(1,d)}:t)),
    onStartDate: (tid,sd) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,startDate:sd}:t)),
    onAdd: (tid,c) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,items:[...t.items,{id:'i'+Date.now(),content:c,status:'waiting'}]}:t)),
    onDel: (tid,iid) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,items:t.items.filter(i=>i.id!==iid)}:t)),
  };

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',padding:'20px'}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>
        <div style={{background:'#064e3b',color:'white',padding:'20px',borderRadius:12,marginBottom:16}}>
          <div style={{fontSize:20,fontWeight:800}}>中山北路辦公室 - 工程進度管理系統</div>
        </div>
        <GanttChart trades={trades} ganttStart="2025-02-24" ganttEnd="2025-06-30" onTradeStartDate={h.onStartDate}/>
        {trades.map(t => <TradeCard key={t.id} trade={t} {...h}/>)}
      </div>
    </div>
  );
}
