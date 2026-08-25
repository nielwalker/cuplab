import { supabase } from '../lib/supabase'
import { cachedQuery } from '../lib/queryCache'

export interface CategorySale { category:string; revenue_centavos:number; items_sold:number }
export interface ProductSale { category:string; product:string; quantity_sold:number; weight_sold_kg:number; revenue_centavos:number }
export interface DailySales { categories:CategorySale[]; products:ProductSale[]; cash_revenue_centavos:number; gcash_revenue_centavos:number; total_revenue_centavos:number; completed_orders:number }

export async function getDailySales(date:string):Promise<DailySales>{
  return cachedQuery(`sales:${date}`,async()=>{
    const start=new Date(`${date}T00:00:00`)
    const end=new Date(start)
    end.setDate(end.getDate()+1)
    const {data,error}=await supabase.from('orders').select('id,payment_method,total_centavos,order_items(product_name_snapshot,category_name_snapshot,quantity,weight_kg,line_total_centavos)').eq('status','COMPLETED').gte('completed_at',start.toISOString()).lt('completed_at',end.toISOString())
    if(error)throw error
    const grouped=new Map<string,CategorySale>()
    const productGroups=new Map<string,ProductSale>()
    for(const order of data??[])for(const item of order.order_items??[]){
      const category=item.category_name_snapshot||'Uncategorized';const current=grouped.get(category)??{category,revenue_centavos:0,items_sold:0};current.revenue_centavos+=Number(item.line_total_centavos);current.items_sold+=item.quantity??1;grouped.set(category,current)
      const product=item.product_name_snapshot||'Unknown product';const productKey=`${category}\u0000${product}`;const productSale=productGroups.get(productKey)??{category,product,quantity_sold:0,weight_sold_kg:0,revenue_centavos:0};productSale.quantity_sold+=item.quantity??0;productSale.weight_sold_kg+=Number(item.weight_kg??0);productSale.revenue_centavos+=Number(item.line_total_centavos);productGroups.set(productKey,productSale)
    }
    const categories=[...grouped.values()].sort((a,b)=>b.revenue_centavos-a.revenue_centavos)
    const products=[...productGroups.values()].sort((a,b)=>(b.quantity_sold+b.weight_sold_kg)-(a.quantity_sold+a.weight_sold_kg)||b.revenue_centavos-a.revenue_centavos)
    const cash_revenue_centavos=(data??[]).filter(order=>order.payment_method==='CASH').reduce((sum,order)=>sum+Number(order.total_centavos),0)
    const gcash_revenue_centavos=(data??[]).filter(order=>order.payment_method==='GCASH').reduce((sum,order)=>sum+Number(order.total_centavos),0)
    return {categories,products,cash_revenue_centavos,gcash_revenue_centavos,total_revenue_centavos:cash_revenue_centavos+gcash_revenue_centavos,completed_orders:data?.length??0}
  },60_000)
}
