import type { AttendanceSession,Profile } from '../types/database'
import { supabase } from '../lib/supabase'

async function staffRequest(body:Record<string,unknown>){const {data,error}=await supabase.functions.invoke('staff',{body});if(error){let detail='Staff request failed.';if(error.context instanceof Response){const result=await error.context.json().catch(()=>null) as {detail?:string}|null;detail=result?.detail??detail}throw new Error(detail)}return data}
export async function registerStaff(fullName:string,username:string,contactEmail:string,password:string){return staffRequest({action:'create',full_name:fullName,username,contact_email:contactEmail,password})}
export async function listStaff(){const {data,error}=await supabase.from('profiles').select('*').eq('role','STAFF').eq('is_active',true).order('full_name');if(error)throw error;return data as Profile[]}
export async function updateStaff(id:string,fullName:string,username:string,contactEmail:string,password?:string){return staffRequest({action:'update',id,full_name:fullName,username,contact_email:contactEmail,...(password?{password}:{})})}
export async function deleteStaff(id:string){return staffRequest({action:'delete',id})}
export async function listAttendance(){const {data,error}=await supabase.from('attendance_sessions').select('*,profiles(full_name)').order('clocked_in_at',{ascending:false}).limit(500);if(error)throw error;return data as AttendanceSession[]}
export async function startAttendance(method:'PASSWORD'){const {error}=await supabase.rpc('start_attendance',{p_login_method:method});if(error)throw error}
export async function endAttendance(){const {error}=await supabase.rpc('end_attendance');if(error)throw error}
