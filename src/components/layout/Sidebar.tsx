import { Coffee,Menu,ReceiptText,ShoppingCart,X } from 'lucide-react'
import { useEffect,useState } from 'react'
import { Link,NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const links=[
  {to:'/pos',label:'POS',icon:ShoppingCart},
  {to:'/orders',label:'Orders',icon:ReceiptText}
]

export function Sidebar(){
  const [open,setOpen]=useState(false)
  const [isOwner,setIsOwner]=useState(false)
  useEffect(()=>{void supabase.auth.getUser().then(async({data:{user}})=>{if(!user)return;const {data}=await supabase.from('profiles').select('role').eq('id',user.id).single();setIsOwner(data?.role==='OWNER')})},[])

  return <>
    {!open&&<button className="fixed left-3 top-3 z-50 rounded-lg bg-brand-900 p-2 text-white lg:hidden" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu/></button>}
    {open&&<button className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
    <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col overflow-hidden bg-brand-900 p-5 text-white transition-transform lg:static lg:translate-x-0 ${open?'translate-x-0':'-translate-x-full'}`}>
      <div className="mb-10 flex items-center gap-3 text-xl font-bold">
        <Link to={isOwner?'/admin':'/staff-settings'} onClick={()=>setOpen(false)} aria-label={isOwner?'Open admin settings':'Open staff settings'} className="rounded-xl bg-brand-500 p-2 text-white hover:bg-brand-600"><Coffee/></Link>
        <span>CUP LAB</span>
        <button type="button" onClick={()=>setOpen(false)} aria-label="Close navigation" className="ml-auto bg-transparent p-1 text-red-500 hover:text-red-400 lg:hidden"><X/></button>
      </div>
      <nav className="space-y-2" aria-label="Main navigation">
        {links.map(({to,label,icon:Icon})=><NavLink key={to} to={to} onClick={()=>setOpen(false)} className={({isActive})=>`flex items-center gap-3 rounded-xl px-4 py-3 font-medium ${isActive?'bg-brand-500':'text-stone-300 hover:bg-white/10 hover:text-white'}`}><Icon size={20}/>{label}</NavLink>)}
      </nav>
    </aside>
  </>
}
