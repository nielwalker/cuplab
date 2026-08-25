import { useCallback,useEffect,useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Order,OrderWithItems } from '../types/database'
import { deleteOrderPermanently,getOrder,listOrders } from '../services/orders'
import { formatMoney } from '../utils/money'
import { supabase } from '../lib/supabase'

export function OrdersPage(){
  const [orders,setOrders]=useState<Order[]>([])
  const [error,setError]=useState('')
  const [selectedOrder,setSelectedOrder]=useState<OrderWithItems|null>(null)
  const [loadingOrderId,setLoadingOrderId]=useState<string|null>(null)
  const [detailError,setDetailError]=useState('')
  const [deletingId,setDeletingId]=useState<string|null>(null)
  const [pendingDelete,setPendingDelete]=useState<Order|null>(null)
  const [password,setPassword]=useState('')
  const [passwordError,setPasswordError]=useState('')
  const load=useCallback(async()=>{try{setOrders(await listOrders());setError('')}catch{setError('Unable to load orders.')}},[])
  useEffect(()=>{void load()},[load])

  async function openOrder(order:Order){
    setLoadingOrderId(order.id);setDetailError('')
    try{setSelectedOrder(await getOrder(order.id))}catch{setDetailError('Unable to load the items for this order.')}finally{setLoadingOrderId(null)}
  }
  function closeOrder(){if(!deletingId){setSelectedOrder(null);setDetailError('')}}
  function requestDelete(order:Order){setPendingDelete(order);setPassword('');setPasswordError('')}
  function closeDelete(){if(deletingId)return;setPendingDelete(null);setPassword('');setPasswordError('')}

  useEffect(()=>{
    if(!selectedOrder&&!pendingDelete)return
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'||deletingId)return
      if(pendingDelete){setPendingDelete(null);setPassword('');setPasswordError('')}
      else{setSelectedOrder(null);setDetailError('')}
    }
    window.addEventListener('keydown',onKeyDown)
    return()=>window.removeEventListener('keydown',onKeyDown)
  },[selectedOrder,pendingDelete,deletingId])

  async function remove(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!pendingDelete||!password)return
    setDeletingId(pendingDelete.id);setError('');setPasswordError('')
    try{
      const {data:{user},error:userError}=await supabase.auth.getUser()
      if(userError||!user?.email)throw new Error('SESSION')
      const {error:authError}=await supabase.auth.signInWithPassword({email:user.email,password})
      if(authError){setPasswordError('Incorrect password. The order was not deleted.');return}
      await deleteOrderPermanently(pendingDelete.id)
      setOrders(current=>current.filter(item=>item.id!==pendingDelete.id));setPendingDelete(null);setSelectedOrder(null);setPassword('')
    }catch{setPasswordError('Unable to verify the password or delete this order.')}finally{setDeletingId(null)}
  }

  return <div className="p-4 pt-16 lg:p-8">
    <h1 className="text-2xl font-bold">Order History</h1>
    <p className="mb-6 text-sm text-stone-500">Select an order to view its items and details.</p>
    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error} <button onClick={load} className="font-bold">Retry</button></p>}
    {detailError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{detailError}</p>}
    <div className="overflow-x-auto rounded-2xl bg-white"><table className="w-full min-w-[640px] text-left">
      <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="p-4">Order number</th><th>Date</th><th>Time</th><th>Total</th><th className="p-4">Status</th></tr></thead>
      <tbody>{orders.map(o=>{const date=new Date(o.created_at);const loading=loadingOrderId===o.id;return <tr key={o.id} role="button" tabIndex={0} aria-label={`View order ${o.order_number}`} onClick={()=>void openOrder(o)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();void openOrder(o)}}} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-stone-50 focus:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500">
        <td className="p-4 font-semibold text-brand-600">{loading?'Loading...':o.order_number}</td><td>{date.toLocaleDateString()}</td><td>{date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td><td>{formatMoney(o.total_centavos)}</td><td className="p-4"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{o.status}</span></td>
      </tr>})}{orders.length===0&&<tr><td colSpan={5} className="p-10 text-center text-stone-500">No completed orders.</td></tr>}</tbody>
    </table></div>

    {selectedOrder&&<div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="order-detail-title" onMouseDown={e=>{if(e.target===e.currentTarget)closeOrder()}}><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div><h2 id="order-detail-title" className="text-xl font-bold">Order {selectedOrder.order_number}</h2><p className="text-sm text-stone-500">{new Date(selectedOrder.created_at).toLocaleString()}</p></div>
      <div className="mt-5 divide-y border-y">{selectedOrder.order_items.map(item=><div key={item.id} className="flex items-start justify-between gap-4 py-3"><div><p className="font-semibold">{item.product_name_snapshot}</p><p className="text-xs text-stone-500">{item.weight_kg!=null?`${item.weight_kg} kg × ${formatMoney(item.unit_price_centavos_snapshot)}`:`${item.quantity??0} × ${formatMoney(item.unit_price_centavos_snapshot)}`}</p></div><span className="whitespace-nowrap font-medium">{formatMoney(item.line_total_centavos)}</span></div>)}{selectedOrder.order_items.length===0&&<p className="py-6 text-center text-stone-500">No items found for this order.</p>}</div>
      <div className="mt-4 flex justify-between text-xl font-bold"><span>Total</span><span>{formatMoney(selectedOrder.total_centavos)}</span></div>
      <div className="mt-6 border-t"></div>
      <div className="mt-6 flex justify-end"><button onClick={()=>requestDelete(selectedOrder)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 size={16}/>Delete</button></div>
    </section></div>}

    {pendingDelete&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-order-title"><form onSubmit={remove} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2/></div><h2 id="delete-order-title" className="text-xl font-bold">Delete {pendingDelete.order_number}?</h2><p className="mt-2 text-sm text-stone-600">Input password to delete record permanently.</p><label className="mt-5 block text-sm font-semibold">Password<input autoFocus name="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="mt-1.5 w-full rounded-xl border px-4 py-3 font-normal"/></label>{passwordError&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordError}</p>}<div className="mt-5 flex gap-3"><button type="button" onClick={closeDelete} disabled={Boolean(deletingId)} className="flex-1 rounded-xl border py-3 font-semibold">Cancel</button><button disabled={!password||Boolean(deletingId)} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">{deletingId?'Verifying...':'Verify and delete'}</button></div></form></div>}
  </div>
}
