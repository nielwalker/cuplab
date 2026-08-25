import { Minus,Plus,Trash2 } from 'lucide-react'
import type { OrderWithItems,PaymentMethod } from '../../types/database'
import { formatMoney,pesosToCentavos } from '../../utils/money'
import { canCompleteOrder } from '../../utils/orderRules'

type Props={
  order:OrderWithItems|null
  processing:boolean
  onChange:(id:string,quantity:number)=>void
  onRemove:(id:string)=>void
  onComplete:()=>void
  onCancel:()=>void
  paymentMethod:PaymentMethod
  onPaymentMethodChange:(method:PaymentMethod)=>void
  cashReceived:string
  onCashReceivedChange:(value:string)=>void
}

export function OrderPanel({order,processing,onChange,onRemove,onComplete,onCancel,paymentMethod,onPaymentMethodChange,cashReceived,onCashReceivedChange}:Props){
  const items=order?.order_items??[]
  let cashCentavos:number|null=null
  try{cashCentavos=cashReceived?pesosToCentavos(cashReceived):null}catch{cashCentavos=null}
  const total=order?.total_centavos??0
  const cashValid=paymentMethod==='GCASH'||(cashCentavos!==null&&cashCentavos>=total)
  const change=paymentMethod==='CASH'&&cashValid&&cashCentavos!==null?cashCentavos-total:0
  return <aside className="flex min-h-[520px] flex-col rounded-2xl bg-white p-5 shadow-sm">
    <div className="mb-5"><h2 className="text-xl font-bold">Current Order</h2></div>
    <div className="flex-1 space-y-3 overflow-y-auto">
      {items.length===0&&<div className="grid h-48 place-items-center text-center text-sm text-stone-400">Place an order.</div>}
      {items.map(item=><div key={item.id} className="flex items-center gap-2 rounded-xl border border-stone-200 p-3">
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.product_name_snapshot}</p><p className="truncate text-xs text-stone-500">{item.weight_kg?`${item.weight_kg} kg × ${formatMoney(item.unit_price_centavos_snapshot)}/kg`:`${formatMoney(item.unit_price_centavos_snapshot)} each`}</p></div>
        {item.quantity&&<div className="flex shrink-0 items-center gap-1"><button aria-label="Decrease quantity" onClick={()=>item.quantity&&onChange(item.id,item.quantity-1)} className="rounded-lg border p-1"><Minus size={16}/></button><span className="min-w-6 text-center font-semibold">{item.quantity}</span><button aria-label="Increase quantity" onClick={()=>item.quantity&&onChange(item.id,item.quantity+1)} className="rounded-lg border p-1"><Plus size={16}/></button></div>}
        <strong className="shrink-0 text-sm">{formatMoney(item.line_total_centavos)}</strong>
        <button onClick={()=>onRemove(item.id)} aria-label={`Remove ${item.product_name_snapshot}`} title="Remove" className="shrink-0 rounded-lg p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={16}/></button>
      </div>)}
    </div>
    <div className="mt-5 border-t pt-4">
      <div className="mb-4 flex justify-between text-xl font-bold"><span>Total</span><span>{formatMoney(total)}</span></div>
      <fieldset className="mb-4"><legend className="mb-2 text-sm font-semibold">Payment method</legend><div className="grid grid-cols-2 gap-2">{(['CASH','GCASH'] as PaymentMethod[]).map(method=><button type="button" key={method} onClick={()=>onPaymentMethodChange(method)} className={`rounded-xl border px-3 py-2.5 font-bold ${paymentMethod===method?'border-brand-500 bg-brand-50 text-brand-900':'bg-white'}`}>{method==='GCASH'?'GCash':'Cash'}</button>)}</div></fieldset>
      {paymentMethod==='CASH'&&<div className="mb-4"><label className="text-sm font-semibold">Cash received<div className="mt-1 flex items-center rounded-xl border bg-white px-3"><span className="text-stone-500">₱</span><input type="number" min="0" step="0.01" inputMode="decimal" value={cashReceived} onChange={event=>onCashReceivedChange(event.target.value)} placeholder="0.00" className="w-full px-2 py-2.5 outline-none"/></div></label><div className={`mt-2 flex justify-between rounded-xl p-3 font-bold ${cashReceived&&!cashValid?'bg-red-50 text-red-700':'bg-stone-50'}`}><span>{cashReceived&&!cashValid?'Insufficient cash':'Change'}</span><span>{formatMoney(change)}</span></div></div>}
      <button onClick={onComplete} disabled={processing||!order||!canCompleteOrder(order.status,items.length)||!cashValid} className="w-full rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-50">{processing?'PROCESSING...':'COMPLETE ORDER'}</button><button onClick={onCancel} disabled={processing||items.length===0} className="mt-2 w-full rounded-xl py-2 text-sm font-semibold text-red-600 disabled:opacity-50">Cancel order</button>
    </div>
  </aside>
}
