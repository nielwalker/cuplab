export type OrderStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'GCASH'
export type UnitType = 'piece' | 'kilogram'
export type StaffRole = 'OWNER' | 'STAFF'
export interface Profile { id:string; full_name:string; username:string; phone_number:string|null; role:StaffRole; is_active:boolean; created_at:string; updated_at:string }
export interface AttendanceSession { id:string; staff_id:string; clocked_in_at:string; clocked_out_at:string|null; login_method:'PASSWORD'; profiles?:Pick<Profile,'full_name'> }
export interface Category { id:string; name:string; slug:string; sort_order:number; is_active:boolean }
export interface Product { id:string; category_id:string; name:string; description:string|null; price_centavos:number|null; image_path:string|null; unit_type:UnitType; is_active:boolean; is_available:boolean; track_stock:boolean; stock_quantity:number|null; created_at:string; updated_at:string; category?:Pick<Category,'name'|'slug'> }
export interface IcePriceTier { id:string; min_kg:number; max_kg:number; price_per_kg_centavos:number; is_active:boolean }
export interface Order { id:string; order_number:string; cashier_id:string; status:OrderStatus; subtotal_centavos:number; total_centavos:number; payment_method:PaymentMethod; cash_tendered_centavos:number|null; change_centavos:number|null; created_at:string; completed_at:string|null; cancelled_at:string|null; cashier?:Pick<Profile,'full_name'> }
export interface OrderItem { id:string; order_id:string; product_id:string|null; product_name_snapshot:string; category_name_snapshot:string; unit_price_centavos_snapshot:number; quantity:number|null; weight_kg:number|null; line_total_centavos:number; created_at:string }
export interface OrderWithItems extends Order { order_items:OrderItem[] }
export interface CartItem extends OrderItem { is_available?:boolean }
