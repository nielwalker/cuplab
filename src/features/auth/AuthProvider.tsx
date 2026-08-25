/* eslint-disable react-refresh/only-export-components */
import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { clearQueryCache } from '../../lib/queryCache'
type AuthContextValue={session:Session|null;loading:boolean;signOut:()=>Promise<void>}
const AuthContext=createContext<AuthContextValue|undefined>(undefined)
export function AuthProvider({children}:{children:ReactNode}) { const [session,setSession]=useState<Session|null>(null); const [loading,setLoading]=useState(true); useEffect(()=>{let active=true;void (async()=>{const [{data:{session:storedSession}},{data:{user},error}]=await Promise.all([supabase.auth.getSession(),supabase.auth.getUser()]);if(!active)return;if(error||!user){clearQueryCache();setSession(null);if(storedSession)await supabase.auth.signOut({scope:'local'})}else setSession(storedSession);setLoading(false)})();const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{if(event==='SIGNED_OUT')clearQueryCache();setSession(next);setLoading(false)});return()=>{active=false;subscription.unsubscribe()}},[]); const value=useMemo(()=>({session,loading,signOut:async()=>{await supabase.rpc('end_attendance');await supabase.rpc('log_auth_event',{p_action:'LOGOUT'});clearQueryCache();await supabase.auth.signOut()}}),[session,loading]); return <AuthContext.Provider value={value}>{children}</AuthContext.Provider> }
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within AuthProvider');return value}
