import { supabase } from '../lib/supabase'
import type { Order,OrderWithItems } from '../types/database'
import { cachedQuery,invalidateQuery } from '../lib/queryCache'
export async function getOrder(id:string){const {data,error}=await supabase.from('orders').select('*, order_items(*)').eq('id',id).single();if(error)throw error;return data as OrderWithItems}
export async function completeCart(checkoutKey:string,items:Array<{product_id:string;quantity:number|null;weight_kg:number|null}>,paymentMethod:'CASH'|'GCASH',cashTenderedCentavos:number|null){const {data,error}=await supabase.rpc('complete_cart',{p_checkout_key:checkoutKey,p_items:items,p_payment_method:paymentMethod,p_cash_tendered_centavos:cashTenderedCentavos});if(error)throw error;invalidateQuery('order-history');invalidateQuery('sales');return data as Order}
export async function listOrders(){return cachedQuery('order-history',async()=>{const {data,error}=await supabase.from('orders').select('*').eq('status','COMPLETED').order('created_at',{ascending:false});if(error)throw error;return data as Order[]})}
export async function deleteOrderPermanently(id:string){const {error}=await supabase.rpc('delete_order_permanently',{p_order_id:id});if(error)throw error;invalidateQuery('order-history');invalidateQuery('sales')}
