import type { OrderStatus,Product } from '../types/database'
export const canAddProduct = (product:Pick<Product,'is_active'|'is_available'>) => product.is_active && product.is_available
export const canCompleteOrder = (status:OrderStatus,itemCount:number) => status==='OPEN' && itemCount>0
export const authGuardDestination = (hasSession:boolean,requestedPath:string) => hasSession?requestedPath:'/login'
