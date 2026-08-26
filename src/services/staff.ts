import type { AttendanceSession,Profile } from '../types/database'
import { supabase } from '../lib/supabase'

const faceApiUrl=(import.meta.env.VITE_FACE_API_URL as string|undefined)?.replace(/\/$/,'')??''

async function faceRequest(path:string,form:FormData,authenticated=false){
  if(!faceApiUrl)throw new Error('Face service URL is not configured. Set VITE_FACE_API_URL and restart the app.')
  const headers:Record<string,string>={}
  if(authenticated){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Owner session required');headers.Authorization=`Bearer ${session.access_token}`}
  const response=await fetch(`${faceApiUrl}${path}`,{method:'POST',headers,body:form})
  const result=await response.json().catch(()=>({detail:`Face service returned an invalid response (${response.status}).`}))
  if(!response.ok)throw new Error(result.detail??'Face service request failed.')
  return result
}

async function staffRequest(path:string,method:'PATCH'|'DELETE',body?:unknown){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Owner session required');const response=await fetch(`${faceApiUrl}${path}`,{method,headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await response.json().catch(()=>({detail:'Staff service returned an invalid response.'}));if(!response.ok)throw new Error(result.detail??'Staff request failed.');return result}

export async function verifyFace(image:Blob){const form=new FormData();form.append('image',image,'login.jpg');return faceRequest('/verify',form) as Promise<{token_hash:string;full_name:string;score:number}>}
export async function verifyCurrentStaff(image:Blob){const form=new FormData();form.append('image',image,'logout.jpg');return faceRequest('/verify-current',form,true) as Promise<{verified:true;score:number}>}
export async function registerStaff(fullName:string,username:string,image:Blob){const form=new FormData();form.append('full_name',fullName);form.append('username',username);form.append('image',image,'enrollment.jpg');return faceRequest('/enroll',form,true)}
export async function listStaff(){const {data,error}=await supabase.from('profiles').select('*').eq('role','STAFF').eq('is_active',true).order('full_name');if(error)throw error;return data as Profile[]}
export async function updateStaff(id:string,fullName:string,username:string){return staffRequest(`/staff/${id}`,'PATCH',{full_name:fullName,username})}
export async function deleteStaff(id:string){return staffRequest(`/staff/${id}`,'DELETE')}
export async function listAttendance(){const {data,error}=await supabase.from('attendance_sessions').select('*,profiles(full_name)').order('clocked_in_at',{ascending:false}).limit(500);if(error)throw error;return data as AttendanceSession[]}
export async function startAttendance(method:'FACE'|'ADMIN_RECOVERY'){const {error}=await supabase.rpc('start_attendance',{p_login_method:method});if(error)throw error}
export async function endAttendance(){const {error}=await supabase.rpc('end_attendance');if(error)throw error}
