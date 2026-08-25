import { useEffect,useRef,useState } from 'react'
import { LoaderCircle,ScanFace } from 'lucide-react'

export function AutoFaceCamera({onScan,paused,pausedLabel='Face matched'}:{onScan:(image:Blob)=>Promise<void>;paused:boolean;pausedLabel?:string}){
  const videoRef=useRef<HTMLVideoElement>(null);const scanningRef=useRef(false);const pausedRef=useRef(paused);const [cameraError,setCameraError]=useState('')
  useEffect(()=>{pausedRef.current=paused},[paused])
  useEffect(()=>{
    let stream:MediaStream|undefined;let mounted=true
    void navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false}).then(value=>{if(!mounted){value.getTracks().forEach(track=>track.stop());return}stream=value;if(videoRef.current)videoRef.current.srcObject=value}).catch(()=>{if(mounted)setCameraError('Camera access is required for face verification.')})
    const timer=window.setInterval(()=>{const video=videoRef.current;if(pausedRef.current||scanningRef.current||!video||video.readyState<2)return;const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d')?.drawImage(video,0,0);scanningRef.current=true;canvas.toBlob(blob=>{if(!blob){scanningRef.current=false;return}void onScan(blob).finally(()=>{scanningRef.current=false})},'image/jpeg',.9)},3000)
    return()=>{mounted=false;window.clearInterval(timer);stream?.getTracks().forEach(track=>track.stop())}
  },[onScan])
  return <div><div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-900"><video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover"/><div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 p-3 text-sm font-semibold text-white">{paused?<><LoaderCircle className="animate-spin" size={17}/>{pausedLabel}</>:<><ScanFace size={18}/>Looking for your face...</>}</div></div>{cameraError&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{cameraError}</p>}</div>
}
