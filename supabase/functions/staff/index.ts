import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

type StaffRequest={action:"create"|"update"|"delete";id?:string;full_name?:string;username?:string;contact_email?:string;password?:string}
const usernamePattern=/^[a-z0-9._-]{3,32}$/
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
function fail(detail:string,status=400){return json({detail},status)}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{status:200,headers:corsHeaders})
  if(req.method!=="POST")return fail("Method not allowed",405)

  const authorization=req.headers.get("Authorization")
  if(!authorization?.startsWith("Bearer "))return fail("Authentication required",401)
  const supabaseUrl=Deno.env.get("SUPABASE_URL")
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if(!supabaseUrl||!serviceKey)return fail("Function configuration is unavailable",500)
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error:userError}=await admin.auth.getUser(authorization.slice(7))
  if(userError||!user)return fail("Invalid or expired session",401)
  const {data:owner}=await admin.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle()
  if(!owner?.is_active||owner.role!=="OWNER")return fail("Owner access required",403)

  let input:StaffRequest
  try{input=await req.json()}catch{return fail("Invalid request body")}
  if(input.action==="create"){
    const fullName=input.full_name?.trim();const username=input.username?.trim().toLowerCase();const contactEmail=input.contact_email?.trim().toLowerCase();const password=input.password??""
    if(!fullName||!usernamePattern.test(username??"")||!emailPattern.test(contactEmail??"")||password.length<8||password.length>72)return fail("Enter a valid name, username, contact email, and password of 8–72 characters.")
    const {data,error}=await admin.auth.admin.createUser({email:`${username}@coffee-shop.local`,password,email_confirm:true,user_metadata:{full_name:fullName,role:"STAFF"}})
    if(error||!data.user)return fail("Username already exists or staff creation failed",409)
    const {error:profileError}=await admin.from("profiles").update({contact_email:contactEmail}).eq("id",data.user.id)
    if(profileError){await admin.auth.admin.deleteUser(data.user.id);return fail("Contact email already exists or staff profile creation failed",409)}
    return json({id:data.user.id,full_name:fullName,username,contact_email:contactEmail})
  }

  if(!input.id)return fail("Staff account ID is required")
  const {data:staff}=await admin.from("profiles").select("id,role").eq("id",input.id).maybeSingle()
  if(!staff||staff.role!=="STAFF")return fail("Staff account not found",404)
  if(input.action==="update"){
    const fullName=input.full_name?.trim();const username=input.username?.trim().toLowerCase();const contactEmail=input.contact_email?.trim().toLowerCase()
    if(!fullName||!usernamePattern.test(username??"")||!emailPattern.test(contactEmail??"")||(input.password!==undefined&&(input.password.length<8||input.password.length>72)))return fail("Enter valid staff details and a password of 8–72 characters.")
    const attributes:{email:string;user_metadata:{full_name:string;role:string};password?:string}={email:`${username}@coffee-shop.local`,user_metadata:{full_name:fullName,role:"STAFF"}}
    if(input.password)attributes.password=input.password
    const {error:authError}=await admin.auth.admin.updateUserById(input.id,attributes)
    if(authError)return fail("Username already exists or staff update failed",409)
    const {error:profileError}=await admin.from("profiles").update({full_name:fullName,username,contact_email:contactEmail}).eq("id",input.id)
    if(profileError)return fail("Staff profile update failed",409)
    return json({id:input.id,full_name:fullName,username,contact_email:contactEmail})
  }
  if(input.action==="delete"){
    await admin.from("attendance_sessions").update({clocked_out_at:new Date().toISOString()}).eq("staff_id",input.id).is("clocked_out_at",null)
    const {error:profileError}=await admin.from("profiles").update({is_active:false}).eq("id",input.id)
    if(profileError)return fail("Unable to deactivate staff account",409)
    const {error:authError}=await admin.auth.admin.updateUserById(input.id,{ban_duration:"876000h"})
    if(authError)return fail("Unable to disable staff login",409)
    return json({deleted:true})
  }
  return fail("Unknown staff action")
})
