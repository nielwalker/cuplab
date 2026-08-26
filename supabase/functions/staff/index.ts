import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

type StaffRequest={action:"create"|"update"|"delete";id?:string;full_name?:string;username?:string;password?:string}
const usernamePattern=/^[a-z0-9._-]{3,32}$/
function fail(detail:string,status=400){return Response.json({detail},{status})}

export default {
  fetch:withSupabase({auth:"user"},async(req,ctx)=>{
    if(req.method!=="POST")return fail("Method not allowed",405)
    const userId=ctx.userClaims?.sub
    if(!userId)return fail("Authentication required",401)
    const {data:owner}=await ctx.supabaseAdmin.from("profiles").select("role,is_active").eq("id",userId).maybeSingle()
    if(!owner?.is_active||owner.role!=="OWNER")return fail("Owner access required",403)

    let input:StaffRequest
    try{input=await req.json()}catch{return fail("Invalid request body")}
    if(input.action==="create"){
      const fullName=input.full_name?.trim();const username=input.username?.trim().toLowerCase();const password=input.password??""
      if(!fullName||!usernamePattern.test(username??"")||password.length<8||password.length>72)return fail("Enter a valid name, username, and password of 8–72 characters.")
      const {data,error}=await ctx.supabaseAdmin.auth.admin.createUser({email:`${username}@coffee-shop.local`,password,email_confirm:true,user_metadata:{full_name:fullName,role:"STAFF"}})
      if(error||!data.user)return fail("Username already exists or staff creation failed",409)
      return Response.json({id:data.user.id,full_name:fullName,username})
    }

    if(!input.id)return fail("Staff account ID is required")
    const {data:staff}=await ctx.supabaseAdmin.from("profiles").select("id,role").eq("id",input.id).maybeSingle()
    if(!staff||staff.role!=="STAFF")return fail("Staff account not found",404)
    if(input.action==="update"){
      const fullName=input.full_name?.trim();const username=input.username?.trim().toLowerCase()
      if(!fullName||!usernamePattern.test(username??"")||(input.password!==undefined&&(input.password.length<8||input.password.length>72)))return fail("Enter valid staff details and a password of 8–72 characters.")
      const attributes:{email:string;user_metadata:{full_name:string;role:string};password?:string}={email:`${username}@coffee-shop.local`,user_metadata:{full_name:fullName,role:"STAFF"}}
      if(input.password)attributes.password=input.password
      const {error:authError}=await ctx.supabaseAdmin.auth.admin.updateUserById(input.id,attributes)
      if(authError)return fail("Username already exists or staff update failed",409)
      const {error:profileError}=await ctx.supabaseAdmin.from("profiles").update({full_name:fullName,username}).eq("id",input.id)
      if(profileError)return fail("Staff profile update failed",409)
      return Response.json({id:input.id,full_name:fullName,username})
    }
    if(input.action==="delete"){
      await ctx.supabaseAdmin.from("attendance_sessions").update({clocked_out_at:new Date().toISOString()}).eq("staff_id",input.id).is("clocked_out_at",null)
      const {error:profileError}=await ctx.supabaseAdmin.from("profiles").update({is_active:false}).eq("id",input.id)
      if(profileError)return fail("Unable to deactivate staff account",409)
      const {error:authError}=await ctx.supabaseAdmin.auth.admin.updateUserById(input.id,{ban_duration:"876000h"})
      if(authError)return fail("Unable to disable staff login",409)
      return Response.json({deleted:true})
    }
    return fail("Unknown staff action")
  })
}
