import os
from datetime import datetime,timezone
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends,FastAPI,Header,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,Field
from supabase import Client,create_client

load_dotenv(os.path.join(os.path.dirname(__file__),'.env'))
load_dotenv(os.path.join(os.path.dirname(__file__),'..','.env'))
SUPABASE_URL=os.environ.get('SUPABASE_URL');SUPABASE_SECRET_KEY=os.environ.get('SUPABASE_SECRET_KEY','')
FRONTEND_ORIGINS=[value.strip() for value in os.environ.get('FRONTEND_ORIGIN','http://localhost:5173').split(',') if value.strip()]
if not SUPABASE_URL or not SUPABASE_SECRET_KEY:raise RuntimeError('SUPABASE_URL and SUPABASE_SECRET_KEY are required')

db:Client=create_client(SUPABASE_URL,SUPABASE_SECRET_KEY)
app=FastAPI(title='CUP LAB Staff Management',docs_url=None,redoc_url=None)
app.add_middleware(CORSMiddleware,allow_origins=FRONTEND_ORIGINS,allow_credentials=False,allow_methods=['GET','POST','PATCH','DELETE'],allow_headers=['Authorization','Content-Type'])

class StaffCreate(BaseModel):
    full_name:str=Field(min_length=1,max_length=120)
    username:str=Field(pattern=r'^[a-z0-9._-]{3,32}$')
    password:str=Field(min_length=8,max_length=72)

class StaffUpdate(BaseModel):
    full_name:str=Field(min_length=1,max_length=120)
    username:str=Field(pattern=r'^[a-z0-9._-]{3,32}$')
    password:str|None=Field(default=None,min_length=8,max_length=72)

def bearer_token(authorization:Annotated[str|None,Header()]=None)->str:
    if not authorization or not authorization.startswith('Bearer '):raise HTTPException(401,'Authentication required')
    return authorization[7:]

def require_owner(token:Annotated[str,Depends(bearer_token)]):
    try:user=db.auth.get_user(token).user
    except Exception as exc:raise HTTPException(401,'Invalid session') from exc
    profile=db.table('profiles').select('id,role,is_active').eq('id',str(user.id)).single().execute().data
    if not profile or not profile['is_active'] or profile['role']!='OWNER':raise HTTPException(403,'Owner access required')
    return user

@app.get('/health')
def health():return {'status':'ok'}

@app.post('/staff')
def create_staff(fields:StaffCreate,owner=Depends(require_owner)):
    email=f'{fields.username}@coffee-shop.local';profile_id=None
    try:
        created=db.auth.admin.create_user({'email':email,'password':fields.password,'email_confirm':True,'user_metadata':{'full_name':fields.full_name,'role':'STAFF'}})
        profile_id=str(created.user.id)
    except Exception as exc:
        if profile_id:
            try:db.auth.admin.delete_user(profile_id)
            except Exception:pass
        raise HTTPException(409,'Username already exists or staff creation failed') from exc
    return {'id':profile_id,'full_name':fields.full_name,'username':fields.username}

@app.patch('/staff/{profile_id}')
def update_staff(profile_id:str,fields:StaffUpdate,owner=Depends(require_owner)):
    profile=db.table('profiles').select('id,role').eq('id',profile_id).single().execute().data
    if not profile or profile['role']!='STAFF':raise HTTPException(404,'Staff account not found')
    attributes={'email':f'{fields.username}@coffee-shop.local','user_metadata':{'full_name':fields.full_name,'role':'STAFF'}}
    if fields.password:attributes['password']=fields.password
    try:
        db.auth.admin.update_user_by_id(profile_id,attributes)
        db.table('profiles').update({'full_name':fields.full_name,'username':fields.username}).eq('id',profile_id).execute()
    except Exception as exc:raise HTTPException(409,'Username already exists or staff update failed') from exc
    return {'id':profile_id,'full_name':fields.full_name,'username':fields.username}

@app.delete('/staff/{profile_id}')
def delete_staff(profile_id:str,owner=Depends(require_owner)):
    profile=db.table('profiles').select('id,role').eq('id',profile_id).single().execute().data
    if not profile or profile['role']!='STAFF':raise HTTPException(404,'Staff account not found')
    db.table('attendance_sessions').update({'clocked_out_at':datetime.now(timezone.utc).isoformat()}).eq('staff_id',profile_id).is_('clocked_out_at','null').execute()
    db.table('profiles').update({'is_active':False}).eq('id',profile_id).execute()
    db.auth.admin.update_user_by_id(profile_id,{'ban_duration':'876000h'})
    return {'deleted':True}
