import { useState, useMemo, useRef, useEffect } from "react";

// --- 1. 配置區 ---
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
  { name:'拆除工程', days:5, items:[{id:'i1',content:'現場保護工程',status:'waiting'},{id:'i2',content:'舊天花板拆除',status:'waiting'},{id:'i3',content:'廢棄物清運',status:'waiting'}] },
  { name:'水電工程', days:18, items:[{id:'i4',content:'放樣定位',status:'waiting'},{id:'i5',content:'打鑿埋管',status:'waiting'},{id:'i6',content:'電源燈線拉線',status:'waiting'}] },
  { name:'泥作工程', days:12, items:[{id:'i7',content:'防水施作',status:'waiting'},{id:'i8',content:'地磚鋪設',status:'waiting'}] },
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

// --- 3. 工具函數 ---
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
function tradeEndDate(trade) { return dateToStr(addWorkdays(new Date(trade.startDate), trade.days-1)); }

function initTrades(trades, projectStart) {
  let cur = new Date(projectStart);
  return trades.map((t, idx) => {
    const sd = dateToStr(nextWorkday(cur));
    cur = addWorkdays(new Date(sd), t.days);
    return { ...t, id: t.id || 't' + Date.now() + idx, startDate: sd };
  });
}

const STATUS = {
  waiting: { label:'等待中', color:'#6b7280', bg:'#f3f4f6' },
  active:  { label:'施工中', color:'#b45309', bg:'#fef3c7' },
  done:    { label:'已完工', color:'#065f46', bg:'#d1fae5' },
};

// ... 此處保持您的 Badge, TradeCard, GanttChart 組件邏輯 ...

export default function App() {
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({name:'',client:'',startDate:''});

  // --- 1. 從 Google Sheets 讀取 ---
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        if (data && data.length > 0) {
          // 這裡將資料庫資料注入到第一個預設案場
          const syncedTrades = data.map(row => ({
            id: row.id, name: row.task, days: parseInt(row.days) || 1,
            startDate: row.startDate, items: JSON.parse(row.items || '[]')
          }));
          const initialProj = {
            id: 'p1', name: '中山北路辦公室', client: '台灣新創股份有限公司',
            startDate: syncedTrades[0].startDate, maxWorkdays: 95, trades: syncedTrades
          };
          setProjects([initialProj]);
          setPid('p1');
        } else {
          // 如果資料庫是空的，建立初始案場
          const initial = {
            id: 'p1', name: '中山北路辦公室', client: '台灣新創股份有限公司',
            startDate: '2025-03-03', maxWorkdays: 95,
            trades: initTrades(DEFAULT_TRADES_TEMPLATE, '2025-03-03')
          };
          setProjects([initial]);
          setPid('p1');
        }
      } catch (e) { console.error("讀取失敗:", e); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  // --- 2. 自動儲存 (僅同步當前案場) ---
  useEffect(() => {
    if (loading || !projects.length) return;
    const currentProj = projects.find(p => p.id === pid);
    if (!currentProj) return;

    const timer = setTimeout(async () => {
      const payload = currentProj.trades.map(t => ({
        id: t.id, task: t.name, startDate: t.startDate, days: t.days, items: JSON.stringify(t.items)
      }));
      try { fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) }); }
      catch (e) { console.error("備份失敗:", e); }
    }, 2000);
    return () => clearTimeout(timer);
  }, [projects, pid]);

  const proj = projects.find(p=>p.id===pid);
  // ... 其他計算 logic ...

  function upd(fn){ setProjects(ps=>ps.map(p=>p.id===pid?fn(p):p)); }

  const h = {
    onStatus: (tid,iid,s) => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,items:t.items.map(i=>i.id===iid?{...i,status:s}:i)}:t)})),
    onDays: (tid,d) => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,days:Math.max(1,d)}:t)})),
    onAdd: (tid,c) => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,items:[...t.items,{id:'i'+Date.now(),content:c,status:'waiting'}]}:t)})),
    onDel: (tid,iid) => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,items:t.items.filter(i=>i.id!==iid)}:t)})),
    onStartDate: (tid,sd) => upd(p=>({...p,trades:p.trades.map(t=>t.id===tid?{...t,startDate:sd}:t)})),
  };

  if (loading) return <div style={{padding:50, textAlign:'center'}}>正在同步案場資料...</div>;

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
      <div style={{background:'#064e3b',color:'white',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:10,letterSpacing:3,color:'#6ee7b7',marginBottom:2}}>INTERIOR WORKS</div>
          <div style={{fontSize:18,fontWeight:800}}>工程進度管理系統 v2</div>
        </div>
      </div>

      {/* 恢復頁籤與新增按鈕 */}
      <div style={{background:'white',borderBottom:'2px solid #e5e7eb',display:'flex',alignItems:'center',paddingLeft:24}}>
        {projects.map(p=>(
          <button key={p.id} onClick={()=>setPid(p.id)} style={{padding:'14px 20px',border:'none',background:'none',cursor:'pointer',color:p.id===pid?'#064e3b':'#6b7280',fontWeight:p.id===pid?700:400,fontSize:13,borderBottom:p.id===pid?'2px solid #064e3b':'2px solid transparent',marginBottom:-2}}>{p.name}</button>
        ))}
        <button onClick={()=>setShowNew(!showNew)} style={{marginLeft:'auto',marginRight:16,padding:'8px 14px',background:'#ecfdf5',color:'#065f46',border:'1px solid #a7f3d0',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>＋ 新增案場</button>
      </div>

      {/* 恢復新增案場表單 */}
      {showNew && (
        <div style={{background:'#f0fdf4',borderBottom:'1px solid #d1fae5',padding:'14px 24px',display:'flex',gap:12,alignItems:'flex-end'}}>
          <div>
            <label style={{fontSize:11,color:'#6b7280',display:'block'}}>案場名稱</label>
            <input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{padding:6,borderRadius:6,border:'1px solid #d1d5db'}}/>
          </div>
          <button onClick={()=>{
            const np = { 
              id:'p'+Date.now(), name:form.name, client:form.client, startDate:form.startDate, 
              maxWorkdays:95, trades:initTrades(DEFAULT_TRADES_TEMPLATE, form.startDate) 
            };
            setProjects(ps=>[...ps,np]); setPid(np.id); setShowNew(false);
          }} style={{background:'#064e3b',color:'white',padding:'8px 16px',borderRadius:6}}>建立</button>
        </div>
      )}

      {proj && (
        <div style={{maxWidth:900,margin:'0 auto',padding:'20px 16px'}}>
          {/* ... 原本的 Summary, Gantt, TradeCard 渲染內容 ... */}
        </div>
      )}
    </div>
  );
}
