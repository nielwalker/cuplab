import { useCallback,useState } from 'react'
import { LogOut } from 'lucide-react'
import { AutoFaceCamera } from '../components/auth/AutoFaceCamera'
import { useAuth } from '../features/auth/AuthProvider'
import { verifyCurrentStaff } from '../services/staff'

export function StaffSettingsPage(){
  const {signOut}=useAuth();const [matched,setMatched]=useState(false);const [loggingOut,setLoggingOut]=useState(false);const [message,setMessage]=useState('')
  const scan=useCallback(async(image:Blob)=>{try{await verifyCurrentStaff(image);setMessage('');setMatched(true)}catch(error){const text=error instanceof Error?error.message:'';if(text.includes('does not match'))setMessage('Face mismatch. Make sure you\'re not wearing any accessories.');else if(text.includes('Too many'))setMessage(text)}},[])
  async function logout(){setLoggingOut(true);try{await signOut()}catch{setMessage('Unable to log out. Please try again.');setMatched(false);setLoggingOut(false)}}
  return <div className="p-4 pt-16 lg:p-8"><div className="mx-auto max-w-xl"><h1 className="text-2xl font-bold">Staff Settings</h1><p className="mb-6 text-sm text-stone-500">Look at the camera to verify your identity before logging out.</p>{message&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<section className="rounded-2xl bg-white p-6 shadow-sm"><AutoFaceCamera onScan={scan} paused={matched||loggingOut}/></section></div>
  {matched&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="logout-title"><section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><LogOut/></div><h2 id="logout-title" className="mt-4 text-xl font-bold">Face matched</h2><p className="mt-2 text-sm text-stone-600">Do you want to log out and end your current duty session?</p><div className="mt-6 flex gap-3"><button onClick={()=>setMatched(false)} disabled={loggingOut} className="flex-1 rounded-xl border py-3 font-semibold">Cancel</button><button onClick={()=>void logout()} disabled={loggingOut} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">{loggingOut?'Logging out...':'Log out'}</button></div></section></div>}
  </div>
}
