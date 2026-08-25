import { useCallback,useEffect,useMemo,useState } from 'react'
import { Edit,Plus,Search,Trash2 } from 'lucide-react'
import { Link,useSearchParams } from 'react-router-dom'
import type { Category,Product } from '../types/database'
import { deleteProduct,listCategories,listProducts,productImageUrl,setAvailability } from '../services/products'
import { formatMoney } from '../utils/money'

export function ProductsPage(){
  const [searchParams,setSearchParams]=useSearchParams()
  const [products,setProducts]=useState<Product[]>([])
  const [categories,setCategories]=useState<Category[]>([])
  const [query,setQuery]=useState('')
  const [categoryId,setCategoryId]=useState<string|null>(()=>searchParams.get('category'))
  const [error,setError]=useState('')
  const [deletingId,setDeletingId]=useState<string|null>(null)
  const load=useCallback(async()=>{try{const [loadedProducts,loadedCategories]=await Promise.all([listProducts(true),listCategories(false)]);setProducts(loadedProducts);setCategories(loadedCategories);setCategoryId(current=>current??loadedCategories[0]?.id??null)}catch{setError('Unable to load products.')}},[])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{if(categoryId)sessionStorage.setItem('product-category',categoryId)},[categoryId])
  const filtered=useMemo(()=>products.filter(product=>(!categoryId||product.category_id===categoryId)&&product.name.toLowerCase().includes(query.toLowerCase())),[products,categoryId,query])
  async function remove(product:Product){setDeletingId(product.id);setError('');try{await deleteProduct(product.id);setProducts(current=>current.filter(item=>item.id!==product.id))}catch{setError('Unable to delete this product.')}finally{setDeletingId(null)}}

  return <div className="p-4 pt-16 lg:p-8"><div className="mb-6 flex items-center justify-between"><div><h1 className="text-2xl font-bold">Products</h1><p className="text-sm text-stone-500">Manage menu items, optional stock, and availability.</p></div><Link to={`/products/new${categoryId?`?category=${categoryId}`:''}`} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white"><Plus size={19}/>Add product</Link></div>
    {error&&<p className="mb-4 rounded-xl bg-red-50 p-3 text-red-700" role="alert">{error} <button onClick={load} className="font-bold">Retry</button></p>}
    <div className="mb-5 flex flex-wrap items-center gap-2"><label className="mr-2 flex w-full items-center gap-2 rounded-xl border bg-white px-3 sm:w-72"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search products" className="w-full py-3 outline-none"/></label>{categories.map(category=><button key={category.id} type="button" aria-pressed={categoryId===category.id} onClick={()=>{setCategoryId(category.id);setSearchParams({category:category.id},{replace:true})}} className={`rounded-full px-4 py-2 text-sm font-semibold ${categoryId===category.id?'bg-brand-900 text-white':'border border-stone-200 bg-white text-stone-700 hover:border-brand-500'}`}>{category.name}</button>)}</div>
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[720px] text-left"><thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="p-4">Product</th><th>Price</th><th>Stock</th><th>Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{filtered.map(product=>{const image=productImageUrl(product.image_path);return <tr key={product.id} className={`border-b last:border-0 ${!product.is_active?'opacity-50':''}`}><td className="p-4"><div className="flex items-center gap-3">{image?<img src={image} className="h-12 w-12 rounded-lg object-cover" alt=""/>:<div className="h-12 w-12 rounded-lg bg-stone-100"/>}<div><strong>{product.name}</strong>{!product.is_active&&<p className="text-xs text-red-600">Archived</p>}</div></div></td><td>{product.unit_type==='kilogram'?'Tiered':formatMoney(product.price_centavos??0)}</td><td>{product.track_stock?<strong className={product.stock_quantity===0?'text-red-600':''}>{product.stock_quantity}</strong>:<span className="text-stone-400">Not tracked</span>}</td><td><button disabled={!product.is_active} onClick={async()=>{await setAvailability(product.id,!product.is_available);await load()}} className={`rounded-full px-3 py-1 text-xs font-bold ${product.is_available?'bg-emerald-100 text-emerald-700':'bg-stone-200 text-stone-600'}`}>{product.is_available?'AVAILABLE':'SOLD OUT'}</button></td><td className="p-4"><div className="flex justify-end gap-2"><Link to={`/products/${product.id}/edit`} className="rounded-lg border p-2" aria-label={`Edit ${product.name}`}><Edit size={17}/></Link><button onClick={()=>void remove(product)} disabled={deletingId===product.id} className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-50" aria-label={`Delete ${product.name}`} title="Delete"><Trash2 size={17}/></button></div></td></tr>})}</tbody></table></div>
  </div>
}
