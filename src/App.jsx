import { useState, useMemo, useRef, useEffect } from "react";

// --- 配置區 ---
// 請貼上您部署獲得的「網頁應用程式網址」 (必須以 /exec 結尾)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwUdfgvymk3fCWTutVtm5TdWH9ww-S4cNcfWzR4KwZpRovQB2ImENPCubCopLgTwM3bOg/exec'; 

const TW_HOLIDAYS = new Set([
  '2024-01-01','2024-02-08','2024-02-09','2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14',
  '2024-02-28','2024-04-04','2024-04-05','2024-05-01','2024-06-10','2024-09-17','2024-10-10',
  '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-03','2025-02-04',
  '2025-02-28','2025-04-03','2025-04-04','2025-04-05','2025-05-01','2025-06-02','2025-10-06','2025-10-10',
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-23','2026-02-24',
  '2026-02-28','2026-04-03','2026-04-04','2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09','2026-10-10'
]);

// --- 初始資料 (如果資料庫沒東西就用這個) ---
const RAW_INITIAL = [
  { id:'t1', name:'拆除工程', days:5, startDate:'2025-03-03', items:[] },
  { id:'t2', name:'水電工程', days:18, startDate:'2025-03-10', items:[] },
  { id:'t3', name:'木作工程', days:20, startDate:'2025-04-01', items:[] }
];

// --- 工具函數 ---
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

const STATUS = {
  waiting: { label:'等待中', color:'#6b7280', bg:'#f3f4f6' },
  active:  { label:'施工中', color:'#b45309', bg:'#fef3c7' },
  done:    { label:'已完工', color:'#065f46', bg:'#d1fae5' },
};

function Badge({ status, onClick }) {
  const cfg = STATUS[status];
  const next = status==='waiting'?'active':status==='active'?'done':'waiting';
  return <span onClick={()=>onClick&&onClick(next)} style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,color:cfg.color,background:cfg.bg,cursor:onClick?'pointer':'default',userSelect:'none',whiteSpace:'nowrap'}}>{cfg.label}</span>;
}

// ... GanttChart & TradeCard 組件保持原樣 (省略以節省空間，請沿用上一版) ...
// [此處應有 GanttChart 與 TradeCard 的程式碼]

export default function App() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. 初始化讀取
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        
        if (data && data.length > 0) {
          // 資料庫有資料，進行格式轉換
          const formatted = data.map(row => ({
            id: String(row.id),
            name: row.task,
            days: parseInt(row.days) || 1,
            startDate: row.startDate,
            items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || [])
          }));
          setTrades(formatted);
        } else {
          // 資料庫沒資料，使用預設值
          setTrades(RAW_INITIAL);
        }
      } catch (e) {
        console.error("讀取失敗:", e);
        // 如果讀取不到 API，直接用單機版啟動，不變白畫面
        setTrades(RAW_INITIAL);
        setError("連線失敗，目前為離線模式");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 2. 資料變動自動同步
  useEffect(() => {
    if (loading || trades.length === 0) return;
    
    const timer = setTimeout(async () => {
      const payload = trades.map(t => ({
        id: t.id,
        task: t.name,
        startDate: t.startDate,
        days: t.days,
        items: JSON.stringify(t.items)
      }));

      try {
        await fetch(GAS_URL, {
          method: 'POST',
          mode: 'no-cors', // 解決 CORS 問題
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.error("同步失敗:", e);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [trades]);

  if (loading) return <div style={{padding:50, textAlign:'center'}}>正在讀取中山北路案場進度...</div>;

  const lastEnd = trades.reduce((l,t)=>{const e=tradeEndDate(t);return e>l?e:l;}, '2025-03-03');
  const ganttStart = '2025-02-24';
  const ganttEnd = '2025-06-30';

  const h = {
    onStatus: (tid,iid,s) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,items:t.items.map(i=>i.id===iid?{...i,status:s}:i)}:t)),
    onDays: (tid,d) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,days:Math.max(1,d)}:t)),
    onStartDate: (tid,sd) => setTrades(ts=>ts.map(t=>t.id===tid?{...t,startDate:sd}:t)),
    // 其他 handler...
  };

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',padding:'20px'}}>
      <div style={{background:'#064e3b',color:'white',padding:'16px',borderRadius:12,marginBottom:16}}>
        <div style={{fontSize:18,fontWeight:800}}>中山北路辦公室 - 工程進度管理系統</div>
        {error && <div style={{fontSize:12, color:'#fca5a5'}}>{error}</div>}
      </div>
      
      {/* 這裡放 GanttChart 與 TradeCard 的渲染 */}
      {trades.map(t => <div key={t.id}>{t.name} - {t.startDate}</div>)}
    </div>
  );
}
