import os
import secrets
import time
from collections import defaultdict,deque
from datetime import datetime,timezone
from typing import Annotated

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import Depends,FastAPI,File,Form,Header,HTTPException,Request,UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,Field
from supabase import Client,create_client
from uniface.detection import RetinaFace
from uniface.recognition import ArcFace
from uniface.spoofing import MiniFASNet

load_dotenv(os.path.join(os.path.dirname(__file__),'.env'))
load_dotenv(os.path.join(os.path.dirname(__file__),'..','.env'))

SUPABASE_URL=os.environ.get('SUPABASE_URL')
SUPABASE_SECRET_KEY=os.environ.get('SUPABASE_SECRET_KEY','')
FRONTEND_ORIGINS=[value.strip() for value in os.environ.get('FRONTEND_ORIGIN','http://localhost:5173').split(',') if value.strip()]
MATCH_THRESHOLD=float(os.environ.get('FACE_MATCH_THRESHOLD','0.60'))
REAL_THRESHOLD=float(os.environ.get('FACE_REAL_THRESHOLD','0.70'))
if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError('SUPABASE_URL and SUPABASE_SECRET_KEY are required')

db:Client=create_client(SUPABASE_URL,SUPABASE_SECRET_KEY)
detector=RetinaFace()
recognizer=ArcFace()
spoofer=MiniFASNet()
app=FastAPI(title='CUP LAB Face Authentication',docs_url=None,redoc_url=None)
app.add_middleware(CORSMiddleware,allow_origins=FRONTEND_ORIGINS,allow_credentials=False,allow_methods=['GET','POST','PATCH','DELETE'],allow_headers=['Authorization','Content-Type'])
attempts:dict[str,deque[float]]=defaultdict(deque)

class EnrollmentFields(BaseModel):
    full_name:str=Field(min_length=1,max_length=120)
    username:str=Field(pattern=r'^[a-z0-9._-]{3,32}$')

class StaffUpdate(BaseModel):
    full_name:str=Field(min_length=1,max_length=120)
    username:str=Field(pattern=r'^[a-z0-9._-]{3,32}$')

def bearer_token(authorization:Annotated[str|None,Header()]=None)->str:
    if not authorization or not authorization.startswith('Bearer '):raise HTTPException(401,'Authentication required')
    return authorization[7:]

def require_owner(token:Annotated[str,Depends(bearer_token)]):
    try:user=db.auth.get_user(token).user
    except Exception as exc:raise HTTPException(401,'Invalid session') from exc
    profile=db.table('profiles').select('id,role,is_active').eq('id',str(user.id)).single().execute().data
    if not profile or not profile['is_active'] or profile['role']!='OWNER':raise HTTPException(403,'Owner access required')
    return user

def require_staff(token:Annotated[str,Depends(bearer_token)]):
    try:user=db.auth.get_user(token).user
    except Exception as exc:raise HTTPException(401,'Invalid session') from exc
    profile=db.table('profiles').select('id,role,is_active').eq('id',str(user.id)).single().execute().data
    if not profile or not profile['is_active'] or profile['role']!='STAFF':raise HTTPException(403,'Active staff access required')
    return user

async def decode_face(upload:UploadFile):
    raw=await upload.read(5*1024*1024+1)
    if len(raw)>5*1024*1024:raise HTTPException(413,'Image is larger than 5 MB')
    image=cv2.imdecode(np.frombuffer(raw,np.uint8),cv2.IMREAD_COLOR)
    if image is None:raise HTTPException(400,'Invalid camera image')
    faces=detector.detect(image)
    if len(faces)!=1:raise HTTPException(400,'Show exactly one face to the camera')
    live=spoofer.predict(image,faces[0].bbox)
    if not live.is_real or live.confidence<REAL_THRESHOLD:raise HTTPException(400,'Live face verification failed')
    embedding=recognizer.get_normalized_embedding(image,faces[0].landmarks)
    return np.asarray(embedding,dtype=np.float32)

def enforce_rate_limit(request:Request,limit:int=5):
    key=request.client.host if request.client else 'unknown';now=time.monotonic();window=attempts[key]
    while window and now-window[0]>60:window.popleft()
    if len(window)>=limit:raise HTTPException(429,'Too many attempts. Wait one minute.')
    window.append(now)

@app.get('/health')
def health():return {'status':'ok'}

@app.post('/enroll')
async def enroll(full_name:str=Form(...),username:str=Form(...),image:UploadFile=File(...),owner=Depends(require_owner)):
    fields=EnrollmentFields(full_name=full_name.strip(),username=username.strip().lower())
    embedding=await decode_face(image)
    email=f'{fields.username}@coffee-shop.local'
    profile_id=None
    try:
        created=db.auth.admin.create_user({'email':email,'password':secrets.token_urlsafe(32),'email_confirm':True,'user_metadata':{'full_name':fields.full_name,'role':'STAFF'}})
        profile_id=str(created.user.id)
        db.table('face_credentials').insert({'profile_id':profile_id,'embedding':embedding.tolist(),'model':'uniface-arcface'}).execute()
    except Exception as exc:
        if profile_id:
            try:db.auth.admin.delete_user(profile_id)
            except Exception:pass
        raise HTTPException(409,'Username already exists or staff enrollment failed') from exc
    return {'id':profile_id,'full_name':fields.full_name,'username':fields.username}

@app.patch('/staff/{profile_id}')
def update_staff(profile_id:str,fields:StaffUpdate,owner=Depends(require_owner)):
    profile=db.table('profiles').select('id,role').eq('id',profile_id).single().execute().data
    if not profile or profile['role']!='STAFF':raise HTTPException(404,'Staff account not found')
    try:
        db.auth.admin.update_user_by_id(profile_id,{'email':f'{fields.username}@coffee-shop.local','user_metadata':{'full_name':fields.full_name,'role':'STAFF'}})
        db.table('profiles').update({'full_name':fields.full_name,'username':fields.username}).eq('id',profile_id).execute()
    except Exception as exc:raise HTTPException(409,'Username already exists or staff update failed') from exc
    return {'id':profile_id,'full_name':fields.full_name,'username':fields.username}

@app.delete('/staff/{profile_id}')
def delete_staff(profile_id:str,owner=Depends(require_owner)):
    profile=db.table('profiles').select('id,role').eq('id',profile_id).single().execute().data
    if not profile or profile['role']!='STAFF':raise HTTPException(404,'Staff account not found')
    db.table('attendance_sessions').update({'clocked_out_at':datetime.now(timezone.utc).isoformat()}).eq('staff_id',profile_id).is_('clocked_out_at','null').execute()
    db.table('face_credentials').delete().eq('profile_id',profile_id).execute()
    db.table('profiles').update({'is_active':False}).eq('id',profile_id).execute()
    return {'deleted':True}

@app.post('/verify')
async def verify(request:Request,image:UploadFile=File(...)):
    enforce_rate_limit(request,20)
    probe=await decode_face(image)
    credentials=db.table('face_credentials').select('profile_id,embedding,profiles!face_credentials_profile_id_fkey(full_name,username,is_active)').execute().data or []
    if not credentials:raise HTTPException(401,'No enrolled staff matched')
    best=None;best_score=-1.0
    for credential in credentials:
        enrolled=np.asarray(credential['embedding'],dtype=np.float32)
        score=float(np.dot(probe,enrolled)/(np.linalg.norm(probe)*np.linalg.norm(enrolled)))
        if score>best_score:best,best_score=credential,score
    if best is None or best_score<MATCH_THRESHOLD:raise HTTPException(401,'Face not recognized')
    profile=best.get('profiles')
    if isinstance(profile,list):profile=profile[0] if profile else None
    if not profile or not profile['is_active']:raise HTTPException(403,'Staff account is inactive')
    link=db.auth.admin.generate_link({'type':'magiclink','email':f"{profile['username']}@coffee-shop.local"})
    token_hash=getattr(link.properties,'hashed_token',None)
    if not token_hash:raise HTTPException(500,'Unable to create login session')
    return {'token_hash':token_hash,'full_name':profile['full_name'],'score':round(best_score,3)}

@app.post('/verify-current')
async def verify_current(request:Request,image:UploadFile=File(...),staff=Depends(require_staff)):
    enforce_rate_limit(request,20)
    probe=await decode_face(image)
    credential=db.table('face_credentials').select('embedding').eq('profile_id',str(staff.id)).single().execute().data
    if not credential:raise HTTPException(404,'No face is enrolled for this staff account')
    enrolled=np.asarray(credential['embedding'],dtype=np.float32)
    score=float(np.dot(probe,enrolled)/(np.linalg.norm(probe)*np.linalg.norm(enrolled)))
    if score<MATCH_THRESHOLD:raise HTTPException(401,'Face does not match the logged-in staff member')
    return {'verified':True,'score':round(score,3)}
