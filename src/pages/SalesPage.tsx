import { useEffect,useState } from 'react'
import { CalendarDays,RefreshCw } from 'lucide-react'
import { getDailySales,type DailySales } from '../services/sales'
import { invalidateQuery } from '../lib/queryCache'
import { formatMoney } from '../utils/money'

const localDate=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}

export function SalesPage(){
  const [date,setDate]=useState(localDate)
  const [sales,setSales]=useState<DailySales|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{let active=true;setLoading(true);setError('');getDailySales(date).then(result=>{if(active)setSales(result)}).catch(()=>{if(active)setError('Unable to load sales for this date.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[date])
  function refresh(){invalidateQuery(`sales:${date}`);setDate(current=>`${current}`);setLoading(true);getDailySales(date).then(setSales).catch(()=>setError('Unable to load sales for this date.')).finally(()=>setLoading(false))}

  return <div className="p-4 pt-16 lg:p-8">
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div><h1 className="text-2xl font-bold">Sales</h1><p className="text-sm text-stone-500">Completed sales grouped by category.</p></div>
      <div className="flex items-center gap-2 rounded-xl border bg-white px-3"><CalendarDays size={18} className="text-stone-500"/><input aria-label="Sales date" type="date" value={date} onChange={event=>setDate(event.target.value)} className="py-2.5 outline-none"/></div>
      <button onClick={refresh} disabled={loading} aria-label="Refresh sales" className="rounded-xl border bg-white p-3 disabled:opacity-50"><RefreshCw size={18} className={loading?'animate-spin':''}/></button>
    </div>
    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <section className="max-w-3xl overflow-hidden rounded-2xl bg-white shadow-sm">
      {loading?<p className="p-10 text-center text-stone-500">Loading sales...</p>:sales?.categories.length?<div className="divide-y">{sales.categories.map(category=><div key={category.category} className="p-5"><div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{category.category}</h2><strong>{formatMoney(category.revenue_centavos)}</strong></div><div className="space-y-2 border-l-2 border-brand-100 pl-4">{sales.products.filter(product=>product.category===category.category).map(product=><div key={`${product.category}-${product.product}`} className="flex justify-between gap-4 text-sm"><span><strong>{product.weight_sold_kg>0?`${product.weight_sold_kg} kg`:`${product.quantity_sold}×`}</strong> {product.product}</span><span className="text-stone-500">{formatMoney(product.revenue_centavos)}</span></div>)}</div></div>)}</div>:<p className="p-10 text-center text-stone-500">No completed sales for this date.</p>}
      <div className="space-y-3 border-t p-5"><div className="flex justify-between font-semibold"><span>Cash</span><span>{formatMoney(sales?.cash_revenue_centavos??0)}</span></div><div className="flex justify-between font-semibold"><span>GCash</span><span>{formatMoney(sales?.gcash_revenue_centavos??0)}</span></div></div>
      <div className="flex justify-between border-t-2 border-brand-100 bg-brand-50 p-5 text-xl font-black"><span>Total revenue</span><span>{formatMoney(sales?.total_revenue_centavos??0)}</span></div>
    </section>
  </div>
}
