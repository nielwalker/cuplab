import { useEffect,useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Navigate,Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function StaffRoute(){const [role,setRole]=useState<'loading'|'STAFF'|'OWNER'|'denied'>('loading');useEffect(()=>{void supabase.auth.getUser().then(async({data:{user}})=>{if(!user){setRole('denied');return}const {data}=await supabase.from('profiles').select('role').eq('id',user.id).single();setRole(data?.role==='STAFF'?'STAFF':data?.role==='OWNER'?'OWNER':'denied')})},[]);if(role==='loading')return <div className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin"/></div>;if(role==='OWNER')return <Navigate to="/admin" replace/>;return role==='STAFF'?<Outlet/>:<Navigate to="/login" replace/>}
