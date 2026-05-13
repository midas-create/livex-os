export type UserRole = 'client' | 'admin'

export interface ClientProfile {
  id: string
  user_id: string
  company_name: string
  nif: string
  stat: string
  rcs: string
  manager_name: string
  phone: string
  email: string
  address: string
  region: string
  gps_lat: number | null
  gps_lng: number | null
  /** Services / départements (sorties stock, liste déroulante) */
  departments?: string[] | null
  /** Jours après la commande pour l'échéance de paiement */
  payment_terms_days?: number
  created_at: string
}

export interface User {
  id: string
  email: string
  company_name: string
  role: UserRole
  /** Populated when joining from orders; at most one row per user */
  client_profiles?: ClientProfile[] | null
}

export interface Category {
  id: string
  name: string
}

export interface Subcategory {
  id: string
  category_id: string
  name: string
  category?: Category
}

export interface ProductVariant {
  id: string
  product_id: string
  color: string
  stock_quantity: number
  /** Quantité réservée par des commandes validées non encore livrées */
  reserved_quantity?: number
  created_at: string
}

export interface Product {
  id: string
  name: string
  category_id: string
  subcategory_id: string
  price: number
  purchase_price: number
  stock_quantity: number
  /** Quantité réservée par des commandes validées non encore livrées */
  reserved_quantity?: number
  brand?: string
  image_url?: string
  category?: Category
  subcategory?: Subcategory
  /** When present, stock is per variant; product.stock_quantity may mirror sum for legacy UI */
  variants?: ProductVariant[]
}

/** available = stock_quantity - reserved_quantity */
export function availableStock(item: { stock_quantity: number; reserved_quantity?: number }): number {
  return Math.max(0, item.stock_quantity - (item.reserved_quantity ?? 0))
}

export type OrderStatus =
  | 'pending'
  | 'validated'
  | 'to_deliver'
  | 'partially_delivered'
  | 'delivered'
  | 'cancelled'

export interface Order {
  id: string
  user_id: string
  status: OrderStatus
  total_amount: number
  delivery_fee: number
  is_paid: boolean
  /** Montant TTC déjà encaissé (mis à jour à chaque paiement) */
  paid_amount?: number
  /** Date limite de paiement (commande + délai client) */
  due_date?: string | null
  /** Numéro BC (généré à la validation admin) — ex : BC-2026-000001 */
  bc_number?: string | null
  /** Numéro FA (généré à la livraison finale) — ex : FA-2026-000001 */
  fa_number?: string | null
  /** Alias rétrocompat pour bc_number (ancienne colonne, reste remplie) */
  invoice_number?: string | null
  created_at: string
  validated_at?: string
  delivery_date?: string
  /** Date de livraison planifiée (J+1 si validation avant midi, J+2 sinon) */
  planned_delivery_date?: string | null
  delivery_address?: string
  expected_delivery_date?: string
  user?: User
  order_items?: OrderItem[]
  payments?: Payment[]
  deliveries?: Delivery[]
  total?: number
  amount_paid?: number
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id?: string | null
  quantity: number
  /** Quantité déjà livrée (cumulée sur toutes les livraisons partielles) */
  delivered_quantity?: number
  unit_price: number
  total_price?: number
  price: number
  product?: Product
  variant?: ProductVariant | null
}

// ─── Livraisons (partielles) ─────────────────────────────────────────────────

export interface Delivery {
  id: string
  order_id: string
  /** Numéro BL — ex : BL-2026-000001 */
  bl_number?: string | null
  status: 'pending' | 'validated'
  delivery_date?: string | null
  notes?: string | null
  created_at: string
  delivery_items?: DeliveryItem[]
}

export interface DeliveryItem {
  id: string
  delivery_id: string
  order_item_id: string
  product_id: string
  variant_id?: string | null
  quantity: number
  created_at: string
  product?: Pick<Product, 'id' | 'name'>
  variant?: Pick<ProductVariant, 'id' | 'color'> | null
}

// ─── Stock client B2B ────────────────────────────────────────────────────────

/** Stock chez le client B2B (par société + produit + variante) */
export interface ClientStock {
  id: string
  company_id: string
  product_id: string
  /** null pour les produits sans variante */
  variant_id?: string | null
  current_stock: number
  min_threshold: number
  created_at: string
  product?: Pick<Product, 'id' | 'name'>
  variant?: Pick<ProductVariant, 'id' | 'color'> | null
}

export type ClientStockMovementType = 'IN' | 'OUT'
export type ClientStockMovementSource = 'DELIVERY' | 'MANUAL'

export interface ClientStockMovement {
  id: string
  company_id: string
  product_id: string
  variant_id?: string | null
  type: ClientStockMovementType
  quantity: number
  source: ClientStockMovementSource
  order_id?: string | null
  /** Livraison ayant généré ce mouvement (pour idempotence) */
  delivery_id?: string | null
  /** Département (sorties MANUAL) */
  department?: string | null
  /** Signataire (sorties MANUAL) */
  signed_by?: string | null
  created_at: string
}

export type MovementType = 'IN' | 'OUT'
export type MovementSource = 'purchase' | 'sale' | 'adjustment' | 'delivery'

export interface StockMovement {
  id: string
  product_id: string
  type: MovementType
  quantity: number
  source: MovementSource
  reference_id?: string
  purchase_id?: string
  notes?: string
  created_at: string
  product?: Product
}

/** Valeurs autorisées côté DB pour `payments.payment_method` (legacy `bank` encore lisible côté affichage) */
export type PaymentMethod = 'cash' | 'transfer' | 'cheque' | 'mobile_money' | 'bank'

export interface Payment {
  id: string
  order_id: string
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  reference?: string | null
  notes?: string
  created_at: string
  order?: Order
}

/** Sorties manuelles (fournisseurs / charges) pour la prévision de trésorerie */
export interface CashflowOutflow {
  id: string
  label: string
  amount: number
  due_date: string
  notes?: string | null
  created_at: string
}

// ─── Purchases (supplier entries) ───────────────────────────────────────────

export type PurchasePaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Purchase {
  id: string
  supplier_name: string
  purchase_date: string
  due_date?: string
  payment_status: PurchasePaymentStatus
  total_amount: number
  notes?: string
  created_at: string
  purchase_items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  variant_id?: string | null
  quantity: number
  unit_price: number
  total_price?: number
  product?: Product
  variant?: ProductVariant | null
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export interface CartItem {
  product: Product
  /** When product has variants, this must be set */
  variant_id?: string | null
  variant?: ProductVariant | null
  quantity: number
}

/** Stable key for cart lines (product + optional variant) */
export function cartItemKey(item: Pick<CartItem, 'product' | 'variant_id'>): string {
  return item.variant_id ? `${item.product.id}::${item.variant_id}` : item.product.id
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  todaySales: number
  monthSales: number
  totalOrders: number
  unpaidOrders: number
  unpaidAmount: number
  pendingOrders: number
  toDeliverOrders: number
  totalClients: number
  lowStockProducts: number
}

export interface SalesByDay {
  date: string
  revenue: number
  orders: number
}

export interface SalesByProduct {
  product_name: string
  quantity: number
  revenue: number
  margin: number
}

export interface SalesByClient {
  company_name: string
  orders: number
  revenue: number
}
