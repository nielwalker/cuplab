import { useState } from 'react'
import { Navigate,useLocation,useNavigate } from 'react-router-dom'
import { Coffee,LoaderCircle } from 'lucide-react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { startAttendance } from '../services/staff'
import { usernameToAuthEmail } from '../utils/auth'

const schema=z.object({username:z.string().trim().min(3,'Enter a valid username.'),password:z.string().min(8,'Password must be at least 8 characters.')})

export function LoginPage(){
  const {session}=useAuth();const navigate=useNavigate();const location=useLocation();const [error,setError]=useState('');const [loading,setLoading]=useState(false)
  if(session)return <Navigate to="/pos" replace/>
  async function login(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    const form=new FormData(event.currentTarget);const parsed=schema.safeParse({username:form.get('username'),password:form.get('password')})
    if(!parsed.success){setError(parsed.error.issues[0].message);return}
    let email:string
    try{email=usernameToAuthEmail(parsed.data.username)}catch(cause){setError(cause instanceof Error?cause.message:'Enter a valid username.');return}
    setLoading(true)
    try{
      const {data,error:authError}=await supabase.auth.signInWithPassword({email,password:parsed.data.password})
      if(authError||!data.user)throw new Error('Incorrect username or password.')
      const {data:profile,error:profileError}=await supabase.from('profiles').select('role,is_active').eq('id',data.user.id).single()
      if(profileError||!profile?.is_active){await supabase.auth.signOut();throw new Error('This account is inactive or unavailable.')}
      if(profile.role==='STAFF')await startAttendance('PASSWORD')
      await supabase.rpc('log_auth_event',{p_action:'LOGIN'})
      const from=(location.state as {from?:{pathname?:string}})?.from?.pathname
      navigate(from||(profile.role==='OWNER'?'/admin':'/pos'),{replace:true})
    }catch(cause){await supabase.auth.signOut({scope:'local'});setError(cause instanceof Error?cause.message:'Login failed.')}finally{setLoading(false)}
  }
  return <main className="grid min-h-screen place-items-center bg-brand-900 p-5"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"><div className="mb-6 text-center"><Coffee className="mx-auto mb-3 text-brand-500" size={44}/><h1 className="text-2xl font-bold">CUP LAB</h1><p className="mt-1 text-sm text-stone-500">Sign in with your username and password</p></div><form onSubmit={login}><label className="mb-4 block text-sm font-semibold">Username<input name="username" autoComplete="username" required autoFocus className="mt-1.5 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="mb-5 block text-sm font-semibold">Password<input name="password" type="password" autoComplete="current-password" required className="mt-1.5 w-full rounded-xl border px-4 py-3 font-normal"/></label>{error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-60">{loading&&<LoaderCircle className="animate-spin" size={18}/>} {loading?'Logging in...':'Log in'}</button></form></section></main>
}
