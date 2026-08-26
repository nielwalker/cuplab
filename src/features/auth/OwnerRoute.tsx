import { useEffect,useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Navigate,Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type OwnerState='loading'|'owner'|'denied'|'schema-error'

export function OwnerRoute(){
  const [state,setState]=useState<OwnerState>('loading')
  useEffect(()=>{void supabase.auth.getUser().then(async({data:{user}})=>{if(!user){setState('denied');return}const {data,error}=await supabase.from('profiles').select('role').eq('id',user.id).single()
    if(error){setState(error.code==='42703'||error.message.toLowerCase().includes('role')?'schema-error':'denied');return}
    setState(data?.role==='OWNER'?'owner':'denied')
  })},[])
  if(state==='loading')return <div className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin"/></div>
  if(state==='schema-error')return <div className="grid min-h-full place-items-center p-6"><div role="alert" className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900"><h1 className="text-lg font-bold">Staff database setup required</h1><p className="mt-2 text-sm">Apply all pending Supabase migrations, then reload this page.</p></div></div>
  return state==='owner'?<Outlet/>:<Navigate to="/pos" replace/>
}
