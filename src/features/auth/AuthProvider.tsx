/* eslint-disable react-refresh/only-export-components */
import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { clearQueryCache } from '../../lib/queryCache'
type AuthContextValue={session:Session|null;loading:boolean;signOut:()=>Promise<void>}
const AuthContext=createContext<AuthContextValue|undefined>(undefined)
export function AuthProvider({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let active=true;let newerAuthEventSeen=false
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
      if(!active)return
      if(event==='INITIAL_SESSION')return
      newerAuthEventSeen=true
      if(event==='SIGNED_OUT')clearQueryCache()
      setSession(next);setLoading(false)
    })
    void (async()=>{
      const {data:{session:storedSession}}=await supabase.auth.getSession()
      if(!storedSession){if(active&&!newerAuthEventSeen){setSession(null);setLoading(false)};return}
      const {data:{user},error}=await supabase.auth.getUser(storedSession.access_token)
      if(!active||newerAuthEventSeen)return
      if(error||!user){clearQueryCache();setSession(null);setLoading(false);await supabase.auth.signOut({scope:'local'});return}
      setSession(storedSession);setLoading(false)
    })()
    return()=>{active=false;subscription.unsubscribe()}
  },[])
  const value=useMemo(()=>({session,loading,signOut:async()=>{await supabase.rpc('end_attendance');await supabase.rpc('log_auth_event',{p_action:'LOGOUT'});clearQueryCache();await supabase.auth.signOut()}}),[session,loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within AuthProvider');return value}
