import { useCallback,useEffect,useMemo,useState } from 'react'
import { RefreshCw,Search } from 'lucide-react'
import type { Category,IcePriceTier,OrderItem,OrderWithItems,PaymentMethod,Product } from '../types/database'
import { listCategories,listIceTiers,listProducts } from '../services/products'
import { completeCart } from '../services/orders'
import { ProductCard } from '../components/products/ProductCard'
import { OrderPanel } from '../components/cart/OrderPanel'
import { IceModal } from '../components/products/IceModal'
import { calculateIceTotal,findIceTier } from '../utils/icePricing'
import { pesosToCentavos } from '../utils/money'

export function POSPage(){
  const [products,setProducts]=useState<Product[]>([])
  const [categories,setCategories]=useState<Category[]>([])
  const [tiers,setTiers]=useState<IcePriceTier[]>([])
  const [items,setItems]=useState<OrderItem[]>([])
  const [checkoutKey,setCheckoutKey]=useState(()=>crypto.randomUUID())
  const [selectedCategory,setSelectedCategory]=useState('')
  const [query,setQuery]=useState('')
  const [ice,setIce]=useState<Product|null>(null)
  const [loading,setLoading]=useState(true)
  const [processing,setProcessing]=useState(false)
  const [error,setError]=useState('')
  const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>('CASH')
  const [cashReceived,setCashReceived]=useState('')

  const initialize=useCallback(async()=>{setLoading(true);setError('');try{const [loadedProducts,loadedCategories,loadedTiers]=await Promise.all([listProducts(),listCategories(),listIceTiers()]);setProducts(loadedProducts);setCategories(loadedCategories);setSelectedCategory(current=>current||loadedCategories[0]?.id||'');setTiers(loadedTiers)}catch{setError('Unable to load the POS. Check the connection and retry.')}finally{setLoading(false)}},[])
  useEffect(()=>{void initialize()},[initialize])

  const total=useMemo(()=>items.reduce((sum,item)=>sum+item.line_total_centavos,0),[items])
  const order=useMemo<OrderWithItems>(()=>({id:'draft',order_number:'',cashier_id:'',status:'OPEN',subtotal_centavos:total,total_centavos:total,payment_method:paymentMethod,cash_tendered_centavos:null,change_centavos:null,created_at:new Date().toISOString(),completed_at:null,cancelled_at:null,order_items:items}),[items,total,paymentMethod])
  const filtered=useMemo(()=>products.filter(product=>(!selectedCategory||product.category_id===selectedCategory)&&product.name.toLowerCase().includes(query.toLowerCase())),[products,selectedCategory,query])

  function add(product:Product){
    if(!product.is_available||(product.track_stock&&product.stock_quantity===0))return
    if(product.unit_type==='kilogram'){setIce(product);return}
    setItems(current=>{const existing=current.find(item=>item.product_id===product.id&&item.weight_kg===null);if(existing){const next=(existing.quantity??0)+1;if(product.track_stock&&next>(product.stock_quantity??0))return current;return current.map(item=>item.id===existing.id?{...item,quantity:next,line_total_centavos:next*(product.price_centavos??0)}:item)}return [...current,{id:crypto.randomUUID(),order_id:'draft',product_id:product.id,product_name_snapshot:product.name,category_name_snapshot:product.category?.name??'Uncategorized',unit_price_centavos_snapshot:product.price_centavos??0,quantity:1,weight_kg:null,line_total_centavos:product.price_centavos??0,created_at:new Date().toISOString()}]})
  }

  function addIce(product:Product,weight:number){
    const tier=findIceTier(weight,tiers)
    if(!tier)throw new Error('No ICE pricing tier is configured for this weight.')
    setItems(current=>[...current,{id:crypto.randomUUID(),order_id:'draft',product_id:product.id,product_name_snapshot:product.name,category_name_snapshot:product.category?.name??'Ice',unit_price_centavos_snapshot:tier.price_per_kg_centavos,quantity:null,weight_kg:weight,line_total_centavos:calculateIceTotal(weight,tier.price_per_kg_centavos),created_at:new Date().toISOString()}])
  }

  function changeQuantity(id:string,quantity:number){setItems(current=>{const cartItem=current.find(item=>item.id===id);const product=products.find(item=>item.id===cartItem?.product_id);const allowed=product?.track_stock?Math.min(quantity,product.stock_quantity??0):quantity;return allowed<=0?current.filter(item=>item.id!==id):current.map(item=>item.id===id?{...item,quantity:allowed,line_total_centavos:item.unit_price_centavos_snapshot*allowed}:item)})}
  function resetCart(){setItems([]);setCheckoutKey(crypto.randomUUID());setPaymentMethod('CASH');setCashReceived('')}
  function clearCart(){if(items.length&&!confirm('Clear the current cart?'))return;resetCart()}

  async function finish(){
    if(processing||items.length===0)return
    setProcessing(true)
    setError('')
    try{
      const cashTendered=paymentMethod==='CASH'?pesosToCentavos(cashReceived):null
      if(paymentMethod==='CASH'&&(cashTendered===null||cashTendered<total)){setError('Cash received must be equal to or greater than the total.');return}
      await completeCart(checkoutKey,items.map(item=>({product_id:item.product_id!,quantity:item.quantity,weight_kg:item.weight_kg})),paymentMethod,cashTendered)
      resetCart()
    }catch{setError('The order was not completed. Check the payment, prices, and product availability.')}
    finally{setProcessing(false)}
  }

  return <div className="p-4 pt-16 lg:p-6"><header className="mb-5"><h1 className="text-2xl font-bold">Point of Sale</h1><p className="text-sm text-stone-500">Choose products to build the current order.</p></header>{error&&<div role="alert" className="mb-4 flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button onClick={initialize} className="flex items-center gap-1 font-bold"><RefreshCw size={15}/>Retry</button></div>}<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]"><section><div className="mb-4 flex flex-wrap gap-2">{categories.map(category=><button key={category.id} onClick={()=>setSelectedCategory(category.id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedCategory===category.id?'bg-brand-900 text-white':'bg-white'}`}>{category.name}</button>)}</div><label className="mb-4 flex max-w-md items-center gap-2 rounded-xl border bg-white px-3"><Search size={18} className="text-stone-400"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search products" className="w-full py-3 outline-none"/></label>{loading?<p className="py-16 text-center text-stone-500">Loading products...</p>:<div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-4">{filtered.map(product=><ProductCard key={product.id} product={product} onClick={()=>add(product)}/>)}</div>}</section><OrderPanel order={order} processing={processing} onChange={changeQuantity} onRemove={id=>setItems(current=>current.filter(item=>item.id!==id))} onComplete={()=>void finish()} onCancel={clearCart} paymentMethod={paymentMethod} onPaymentMethodChange={method=>{setPaymentMethod(method);setCashReceived('')}} cashReceived={cashReceived} onCashReceivedChange={setCashReceived}/></div>{ice&&<IceModal product={ice} tiers={tiers} onClose={()=>setIce(null)} onAdd={async weight=>{addIce(ice,weight);setIce(null)}}/>}</div>
}
