import { useEffect,useState } from 'react'
import { CalendarDays,RefreshCw } from 'lucide-react'
import { getSales,type DailySales } from '../services/sales'
import { invalidateQuery } from '../lib/queryCache'
import { formatMoney } from '../utils/money'

const localDate=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}
const formatDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
type Period='daily'|'monthly'|'annual'

function getRange(date:string,period:Period){
  const [year,month,day]=date.split('-').map(Number)
  const start=period==='daily'?new Date(year,month-1,day):period==='monthly'?new Date(year,month-1,1):new Date(year,0,1)
  const end=new Date(start)
  if(period==='daily')end.setDate(end.getDate()+1)
  else if(period==='monthly')end.setMonth(end.getMonth()+1)
  else end.setFullYear(end.getFullYear()+1)
  return {startDate:formatDate(start),endDate:formatDate(end)}
}

export function SalesPage(){
  const [date,setDate]=useState(localDate)
  const [period,setPeriod]=useState<Period>('daily')
  const [sales,setSales]=useState<DailySales|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const {startDate,endDate}=getRange(date,period)

  useEffect(()=>{let active=true;setLoading(true);setError('');getSales(startDate,endDate).then(result=>{if(active)setSales(result)}).catch(()=>{if(active)setError('Unable to load sales for this period.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[startDate,endDate])
  function refresh(){invalidateQuery(`sales:${startDate}:${endDate}`);setLoading(true);setError('');getSales(startDate,endDate).then(setSales).catch(()=>setError('Unable to load sales for this period.')).finally(()=>setLoading(false))}

  const picker=period==='daily'
    ?<input aria-label="Sales date" type="date" value={date} onChange={event=>setDate(event.target.value)} className="py-2.5 outline-none"/>
    :period==='monthly'
      ?<input aria-label="Sales month" type="month" value={date.slice(0,7)} onChange={event=>setDate(`${event.target.value}-01`)} className="py-2.5 outline-none"/>
      :<input aria-label="Sales year" type="number" min="2000" max="2100" value={date.slice(0,4)} onChange={event=>setDate(`${event.target.value.padStart(4,'0')}-01-01`)} className="w-24 py-2.5 outline-none"/>

  return <div className="p-4 pt-16 lg:p-8">
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div><h1 className="text-2xl font-bold">Sales</h1><p className="text-sm text-stone-500">Completed sales grouped by category.</p></div>
      <div className="flex rounded-xl border bg-white p-1" aria-label="Sales period">
        {(['daily','monthly','annual'] as const).map(option=><button key={option} type="button" onClick={()=>setPeriod(option)} className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${period===option?'bg-brand-600 text-white':'text-stone-600 hover:bg-stone-100'}`} aria-pressed={period===option}>{option}</button>)}
      </div>
      <div className="flex items-center gap-2 rounded-xl border bg-white px-3"><CalendarDays size={18} className="text-stone-500"/>{picker}</div>
      <button onClick={refresh} disabled={loading} aria-label="Refresh sales" className="rounded-xl border bg-white p-3 disabled:opacity-50"><RefreshCw size={18} className={loading?'animate-spin':''}/></button>
    </div>
    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <section className="max-w-3xl overflow-hidden rounded-2xl bg-white shadow-sm">
      {loading?<p className="p-10 text-center text-stone-500">Loading sales...</p>:sales?.categories.length?<div className="divide-y">{sales.categories.map(category=><div key={category.category} className="p-5"><div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{category.category}</h2><strong>{formatMoney(category.revenue_centavos)}</strong></div><div className="space-y-2 border-l-2 border-brand-100 pl-4">{sales.products.filter(product=>product.category===category.category).map(product=><div key={`${product.category}-${product.product}`} className="flex justify-between gap-4 text-sm"><span><strong>{product.weight_sold_kg>0?`${product.weight_sold_kg} kg`:`${product.quantity_sold}×`}</strong> {product.product}</span><span className="text-stone-500">{formatMoney(product.revenue_centavos)}</span></div>)}</div></div>)}</div>:<p className="p-10 text-center text-stone-500">No completed sales for this period.</p>}
      <div className="space-y-3 border-t p-5"><div className="flex justify-between font-semibold"><span>Cash</span><span>{formatMoney(sales?.cash_revenue_centavos??0)}</span></div><div className="flex justify-between font-semibold"><span>GCash</span><span>{formatMoney(sales?.gcash_revenue_centavos??0)}</span></div></div>
      <div className="flex justify-between border-t-2 border-brand-100 bg-brand-50 p-5 text-xl font-black"><span>Total revenue</span><span>{formatMoney(sales?.total_revenue_centavos??0)}</span></div>
    </section>
  </div>
}
