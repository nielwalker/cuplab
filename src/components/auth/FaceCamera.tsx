import { useEffect,useRef,useState } from 'react'
import { Camera,LoaderCircle } from 'lucide-react'

export function FaceCamera({onCapture,busy,label}:{onCapture:(image:Blob)=>void;busy:boolean;label:string}){
  const videoRef=useRef<HTMLVideoElement>(null)
  const [cameraError,setCameraError]=useState('')
  useEffect(()=>{let stream:MediaStream|undefined;void navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false}).then(value=>{stream=value;if(videoRef.current)videoRef.current.srcObject=value}).catch(()=>setCameraError('Camera access is required. Allow the camera and try again.'));return()=>stream?.getTracks().forEach(track=>track.stop())},[])
  function capture(){const video=videoRef.current;if(!video||video.readyState<2)return;const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d')?.drawImage(video,0,0);canvas.toBlob(blob=>{if(blob)onCapture(blob)},'image/jpeg',.9)}
  return <div><div className="aspect-[4/3] overflow-hidden rounded-2xl bg-stone-900"><video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover"/></div>{cameraError&&<p role="alert" className="mt-3 text-sm text-red-700">{cameraError}</p>}<button type="button" onClick={capture} disabled={busy||Boolean(cameraError)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-50">{busy?<LoaderCircle className="animate-spin" size={18}/>:<Camera size={18}/>} {busy?'VERIFYING...':label}</button></div>
}
