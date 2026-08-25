import { useCallback,useEffect,useState } from 'react'
import { Pencil,Plus,Save,Trash2,X } from 'lucide-react'
import { z } from 'zod'
import type { IcePriceTier } from '../types/database'
import { deleteIceTier,listIceTiers,saveIceTier,updateIceTier } from '../services/products'
import { formatMoney,pesosToCentavos } from '../utils/money'

const tierSchema=z.object({min_kg:z.coerce.number().positive(),max_kg:z.coerce.number().positive(),price:z.string()}).refine(value=>value.max_kg>=value.min_kg,{message:'Maximum weight must be at least the minimum.'})
const emptyForm={minKg:'',maxKg:'',price:''}

export function SettingsPage(){
  const [tiers,setTiers]=useState<IcePriceTier[]>([])
  const [editingId,setEditingId]=useState<string|null>(null)
  const [form,setForm]=useState(emptyForm)
  const [saving,setSaving]=useState(false)
  const [deletingId,setDeletingId]=useState<string|null>(null)
  const [message,setMessage]=useState<{error?:string;success?:string}>({})
  const load=useCallback(async()=>{try{setTiers(await listIceTiers())}catch{setMessage({error:'Unable to load ICE price tiers.'})}},[])
  useEffect(()=>{void load()},[load])

  function edit(tier:IcePriceTier){setEditingId(tier.id);setForm({minKg:String(tier.min_kg),maxKg:String(tier.max_kg),price:(tier.price_per_kg_centavos/100).toFixed(2)});setMessage({})}
  function reset(){setEditingId(null);setForm(emptyForm)}

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault()
    const parsed=tierSchema.safeParse({min_kg:form.minKg,max_kg:form.maxKg,price:form.price})
    if(!parsed.success){setMessage({error:parsed.error.issues[0].message});return}
    setSaving(true)
    try{
      const input={min_kg:parsed.data.min_kg,max_kg:parsed.data.max_kg,price_per_kg_centavos:pesosToCentavos(parsed.data.price)}
      if(editingId)await updateIceTier(editingId,input);else await saveIceTier(input)
      setMessage({success:editingId?'ICE tier updated.':'ICE tier created.'})
      reset()
      await load()
    }catch{setMessage({error:'Unable to save tier. Active ranges cannot overlap.'})}
    finally{setSaving(false)}
  }

  async function remove(tier:IcePriceTier){
    if(!confirm(`Delete the ${tier.min_kg}–${tier.max_kg} kg price tier permanently?`))return
    setDeletingId(tier.id)
    try{await deleteIceTier(tier.id);if(editingId===tier.id)reset();setMessage({success:'ICE tier deleted.'});await load()}
    catch{setMessage({error:'Unable to delete this ICE tier.'})}
    finally{setDeletingId(null)}
  }

  return <div className="p-4 pt-16 lg:p-8"><h1 className="text-2xl font-bold">Settings</h1><p className="mb-6 text-sm text-stone-500">Manage weight-based ICE pricing.</p>{message.error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{message.error}</p>}{message.success&&<p className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-700">{message.success}</p>}<section className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-bold">Active ICE price tiers</h2><p className="text-sm text-stone-500">Overlapping ranges are rejected by PostgreSQL.</p><div className="my-4 divide-y">{tiers.map(tier=><div key={tier.id} className="flex items-center justify-between py-3"><span>{tier.min_kg}–{tier.max_kg} kg</span><div className="flex items-center gap-2"><strong className="mr-2">{formatMoney(tier.price_per_kg_centavos)} / kg</strong><button aria-label={`Edit ${tier.min_kg} to ${tier.max_kg} kg tier`} onClick={()=>edit(tier)} className="rounded-lg border p-2 text-brand-600 hover:bg-brand-50"><Pencil size={16}/></button><button aria-label={`Delete ${tier.min_kg} to ${tier.max_kg} kg tier`} onClick={()=>void remove(tier)} disabled={deletingId===tier.id} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16}/></button></div></div>)}</div><form onSubmit={submit} className="grid grid-cols-2 gap-2 border-t pt-4"><div className="col-span-2 flex items-center justify-between"><h3 className="font-semibold">{editingId?'Edit tier':'Add tier'}</h3>{editingId&&<button type="button" onClick={reset} className="flex items-center gap-1 text-sm text-stone-500"><X size={15}/>Cancel edit</button>}</div><input aria-label="Minimum kilograms" value={form.minKg} onChange={event=>setForm(current=>({...current,minKg:event.target.value}))} required type="number" min="0.01" step="0.01" placeholder="Min kg" className="rounded-lg border p-2"/><input aria-label="Maximum kilograms" value={form.maxKg} onChange={event=>setForm(current=>({...current,maxKg:event.target.value}))} required type="number" min="0.01" step="0.01" placeholder="Max kg" className="rounded-lg border p-2"/><input aria-label="Price per kilogram" value={form.price} onChange={event=>setForm(current=>({...current,price:event.target.value}))} required inputMode="decimal" placeholder="PHP / kg" className="rounded-lg border p-2"/><button disabled={saving} className="flex items-center justify-center gap-1 rounded-lg bg-brand-500 p-2 font-semibold text-white disabled:opacity-50">{editingId?<Save size={16}/>:<Plus size={16}/>} {saving?'Saving...':editingId?'Save changes':'Add tier'}</button></form></section></div>
}
