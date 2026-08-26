import type { AttendanceSession,Profile } from '../types/database'
import { supabase } from '../lib/supabase'

const staffApiUrl=(import.meta.env.VITE_STAFF_API_URL as string|undefined)?.replace(/\/$/,'')??''

async function staffRequest(path:string,method:'POST'|'PATCH'|'DELETE',body?:unknown){if(!staffApiUrl)throw new Error('Staff service URL is not configured.');const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Owner session required');const response=await fetch(`${staffApiUrl}${path}`,{method,headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await response.json().catch(()=>({detail:'Staff service returned an invalid response.'}));if(!response.ok)throw new Error(result.detail??'Staff request failed.');return result}
export async function registerStaff(fullName:string,username:string,password:string){return staffRequest('/staff','POST',{full_name:fullName,username,password})}
export async function listStaff(){const {data,error}=await supabase.from('profiles').select('*').eq('role','STAFF').eq('is_active',true).order('full_name');if(error)throw error;return data as Profile[]}
export async function updateStaff(id:string,fullName:string,username:string,password?:string){return staffRequest(`/staff/${id}`,'PATCH',{full_name:fullName,username,...(password?{password}:{})})}
export async function deleteStaff(id:string){return staffRequest(`/staff/${id}`,'DELETE')}
export async function listAttendance(){const {data,error}=await supabase.from('attendance_sessions').select('*,profiles(full_name)').order('clocked_in_at',{ascending:false}).limit(500);if(error)throw error;return data as AttendanceSession[]}
export async function startAttendance(method:'PASSWORD'){const {error}=await supabase.rpc('start_attendance',{p_login_method:method});if(error)throw error}
export async function endAttendance(){const {error}=await supabase.rpc('end_attendance');if(error)throw error}
