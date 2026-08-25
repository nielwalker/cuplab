import { useCallback,useEffect,useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Order } from '../types/database'
import { deleteOrderPermanently,listOrders } from '../services/orders'
import { formatMoney } from '../utils/money'
import { supabase } from '../lib/supabase'

export function OrdersPage(){
  const [orders,setOrders]=useState<Order[]>([])
  const [error,setError]=useState('')
  const [deletingId,setDeletingId]=useState<string|null>(null)
  const [pendingDelete,setPendingDelete]=useState<Order|null>(null)
  const [password,setPassword]=useState('')
  const [passwordError,setPasswordError]=useState('')
  const load=useCallback(async()=>{try{setOrders(await listOrders());setError('')}catch{setError('Unable to load orders.')}},[])
  useEffect(()=>{void load()},[load])

  function requestDelete(order:Order){setPendingDelete(order);setPassword('');setPasswordError('')}
  function closeDelete(){if(deletingId)return;setPendingDelete(null);setPassword('');setPasswordError('')}

  async function remove(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!pendingDelete||!password)return
    setDeletingId(pendingDelete.id)
    setError('')
    setPasswordError('')
    try{
      const {data:{user},error:userError}=await supabase.auth.getUser()
      if(userError||!user?.email)throw new Error('SESSION')
      const {error:authError}=await supabase.auth.signInWithPassword({email:user.email,password})
      if(authError){setPasswordError('Incorrect password. The order was not deleted.');return}
      await deleteOrderPermanently(pendingDelete.id)
      setOrders(current=>current.filter(item=>item.id!==pendingDelete.id))
      setPendingDelete(null)
      setPassword('')
    }
    catch{setPasswordError('Unable to verify the password or delete this order.')}
    finally{setDeletingId(null)}
  }

  return <div className="p-4 pt-16 lg:p-8"><h1 className="text-2xl font-bold">Order History</h1><p className="mb-6 text-sm text-stone-500">Completed sales. Deletion permanently removes the selected sale from PostgreSQL.</p>{error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error} <button onClick={load} className="font-bold">Retry</button></p>}<div className="overflow-x-auto rounded-2xl bg-white"><table className="w-full min-w-[760px] text-left"><thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="p-4">Order number</th><th>Date</th><th>Time</th><th>Total</th><th>Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{orders.map(o=>{const date=new Date(o.created_at);return <tr key={o.id} className="border-b last:border-0"><td className="p-4"><Link className="font-semibold text-brand-600" to={`/orders/${o.id}`}>{o.order_number}</Link></td><td>{date.toLocaleDateString()}</td><td>{date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td><td>{formatMoney(o.total_centavos)}</td><td><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{o.status}</span></td><td className="p-4 text-right"><button onClick={()=>requestDelete(o)} disabled={deletingId===o.id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"><Trash2 size={16}/>Delete permanently</button></td></tr>})}{orders.length===0&&<tr><td colSpan={6} className="p-10 text-center text-stone-500">No completed orders.</td></tr>}</tbody></table></div>{pendingDelete&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-order-title"><form onSubmit={remove} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2/></div><h2 id="delete-order-title" className="text-xl font-bold">Delete {pendingDelete.order_number}?</h2><p className="mt-2 text-sm text-stone-600">Input password to delete record permanently.</p><label className="mt-5 block text-sm font-semibold">Password<input autoFocus name="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="mt-1.5 w-full rounded-xl border px-4 py-3 font-normal"/></label>{passwordError&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordError}</p>}<div className="mt-5 flex gap-3"><button type="button" onClick={closeDelete} disabled={Boolean(deletingId)} className="flex-1 rounded-xl border py-3 font-semibold">Cancel</button><button disabled={!password||Boolean(deletingId)} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">{deletingId?'Verifying...':'Verify and delete'}</button></div></form></div>}</div>
}
