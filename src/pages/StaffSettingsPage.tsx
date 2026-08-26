import { useState } from 'react'
import { LoaderCircle,LogOut } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'

export function StaffSettingsPage(){
  const {signOut}=useAuth();const [loggingOut,setLoggingOut]=useState(false);const [message,setMessage]=useState('')
  async function logout(){setLoggingOut(true);setMessage('');try{await signOut()}catch{setMessage('Unable to log out. Please try again.');setLoggingOut(false)}}
  return <div className="p-4 pt-16 lg:p-8"><div className="mx-auto max-w-xl"><h1 className="text-2xl font-bold">Staff Settings</h1><p className="mb-6 text-sm text-stone-500">Manage your current staff session.</p>{message&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-bold">End duty session</h2><p className="mt-1 text-sm text-stone-600">Logging out will clock you out and return to the sign-in screen.</p><button onClick={()=>void logout()} disabled={loggingOut} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">{loggingOut?<LoaderCircle className="animate-spin" size={18}/>:<LogOut size={18}/>} {loggingOut?'Logging out...':'Log out'}</button></section></div></div>
}
