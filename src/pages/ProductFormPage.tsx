import { useEffect,useState } from 'react'
import { ArrowLeft,LoaderCircle } from 'lucide-react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { z } from 'zod'
import type { Category,Product,UnitType } from '../types/database'
import { getProduct,listCategories,saveProduct,uploadProductImage } from '../services/products'
import { pesosToCentavos } from '../utils/money'

const fileSchema=z.instanceof(File).refine(file=>file.size<=5*1024*1024,'Image must be 5 MB or smaller.').refine(file=>['image/jpeg','image/png','image/webp'].includes(file.type),'Use JPEG, PNG, or WEBP.')
const schema=z.object({name:z.string().trim().min(2).max(100),category_id:z.uuid(),description:z.string().trim().max(1000),unit_type:z.enum(['piece','kilogram']),price:z.string()}).superRefine((value,context)=>{if(value.unit_type==='piece'){try{pesosToCentavos(value.price)}catch{context.addIssue({code:'custom',path:['price'],message:'Enter a valid non-negative price.'})}}})

export function ProductFormPage(){
  const {id}=useParams()
  const navigate=useNavigate()
  const [categories,setCategories]=useState<Category[]>([])
  const [existing,setExisting]=useState<Product|null>(null)
  const [categoryId,setCategoryId]=useState('')
  const [loading,setLoading]=useState(Boolean(id))
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const isIce=categories.find(category=>category.id===categoryId)?.slug==='ice'

  useEffect(()=>{Promise.all([listCategories(false),id?getProduct(id):Promise.resolve(null)]).then(([loadedCategories,product])=>{setCategories(loadedCategories);setExisting(product);setCategoryId(product?.category_id??'');setLoading(false)}).catch(()=>setError('Unable to load this form.'))},[id])

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault()
    setError('')
    const form=new FormData(event.currentTarget)
    const unitType:UnitType=isIce?'kilogram':'piece'
    const parsed=schema.safeParse({name:String(form.get('name')??''),category_id:categoryId,description:String(form.get('description')??''),unit_type:unitType,price:String(form.get('price')??'')})
    if(!parsed.success){setError(parsed.error.issues[0].message);return}
    const image=form.get('image')
    if(image instanceof File&&image.size){const valid=fileSchema.safeParse(image);if(!valid.success){setError(valid.error.issues[0].message);return}}
    setSaving(true)
    try{
      const product=await saveProduct({name:parsed.data.name,category_id:parsed.data.category_id,description:parsed.data.description||null,unit_type:unitType,price_centavos:isIce?null:pesosToCentavos(parsed.data.price),is_available:form.get('is_available')==='on'},id)
      // Preserve the current image unless the owner explicitly selected a replacement.
      if(image instanceof File&&image.size){const category=categories.find(item=>item.id===categoryId)!;await uploadProductImage(product.id,category.slug,image,existing?.image_path??null)}
      navigate('/products')
    }catch{setError('Unable to save the product. Check the fields and retry.')}
    finally{setSaving(false)}
  }

  if(loading)return <p className="p-10">Loading product...</p>
  return <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8"><Link to="/products" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold"><ArrowLeft size={17}/>Back to products</Link><form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-sm"><h1 className="mb-6 text-2xl font-bold">{id?'Edit product':'Add product'}</h1>{error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-semibold">Product Name<input name="name" required defaultValue={existing?.name} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal"/></label><label className="text-sm font-semibold">Category<select name="category_id" required value={categoryId} onChange={event=>setCategoryId(event.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="">Select category</option>{categories.map(category=><option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className="text-sm font-semibold">Unit Type<input value={isIce?'Kilogram (ICE tier pricing)':'Piece'} readOnly className="mt-1 w-full rounded-xl border bg-stone-50 px-3 py-2.5 font-normal text-stone-600"/></label>{isIce?<div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-600"><strong>Database tier pricing</strong><p className="mt-1">The price is calculated from the entered weight. A normal product price is not used.</p></div>:<label className="text-sm font-semibold">Price (PHP)<input name="price" required inputMode="decimal" defaultValue={existing?.price_centavos!=null?(existing.price_centavos/100).toFixed(2):''} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal"/></label>}<label className="text-sm font-semibold md:col-span-2">Description<textarea name="description" rows={3} defaultValue={existing?.description??''} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal"/></label><label className="text-sm font-semibold md:col-span-2">Image (JPEG, PNG, WEBP; max 5 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full rounded-xl border p-2 font-normal"/><span className="mt-1 block text-xs font-normal text-stone-500">{id?'Choose a file only if you want to replace the current image.':'Image is optional.'}</span></label><label className="flex items-center gap-2 text-sm font-semibold"><input name="is_available" type="checkbox" defaultChecked={existing?.is_available??true}/>Available for sale</label></div><button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-white disabled:opacity-50">{saving&&<LoaderCircle className="animate-spin" size={18}/>} {saving?'Saving...':'Save product'}</button></form></div>
}
