import { saveBusinessLogo } from './branding.functions';
import { optimizeLogo, fileToDataUrl } from './image-resize';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendRecordEmail } from './management.functions';
import { toast } from 'sonner';
import { supabase as typedSupabase } from '@/lib/supabase-client';
import {
  Pharmacy,
  Branch,
  Customer,
  ProductItem,
  InventoryBatch,
  Supplier,
  SaleTransaction,
  PurchaseOrder,
  ExpenseRecord,
  UserProfile,
  SupportTicket,
  AIFeatureState,
  AIRecommendationItem,
  SystemHealthItem,
  ActivityLogItem,
  SalesDataPoint,
  SubscriptionPlan,
  BusinessRegistration,
  SubscriptionPayment,
  RegistrationInput,
  Workspace,
  WsBranch,
  WsStaff,
  WsInvite,
  MyInvitation,
  WsProduct,
  WsProductInput,
  WsBatch,
  WsSale,
  WsExpense
} from '@/lib/pharmacy-types';
import type { WorkspaceRole, StaffRole } from './workspace';
import { formatDateDeterministic } from './utils';
import { effectiveStatus, yearlyPrice } from './billing';
import { matchProductPhotos, type EntryModule, type EntryRow, type EntryReferences } from './entry-model';
import { DeliveryService } from './delivery-service';
import { riderHomeData } from './role-home';

// Rows are mapped defensively below (the source app tolerated several schema
// versions), so this layer reads through an untyped client.
const supabase = typedSupabase as unknown as SupabaseClient;

/** Monthly AI token allowance per plan (mirrors subscription_plans.ai_tokens_monthly; null = unlimited). */
export const PLAN_AI_TOKENS: Record<string, number | null> = { starter: 25000, growth: 100000, professional: 300000, network: 750000, enterprise: null };

export class PharmacyService {
  // ==========================================
  // 1. PLANS & ENTITLEMENTS
  // ==========================================
  static async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw new Error(error.message);

      if (!error && data && data.length > 0) {
        return data.map((d: any) => {
          const planCode = d.plan_code || d.slug || 'starter';
          let featureList: string[] = [];

          if (Array.isArray(d.features)) {
            featureList = d.features;
          } else if (typeof d.features === 'object' && d.features !== null) {
            const fMap: Record<string, string> = {
              pos: 'Core POS & inventory',
              inventory: 'Smart stock control',
              expiry_alerts: 'Expiry & low-stock alerts',
              email_support: 'Email support',
              reports: 'Reports & exports',
              supplier_orders: 'Supplier orders',
              prescription_assistant: 'Prescription (TTT/STT)',
              ai_mapping: 'Bulk medicine import (AI mapping)',
              delivery: 'Delivery management',
              priority_support: 'Priority support',
              advanced_analytics: 'Full AI analytics & forecasting',
              custom_integrations: 'Custom integrations (e.g. HIS/EMR)',
              dedicated_account_manager: 'Dedicated account manager',
              sla: 'SLA & training'
            };
            featureList = Object.keys(d.features)
              .filter((k) => d.features[k])
              .map((k) => fMap[k] || k.replace(/_/g, ' '));

            if (d.max_branches) featureList.unshift(`Up to ${d.max_branches} branch${d.max_branches > 1 ? 'es' : ''}`);
            if (d.max_employees) featureList.splice(1, 0, `Up to ${d.max_employees} employees`);
          }

          return {
            id: d.id,
            slug: planCode,
            name: d.plan_name || d.name || 'Plan',
            price_tzs_monthly: Number(d.monthly_price ?? d.price_tzs_monthly ?? 0),
            price_tzs_annual: d.price_tzs_annual != null ? Number(d.price_tzs_annual) : d.annual_price ? Number(d.annual_price) : 0,
            max_branches: d.max_branches ?? 999,
            max_employees: d.max_employees ?? 999,
            has_ai_insights: Boolean(d.has_ai_insights || d.features?.prescription_assistant || d.features?.advanced_analytics),
            has_prescription_stt_ttt: Boolean(d.has_prescription_stt_ttt || d.features?.prescription_assistant),
            has_advanced_ai_forecasting: Boolean(d.has_advanced_ai_forecasting || d.features?.advanced_analytics),
            has_bulk_import_ocr: Boolean(d.has_bulk_import_ocr || d.features?.ai_mapping),
            has_delivery_management: Boolean(d.has_delivery_management || d.features?.delivery),
            support_tier: d.support_tier || (d.features?.priority_support ? 'Priority Support' : d.features?.dedicated_account_manager ? 'Dedicated Account Manager' : 'Email Support'),
            ai_tokens_monthly: d.ai_tokens_monthly !== undefined ? d.ai_tokens_monthly : null,
            features: featureList
          };
        });
      }
    } catch (e) {
      console.warn('Failed to load plans from Supabase:', e);
      throw e;
    }
    return [];
  }

  // ==========================================
  // 2. PHARMACIES (TENANTS)
  // ==========================================
  static async getPharmacies(): Promise<Pharmacy[]> {
    try {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*, subscription_plans!pharmacies_plan_id_fkey(name, slug), branches(count), pharmacy_memberships(count), sales(total)')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          name: d.name || d.display_name || d.legal_name || 'Pharmacy',
          registration_number: d.registration_number || '',
          tax_number: d.tax_number || '',
          owner_name: d.owner_name || 'Owner',
          owner_email: d.email || '',
          plan: (d.subscription_plans?.name || d.plan_name || 'Standard') as any,
          plan_slug: d.subscription_plans?.slug || d.plan_slug || 'starter',
          registered_at: formatDateDeterministic(d.created_at),
          status: (['active', 'trial'].includes(effectiveStatus(d))) ? 'Active' : (d.status === 'suspended' ? 'Suspended' : 'Pending'),
          sales_total: (d.sales || []).reduce((sum: number, sale: any) => sum + Number(sale.total ?? 0), 0),
          branches_count: d.branches?.[0]?.count ?? 0,
          employees_count: d.pharmacy_memberships?.[0]?.count ?? 0,
          city: d.city || '',
          phone: d.phone || '',
          address: d.address || ''
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch pharmacies:', e);
      throw e;
    }
    return [];
  }

  static async addPharmacy(pharmacy: Partial<Pharmacy>): Promise<{ data: Pharmacy | null; error: string | null }> {
    try {
      const payload: any = {
        name: pharmacy.name,
        email: pharmacy.owner_email,
        phone: pharmacy.phone,
        city: pharmacy.city || 'Dar es Salaam',
        status: 'active'
      };

      const { data, error } = await supabase.from('pharmacies').insert(payload).select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      if(data.email)try{await sendRecordEmail({data:{kind:'pharmacies',id:data.id,invite:false}});}catch(e){toast.error(e instanceof Error?e.message:'Business saved; confirmation email failed.');}

      return {
        data: {
          id: data.id,
          name: data.name,
          owner_name: pharmacy.owner_name || 'Owner',
          owner_email: data.email,
          plan: 'Standard',
          plan_slug: 'starter',
          registered_at: formatDateDeterministic(data.created_at),
          status: 'Active',
          sales_total: 0,
          branches_count: data.branches_count ?? 0,
          employees_count: data.employees_count ?? 0,
          city: data.city,
          phone: data.phone
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Operation failed' };
    }
  }

  static async togglePharmacyStatus(id: string, currentStatus: string): Promise<boolean> {
    try {
      const nextStatus = currentStatus === 'Active' ? 'suspended' : 'active';
      const { error } = await supabase.from('pharmacies').update({ status: nextStatus }).eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  // ==========================================
  // 3. CUSTOMERS
  // ==========================================
  static async getCustomers(): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((c: any) => ({
          id: c.id,
          pharmacy_id: c.pharmacy_id,
          full_name: c.full_name || 'Unnamed Customer',
          phone: c.phone || '—',
          email: c.email || '—',
          address: c.address || '—',
          allergies: c.allergies || 'None recorded',
          chronic_conditions: c.chronic_conditions || 'None recorded',
          purchases_count: c.purchases_count || 0,
          total_spent: c.total_spent || 0,
          created_at: formatDateDeterministic(c.created_at)
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch customers:', e);
      throw e;
    }
    return [];
  }

  static async addCustomer(customer: Partial<Customer>): Promise<{ data: Customer | null; error: string | null }> {
    try {
      const payload: any = {
        full_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        allergies: customer.allergies,
        chronic_conditions: customer.chronic_conditions
      };
      if (customer.pharmacy_id) {
        payload.pharmacy_id = customer.pharmacy_id;
      }

      const { data, error } = await supabase.from('customers').insert(payload).select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      if(data.email)try{await sendRecordEmail({data:{kind:'customers',id:data.id,invite:false}});}catch(e){toast.error(e instanceof Error?e.message:'Customer saved; confirmation email failed.');}

      return {
        data: {
          id: data.id,
          pharmacy_id: data.pharmacy_id,
          full_name: data.full_name,
          phone: data.phone || '—',
          email: data.email || '—',
          address: data.address || '—',
          allergies: data.allergies || 'None recorded',
          chronic_conditions: data.chronic_conditions || 'None recorded',
          purchases_count: 0,
          total_spent: 0,
          created_at: formatDateDeterministic(data.created_at)
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err.message || 'Operation failed' };
    }
  }

  static async deleteCustomer(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  // ==========================================
  // 4. BRANCHES
  // ==========================================
  static async getBranches(): Promise<Branch[]> {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((b: any) => ({
          id: b.id,
          pharmacy_id: b.pharmacy_id,
          name: b.name,
          code: b.code || 'MAIN',
          address: b.address || '',
          phone: b.phone || '',
          manager_id: b.manager_id,
          is_main: Boolean(b.is_main),
          is_active: Boolean(b.is_active !== false),
          created_at: formatDateDeterministic(b.created_at)
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch branches:', e);
      throw e;
    }
    return [];
  }

  static async addBranch(branch: Partial<Branch>): Promise<{ data: Branch | null; error: string | null }> {
    try {
      const payload: any = {
        pharmacy_id: branch.pharmacy_id,
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
        is_main: branch.is_main || false,
        is_active: true
      };

      const { data, error } = await supabase.from('branches').insert(payload).select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      return {
        data: {
          id: data.id,
          pharmacy_id: data.pharmacy_id,
          name: data.name,
          code: data.code,
          address: data.address,
          phone: data.phone,
          is_main: data.is_main,
          is_active: data.is_active,
          created_at: formatDateDeterministic(data.created_at)
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // ==========================================
  // 5. PRODUCTS & CATALOGUE
  // ==========================================
  static async getProducts(): Promise<ProductItem[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), inventory_batches(quantity, expiry_date), sale_items(quantity, total_price)')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((p: any) => ({
          id: p.id,
          pharmacy_id: p.pharmacy_id,
          name: p.name,
          generic_name: p.generic_name || '',
          category: p.categories?.name || '',
          dosage: p.dosage_form ? `${p.strength || ''} ${p.dosage_form}`.trim() : (p.dosage || ''),
          sku: p.sku || '',
          barcode: p.barcode,
          units_sold: (p.sale_items || []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0),
          total_sales: (p.sale_items || []).reduce((sum: number, item: any) => sum + Number(item.total_price ?? 0), 0),
          stock_quantity: (p.inventory_batches || []).reduce((sum: number, batch: any) => sum + Number(batch.quantity ?? 0), 0),
          min_stock: p.min_stock_level ?? 0,
          cost_price: Number(p.cost_price || 0),
          selling_price: Number(p.selling_price || 0),
          is_prescription_required: Boolean(p.is_prescription_required),
          is_active: Boolean(p.is_active !== false),
          expiry_date: (p.inventory_batches || []).filter((batch: any) => batch.quantity > 0 && batch.expiry_date).map((batch: any) => batch.expiry_date).sort()[0] || ''
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch products:', e);
      throw e;
    }
    return [];
  }

  static async addProduct(product: Partial<ProductItem>): Promise<{ data: ProductItem | null; error: string | null }> {
    try {
      const payload: any = {
        name: product.name,
        generic_name: product.generic_name,
        sku: product.sku || 'SKU-' + Math.floor(Math.random() * 9000 + 1000),
        dosage_form: product.dosage || 'Tablets',
        strength: product.dosage || '',
        cost_price: product.cost_price || 0,
        selling_price: product.selling_price ?? 0,
        min_stock_level: product.min_stock ?? 0,
        is_prescription_required: Boolean(product.is_prescription_required),
        is_active: true
      };
      if (product.pharmacy_id) {
        payload.pharmacy_id = product.pharmacy_id;
      }

      const { data, error } = await supabase.from('products').insert(payload).select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      return {
        data: {
          id: data.id,
          pharmacy_id: data.pharmacy_id,
          name: data.name,
          generic_name: data.generic_name,
          category: 'General',
          dosage: data.dosage_form,
          sku: data.sku,
          units_sold: 0,
          total_sales: 0,
          stock_quantity: 0,
          min_stock: data.min_stock_level,
          cost_price: data.cost_price,
          selling_price: data.selling_price,
          is_active: data.is_active,
          expiry_date: data.expiry_date || ''
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // ==========================================
  // 6. INVENTORY BATCHES
  // ==========================================
  static async getInventoryBatches(): Promise<InventoryBatch[]> {
    try {
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('*, products(name)')
        .order('expiry_date', { ascending: true });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((b: any) => {
          const exp = new Date(b.expiry_date);
          const now = new Date();
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
          return {
            id: b.id,
            pharmacy_id: b.pharmacy_id,
            branch_id: b.branch_id,
            product_id: b.product_id,
            product_name: b.products?.name || b.product_name || 'Medicine Formulation',
            batch_number: b.batch_number,
            quantity: b.quantity || 0,
            cost_per_unit: Number(b.cost_per_unit || 0),
            expiry_date: b.expiry_date,
            received_date: b.received_date,
            days_to_expiry: diffDays
          };
        });
      }
    } catch (e) {
      console.warn('Failed to fetch batches:', e);
      throw e;
    }
    return [];
  }

  // ==========================================
  // 7. ORDERS & SALES (POS)
  // ==========================================
  static async getSoldProducts(): Promise<SoldProductRow[]> {
    const { data, error } = await supabase
      .from('sale_items')
      .select('id, quantity, unit_price, total_price, products(name), sales!inner(invoice_number, payment_method, created_at, pharmacies(name), branches(name))')
      .order('created_at', { ascending: false, referencedTable: 'sales' })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data || []).map((i: any) => ({
      id: i.id,
      product: i.products?.name || 'Unknown product',
      quantity: Number(i.quantity || 0),
      unit_price: Number(i.unit_price || 0),
      total: Number(i.total_price || 0),
      business: i.sales?.pharmacies?.name || '—',
      branch: i.sales?.branches?.name || '',
      invoice: i.sales?.invoice_number || '',
      payment_method: i.sales?.payment_method || 'cash',
      created_at: i.sales?.created_at || '',
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  static async getSales(): Promise<SaleTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((s: any) => ({
          id: s.id,
          pharmacy_id: s.pharmacy_id,
          branch_id: s.branch_id,
          customer_id: s.customer_id,
          invoice_number: s.invoice_number || `INV-${s.id.slice(0, 6).toUpperCase()}`,
          subtotal: Number(s.subtotal || 0),
          discount: Number(s.discount || 0),
          tax: Number(s.tax || 0),
          total: Number(s.total || s.total_amount || 0),
          payment_status: s.payment_status || 'completed',
          payment_method: s.payment_method || 'cash',
          created_at: formatDateDeterministic(s.created_at)
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch sales:', e);
      throw e;
    }
    return [];
  }

  // ==========================================
  // 8. PURCHASES & SUPPLIER ORDERS
  // ==========================================
  static async getPurchases(): Promise<PurchaseOrder[]> {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((po: any) => ({
          id: po.id,
          pharmacy_id: po.pharmacy_id,
          supplier_id: po.supplier_id,
          supplier_name: po.supplier_name || 'Pharmaceutical Supplier',
          order_number: po.order_number || `PO-${po.id.slice(0, 6).toUpperCase()}`,
          status: po.status || 'ordered',
          total_amount: Number(po.total_amount || 0),
          order_date: po.order_date || po.created_at,
          expected_delivery_date: po.expected_delivery_date,
          received_date: po.received_date,
          created_at: formatDateDeterministic(po.created_at)
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch purchases:', e);
      throw e;
    }
    return [];
  }

  // ==========================================
  // 9. SUPPLIERS
  // ==========================================
  static async getSuppliers(): Promise<Supplier[]> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((sup: any) => ({
          id: sup.id,
          pharmacy_id: sup.pharmacy_id,
          name: sup.name,
          contact_name: sup.contact_name || '—',
          email: sup.email || '—',
          phone: sup.phone || '—',
          address: sup.address || '—',
          tax_id: sup.tax_id || '—',
          is_active: Boolean(sup.is_active !== false),
          created_at: formatDateDeterministic(sup.created_at)
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch suppliers:', e);
      throw e;
    }
    return [];
  }

  static async addSupplier(supplier: Partial<Supplier>): Promise<{ data: Supplier | null; error: string | null }> {
    try {
      const payload: any = {
        name: supplier.name,
        contact_name: supplier.contact_name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        tax_id: supplier.tax_id,
        is_active: true
      };
      if (supplier.pharmacy_id) {
        payload.pharmacy_id = supplier.pharmacy_id;
      }

      const { data, error } = await supabase.from('suppliers').insert(payload).select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      if(data.email)try{await sendRecordEmail({data:{kind:'suppliers',id:data.id,invite:false}});}catch(e){toast.error(e instanceof Error?e.message:'Supplier saved; confirmation email failed.');}
      return {
        data: {
          id: data.id,
          pharmacy_id: data.pharmacy_id,
          name: data.name,
          contact_name: data.contact_name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          tax_id: data.tax_id,
          is_active: data.is_active,
          created_at: formatDateDeterministic(data.created_at)
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // ==========================================
  // 10. EXPENSES
  // ==========================================
  static async getExpenses(): Promise<ExpenseRecord[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((exp: any) => ({
          id: exp.id,
          pharmacy_id: exp.pharmacy_id,
          category: exp.category || 'General',
          amount: Number(exp.amount || 0),
          description: exp.description || '—',
          expense_date: exp.expense_date || '2026-11-01',
          created_at: formatDateDeterministic(exp.created_at)
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch expenses:', e);
      throw e;
    }
    return [];
  }

  static async addExpense(expense: Partial<ExpenseRecord>): Promise<{ data: ExpenseRecord | null; error: string | null }> {
    try {
      const payload: any = {
        category: expense.category || 'General',
        amount: expense.amount || 0,
        description: expense.description || '',
        expense_date: expense.expense_date || new Date().toISOString().slice(0, 10)
      };
      if (expense.pharmacy_id) {
        payload.pharmacy_id = expense.pharmacy_id;
      }

      const { data, error } = await supabase.from('expenses').insert(payload).select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      return {
        data: {
          id: data.id,
          pharmacy_id: data.pharmacy_id,
          category: data.category,
          amount: data.amount,
          description: data.description,
          expense_date: data.expense_date,
          created_at: formatDateDeterministic(data.created_at)
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // ==========================================
  // 11. USERS & ROLES
  // ==========================================
  static async getUsers(): Promise<UserProfile[]> {
    try {
      const [{ data, error }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role')
      ]);

      if (error) throw new Error(error.message);

      if (!error && data) {
        const rolesByUser = new Map<string, string[]>();
        (roleRows || []).forEach((r: any) => {
          rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) || []), r.role]);
        });
        return data.map((u: any) => {
          const roles = rolesByUser.get(u.id) || [];
          const isAdmin = roles.includes('super_admin');
          return {
            id: u.id,
            email: u.email,
            full_name: u.full_name || 'Platform User',
            phone: u.phone || '—',
            avatar_url: u.avatar_url,
            system_role: (isAdmin ? 'super_admin' : roles[0] || 'pharmacist') as UserProfile['system_role'],
            is_super_admin: isAdmin,
            created_at: formatDateDeterministic(u.created_at)
          };
        });
      }
    } catch (e) {
      console.warn('Failed to fetch users:', e);
      throw e;
    }
    return [];
  }

  static async setUserRole(userId: string, role: UserProfile['system_role']): Promise<void> {
    const { error } = await supabase.rpc('admin_set_user_role', { _user_id: userId, _role: role as any });
    if (error) throw new Error(error.message);
  }

  // ==========================================
  // 12. AI FEATURES
  // ==========================================
  static async getAIFeatures(): Promise<AIFeatureState[]> {
    try {
      const { data, error } = await supabase.from('ai_features').select('*').order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          slug: d.slug,
          name: d.name,
          description: d.description,
          is_enabled: d.is_enabled ?? true,
          category: d.category || 'general'
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch AI features:', e);
      throw e;
    }
    return [];
  }

  static async toggleAIFeature(slug: string, currentVal: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_features')
        .update({ is_enabled: !currentVal, updated_at: new Date().toISOString() })
        .eq('slug', slug);
      return !error;
    } catch {
      return false;
    }
  }

  // ==========================================
  // 13. AI RECOMMENDATIONS
  // ==========================================
  static async getRecommendations(): Promise<AIRecommendationItem[]> {
    try {
      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category || 'inventory',
          severity: r.severity || 'action',
          badge_label: (r.severity || 'action').toUpperCase(),
          badge_color: r.severity || 'action',
          created_at: formatDateDeterministic(r.created_at),
          status: r.status || 'pending'
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch recommendations:', e);
      throw e;
    }
    return [];
  }

  static async resolveRecommendation(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_recommendations')
        .update({ status: 'resolved' })
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  // ==========================================
  // 14. SYSTEM HEALTH
  // ==========================================
  static async getSystemHealth(): Promise<SystemHealthItem[]> {
    try {
      const { data, error } = await supabase
        .from('system_health_checks')
        .select('*');

      if (error) throw new Error(error.message);

      if (!error && data && data.length > 0) {
        return data.map((h: any) => ({
          service: h.service_name || 'Service',
          status: (h.status === 'operational' || h.status === 'Operational') ? 'Operational' : (h.status === 'degraded' ? 'Degraded' : 'Down'),
          latency: h.response_time_ms == null ? 'Unavailable' : `${h.response_time_ms}ms`,
          last_check: h.last_checked_at ? formatDateDeterministic(h.last_checked_at) : 'Unavailable'
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch system health:', e);
      throw e;
    }
    return [];
  }

  // ==========================================
  // 15. AUDIT LOGS
  // ==========================================
  static async getAuditLogs(): Promise<ActivityLogItem[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw new Error(error.message);

      if (!error && data && data.length > 0) {
        return data.map((a: any) => ({
          id: a.id,
          title: `${a.action}: ${a.entity} ${a.entity_id ? '#' + a.entity_id.slice(0, 8) : ''}`,
          time: formatDateDeterministic(a.created_at),
          type: 'system'
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch audit logs:', e);
      throw e;
    }
    return [];
  }

  // ==========================================
  // 16. SUPPORT TICKETS
  // ==========================================
  static async getSupportTickets(): Promise<SupportTicket[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      if (!error && data) {
        return data.map((t: any) => ({
          id: t.id,
          pharmacy_id: t.pharmacy_id,
          ticket_number: t.ticket_number || `TICK-${t.id.slice(0, 6).toUpperCase()}`,
          subject: t.subject,
          description: t.description || '',
          category: t.category || 'technical',
          priority: t.priority || 'medium',
          status: t.status || 'open',
          created_at: formatDateDeterministic(t.created_at)
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch support tickets:', e);
      throw e;
    }
    return [];
  }

  static async createSupportTicket(ticket: Partial<SupportTicket>): Promise<{ data: SupportTicket | null; error: string | null }> {
    try {
      const payload: any = {
        ticket_number: `TICK-${Math.floor(Math.random() * 90000 + 10000)}`,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category || 'technical',
        priority: ticket.priority || 'medium',
        status: 'open'
      };
      if (ticket.pharmacy_id) {
        payload.pharmacy_id = ticket.pharmacy_id;
      }

      const { data, error } = await supabase.from('support_tickets').insert(payload).select().single();
      if (error) {
        return { data: null, error: error.message };
      }
      return {
        data: {
          id: data.id,
          pharmacy_id: data.pharmacy_id,
          ticket_number: data.ticket_number,
          subject: data.subject,
          description: data.description,
          category: data.category,
          priority: data.priority,
          status: data.status,
          created_at: formatDateDeterministic(data.created_at)
        },
        error: null
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  // ==========================================
  // REGISTRATIONS, APPROVALS & YEARLY BILLING
  // ==========================================
  private static readonly registrationSelect =
    '*, subscription_plans!pharmacies_plan_id_fkey(name, slug, price_tzs_monthly, price_tzs_annual), subscription_payments(*)';

  private static mapRegistration(d: any): BusinessRegistration {
    const plan = d.subscription_plans || {};
    const payments: SubscriptionPayment[] = (d.subscription_payments || [])
      .map((p: any) => ({
        id: p.id,
        pharmacy_id: p.pharmacy_id,
        plan_id: p.plan_id ?? null,
        amount_tzs: Number(p.amount_tzs) || 0,
        method: p.method || 'mobile_money',
        reference: p.reference ?? null,
        receipt_path: p.receipt_path ?? null,
        status: p.status,
        review_note: p.review_note ?? null,
        created_at: p.created_at,
        reviewed_at: p.reviewed_at ?? null,
      }))
      .sort((a: SubscriptionPayment, b: SubscriptionPayment) => b.created_at.localeCompare(a.created_at));
    return {
      id: d.id,
      name: d.name,
      business_type: d.business_type === 'supplier' ? 'supplier' : 'pharmacy',
      owner_id: d.owner_id ?? null,
      owner_name: d.owner_name ?? null,
      email: d.email ?? null,
      phone: d.phone ?? null,
      city: d.city ?? null,
      address: d.address ?? null,
      registration_number: d.registration_number ?? null,
      tax_number: d.tax_number ?? null,
      plan_id: d.plan_id ?? null,
      plan_slug: plan.slug || 'starter',
      plan_name: plan.name || 'No plan',
      yearly_price: yearlyPrice({
        slug: plan.slug || '',
        price_tzs_monthly: Number(plan.price_tzs_monthly) || 0,
        price_tzs_annual: Number(plan.price_tzs_annual) || 0,
      }),
      billing_choice: d.billing_choice === 'annual' || d.billing_choice === 'monthly' ? d.billing_choice : 'trial',
      monthly_price: Number(plan.price_tzs_monthly) || 0,
      subscription_starts_at: d.subscription_starts_at ?? null,
      status: d.status,
      effective_status: effectiveStatus(d),
      trial_ends_at: d.trial_ends_at ?? null,
      subscription_ends_at: d.subscription_ends_at ?? null,
      approved_at: d.approved_at ?? null,
      review_note: d.review_note ?? null,
      created_at: d.created_at,
      payments,
    };
  }

  static async getMyBusiness(userId: string): Promise<BusinessRegistration | null> {
    const { data, error } = await supabase
      .from('pharmacies')
      .select(this.registrationSelect)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapRegistration(data) : null;
  }

  static async getRegistrations(): Promise<BusinessRegistration[]> {
    const { data, error } = await supabase
      .from('pharmacies')
      .select(this.registrationSelect)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((d: any) => this.mapRegistration(d));
  }

  static async submitRegistration(input: RegistrationInput): Promise<string> {
    const { data, error } = await supabase.rpc('submit_registration', { _payload: input });
    if (error) throw new Error(error.message);
    return data as string;
  }

  static async submitPayment(args: {
    userId: string;
    pharmacyId: string;
    planSlug: string;
    method: string;
    reference: string;
    file?: File | null;
    periodMonths?: 1 | 12;
  }): Promise<void> {
    let receiptPath = '';
    if (args.file) {
      const safe = args.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
      receiptPath = `${args.userId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from('payment-receipts')
        .upload(receiptPath, args.file, { contentType: args.file.type || 'application/octet-stream' });
      if (upErr) throw new Error(`Receipt upload failed: ${upErr.message}`);
    }
    const { error } = await supabase.rpc('submit_subscription_payment', {
      _pharmacy_id: args.pharmacyId,
      _plan_slug: args.planSlug,
      _method: args.method,
      _reference: args.reference,
      _receipt_path: receiptPath,
      _period_months: args.periodMonths ?? 12,
    } as never);
    if (error?.code === 'PGRST202' && (args.periodMonths ?? 12) === 12) {
      // Database not yet updated for monthly billing: fall back to the yearly-only payment function.
      const { error: legacy } = await supabase.rpc('submit_subscription_payment', {
        _pharmacy_id: args.pharmacyId, _plan_slug: args.planSlug, _method: args.method, _reference: args.reference, _receipt_path: receiptPath,
      });
      if (legacy) throw new Error(legacy.message);
      return;
    }
    if (error?.code === 'PGRST202') throw new Error('Monthly payments are being enabled. Please choose yearly for now or try again later.');
    if (error) throw new Error(error.message);
  }

  static async reviewRegistration(pharmacyId: string, decision: 'approve' | 'reject', note?: string): Promise<void> {
    const { error } = await supabase.rpc('review_registration', {
      _pharmacy_id: pharmacyId,
      _decision: decision,
      _note: note || null,
    });
    if (error) throw new Error(error.message);
  }

  static async reviewPayment(paymentId: string, decision: 'confirm' | 'reject', note?: string): Promise<void> {
    const { error } = await supabase.rpc('review_subscription_payment', {
      _payment_id: paymentId,
      _decision: decision,
      _note: note || null,
    });
    if (error) throw new Error(error.message);
  }

  static async setSubscription(pharmacyId: string, cycle: 'trial' | 'monthly' | 'annual', startsAt: Date, endsAt: Date): Promise<void> {
    const { error } = await supabase.rpc('admin_set_subscription' as never, {
      _pharmacy_id: pharmacyId, _cycle: cycle, _starts_at: startsAt.toISOString(), _ends_at: endsAt.toISOString(),
    } as never);
    if (error) throw new Error(error.message);
  }

  static async changePlan(pharmacyId: string, planId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_change_plan' as never, { _pharmacy_id: pharmacyId, _plan_id: planId } as never);
    if (error) throw new Error(error.message);
  }

  static async getAiTokens(pharmacyId: string): Promise<{ limit: number | null; used: number }> {
    const { data, error } = await supabase.rpc('pharmacy_ai_tokens' as never, { _pharmacy_id: pharmacyId } as never);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { token_limit: number | null; tokens_used: number } | null;
    return { limit: row?.token_limit ?? null, used: Number(row?.tokens_used) || 0 };
  }

  static async extendTrial(pharmacyId: string, days: number): Promise<void> {
    const { error } = await supabase.rpc('extend_trial', { _pharmacy_id: pharmacyId, _days: days });
    if (error) throw new Error(error.message);
  }

  static async getReceiptUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(path, 600);
    if (error || !data) throw new Error(error?.message || 'Receipt not available');
    return data.signedUrl;
  }
}

export class EntryService {
  static async registerBusiness(row: Record<string,string>) {
    const {data,error}=await supabase.rpc('admin_register_business',{_payload:row});fail(error);if(row['email'])try{await sendRecordEmail({data:{kind:'pharmacies',id:String(data),invite:false}});}catch(e){toast.error(e instanceof Error?e.message:'Business saved; confirmation email failed.');}return String(data);
  }
  static async staffDetails(pid:string) {
    const {data,error}=await supabase.from('pharmacy_memberships').select('*').eq('pharmacy_id',pid);fail(error);return data ?? [];
  }
  static async updateStaff(pid:string,id:string,row:EntryRow) {
    const {error}=await supabase.rpc('update_staff_details',{_pharmacy:pid,_membership:id,_row:row});fail(error);
  }
  static async list(pid: string, module: EntryModule): Promise<(EntryRow & { id: string })[]> {
    const tables = { products: 'products', batches: 'inventory_batches', branches: 'branches', categories: 'categories', suppliers: 'suppliers', staff: 'pharmacy_invites', settings: 'pharmacies' };
    const { data, error } = await supabase.from(tables[module]).select('*').eq(module === 'settings' ? 'id' : 'pharmacy_id', pid);
    fail(error);
    const refs = module === 'products' || module === 'batches' || module === 'staff' ? await this.referenceRows(pid) : null;
    return (data ?? []).map((row: Record<string, unknown>) => {
      const mapped = Object.fromEntries(Object.entries(row).map(([k,v]) => [k, v == null ? '' : String(v)])) as EntryRow & { id: string };
      if (module === 'products' && refs) {
        mapped['category_name'] = refs.categories.find(r => r['id'] === row['category_id'])?.['name'] ?? '';
        mapped['supplier_name'] = refs.suppliers.find(r => r['id'] === row['supplier_id'])?.['name'] ?? '';
      }
      if (module === 'batches' && refs) {
        mapped['product_sku'] = refs.products.find(r => r['id'] === row['product_id'])?.['sku'] ?? '';
        mapped['branch_code'] = refs.branches.find(r => r['id'] === row['branch_id'])?.['code'] ?? '';
      }
      if (module === 'staff' && refs) {
        const ids = Array.isArray(row['branch_ids']) && row['branch_ids'].length ? row['branch_ids'] : row['branch_id'] ? [row['branch_id']] : [];
        mapped['branch_codes'] = ids.map(id => refs.branches.find(r => r['id'] === id)?.['code'] ?? '').join(';');
      }
      return mapped;
    });
  }
  private static async referenceRows(pid: string) {
    const [categories,suppliers,branches,products] = await Promise.all(['categories','suppliers','branches','products'].map(async table => {
      const { data,error } = await supabase.from(table).select('*').eq('pharmacy_id',pid); fail(error); return (data ?? []) as EntryRow[];
    }));
    return { categories: categories ?? [], suppliers: suppliers ?? [], branches: branches ?? [], products: products ?? [] };
  }
  static async references(pid: string): Promise<EntryReferences> {
    const r = await this.referenceRows(pid);
    const staff = await WorkspaceService.getStaff(pid);
    return {
      category_name: r.categories.filter(x=>String(x['is_active'])!=='false').map(x=>({value:x['name'] ?? '',label:x['name'] ?? ''})),
      supplier_name: r.suppliers.filter(x=>String(x['is_active'])!=='false').map(x=>({value:x['name'] ?? '',label:x['name'] ?? ''})),
      product_sku: r.products.filter(x=>x['sku']).map(x=>({value:x['sku'] ?? '',label:`${x['name']} (${x['sku']})`})),
      branch_code: r.branches.filter(x=>String(x['is_active'])!=='false' && x['code']).map(x=>({value:x['code'] ?? '',label:`${x['name']} (${x['code']})`})),
      branch_codes: r.branches.filter(x=>x['code']).map(x=>({value:x['code'] ?? '',label:`${x['name']} (${x['code']})`})),
      manager_id: staff.filter(x=>x.role==='manager' && x['is_active']).map(x=>({value:x.user_id,label:x.full_name})),
    };
  }
  private static async uploadProductPhoto(pid: string,file: File): Promise<string> {
    if(file.size>5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP under 5 MB');
    const {squareProductImage}=await import('./image-resize');file=await squareProductImage(file);
    const path=`${pid}/${crypto.randomUUID()}`;
    const {error}=await supabase.storage.from('product-images').upload(path,file,{contentType:file.type});fail(error);
    return path;
  }
  private static async removeProductPhotos(paths: string[]): Promise<void> {
    if(!paths.length)return;
    const {error}=await supabase.storage.from('product-images').remove(paths);fail(error);
  }
  static async save(pid: string,module: EntryModule,row: EntryRow,id?: string,photo?: File): Promise<string> {
    if(module==='products'&&!id&&!photo&&!row['image_url'])throw new Error('A product image is required');
    const payload={...row};
    let uploadedPath:string|undefined;
    if(photo){uploadedPath=await this.uploadProductPhoto(pid,photo);payload['image_url']=uploadedPath;}
    if(module==='products'&&payload['image_url']&&!payload['image_url'].startsWith(`${pid}/`)){
      if(uploadedPath)await this.removeProductPhotos([uploadedPath]);
      throw new Error('Product image must belong to this pharmacy');
    }
    let data: unknown;
    try {
      const result = await supabase.rpc('save_business_entry',{_pharmacy:pid,_module:module,_row:payload,_id:id ?? null}); fail(result.error); data=result.data;
    } catch(error) {
      if(uploadedPath){
        try { await this.removeProductPhotos([uploadedPath]); }
        catch(cleanupError) { throw new Error(`${error instanceof Error?error.message:'Save failed'} Uploaded image cleanup failed: ${cleanupError instanceof Error?cleanupError.message:'unknown error'}`); }
      }
      throw error;
    }
    if(!id&&row['email']&&(module==='staff'||module==='suppliers'))try{await sendRecordEmail({data:{kind:module==='staff'?'pharmacy_invites':'suppliers',id:String(data),invite:module==='staff'}});}catch(e){toast.error(e instanceof Error?e.message:'Record saved; email failed. Use Send email to retry.');}
    return String(data);
  }
  static async photo(pid:string,id:string,file:File) {
    const path=await this.uploadProductPhoto(pid,file);
    try {const {error}=await supabase.from('products').update({image_url:path}).eq('id',id).eq('pharmacy_id',pid);fail(error);}
    catch(error){try{await this.removeProductPhotos([path]);}catch(cleanupError){throw new Error(`${error instanceof Error?error.message:'Photo update failed'} Uploaded image cleanup failed: ${cleanupError instanceof Error?cleanupError.message:'unknown error'}`);}throw error;}
  }
  static async import(pid: string,module: EntryModule,rows: EntryRow[],fileName: string,productPhotos: File[] = []) {
    const bytes = new TextEncoder().encode(JSON.stringify({module,rows}));
    const digest = await crypto.subtle.digest('SHA-256',bytes);
    const fingerprint = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const uploadedPaths:string[]=[];
    const cleanup=async()=>{const paths=uploadedPaths.splice(0);await this.removeProductPhotos(paths);};
    let importedRows=rows;
    try{
      if(module==='products'){
        const photos=matchProductPhotos(rows,productPhotos);
        if(photos.errors.length||photos.missing.length)throw new Error([...photos.errors,...(photos.missing.length?[`Missing product images for: ${photos.missing.join(', ')}`]:[])].join('; '));
        importedRows=[];
        for(let start=0;start<rows.length;start+=8){
          const chunk=rows.slice(start,start+8);
          const results=await Promise.allSettled(chunk.map(async row=>{
            const file=photos.bySku.get(row['sku']?.trim().toLowerCase()??'');
            if(!file)throw new Error(`Missing product image for SKU ${row['sku']||'(empty)'}`);
            return {row,path:await this.uploadProductPhoto(pid,file)};
          }));
          let uploadError:string|undefined;
          for(const result of results){
            if(result.status==='fulfilled'){uploadedPaths.push(result.value.path);importedRows.push({...result.value.row,image_url:result.value.path});}
            else uploadError=result.reason instanceof Error?result.reason.message:'Product photo upload failed';
          }
          if(uploadError)throw new Error(uploadError);
        }
      }
      const {data,error}=await supabase.rpc('import_business_rows',{_pharmacy:pid,_module:module,_rows:importedRows,_fingerprint:fingerprint,_file_name:fileName});fail(error);
      const result=data as {status:string;successful_count:number;failed_count:number;error?:string};
      if(result.status==='completed')uploadedPaths.length=0;else await cleanup();
      if((module==='staff'||module==='suppliers')&&result.status==='completed'){
        const saved=await this.list(pid,module);let failed=0;
        for(const row of rows){const email=row['email']?.trim().toLowerCase();if(!email)continue;const match=saved.find(r=>r['email']?.trim().toLowerCase()===email);if(!match){failed++;continue;}
          try{await sendRecordEmail({data:{kind:module==='staff'?'pharmacy_invites':'suppliers',id:match.id,invite:module==='staff'}});}catch{failed++;}
        }
        if(failed)toast.error(`${failed} imported contacts could not be emailed. Records are saved; use Send email in Staff or Suppliers to retry.`);
      }
      return result;
    }catch(error){
      if(uploadedPaths.length){
        try{await cleanup();}
        catch(cleanupError){throw new Error(`${error instanceof Error?error.message:'Import failed'} Uploaded image cleanup failed: ${cleanupError instanceof Error?cleanupError.message:'unknown error'}`);}
      }
      throw error;
    }
  }
  static async history(pid: string) {
    const {data,error}=await supabase.from('import_history').select('*').eq('pharmacy_id',pid).order('created_at',{ascending:false}); fail(error); return data ?? [];
  }
}

// ==========================================
// PHARMACY WORKSPACE (owner + staff) — every call is scoped to one pharmacy id
// ==========================================
function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export class WorkspaceService {
  static async getPlanFeatures(pharmacyId: string) {
    const { data: business, error } = await supabase.from('pharmacies').select('status,trial_ends_at,subscription_ends_at,subscription_plans!pharmacies_plan_id_fkey(has_ai_insights,has_prescription_stt_ttt,has_advanced_ai_forecasting,has_bulk_import_ocr,has_delivery_management)').eq('id', pharmacyId).single();
    fail(error);
    if (!business) throw new Error('Business not found.');
    return { status: effectiveStatus(business), plan: business.subscription_plans as import('./plan-features').PlanFeatureFlags | null };
  }
  static async listWorkspaces(userId: string, isAdmin: boolean): Promise<Workspace[]> {
    const [{ data: rows, error }, { data: memberships }] = await Promise.all([
      supabase
        .from('pharmacies')
        .select('id, name, business_type, city, owner_id, status, trial_ends_at, subscription_ends_at, created_at, subscription_plans!pharmacies_plan_id_fkey(name, slug, max_branches, max_employees)')
        .order('created_at', { ascending: true }),
      supabase.from('pharmacy_memberships').select('pharmacy_id, role, is_active').eq('user_id', userId),
    ]);
    fail(error);
    const roleByPharmacy = new Map<string, string>();
    for (const m of memberships || []) if (m.is_active !== false) roleByPharmacy.set(m.pharmacy_id, m.role);

    return (rows || [])
      .map((d: any): Workspace | null => {
        let role: WorkspaceRole | null = null;
        if (d.owner_id === userId) role = 'owner';
        else if (roleByPharmacy.has(d.id)) role = roleByPharmacy.get(d.id) as StaffRole;
        else if (isAdmin) role = 'admin';
        if (!role) return null;
        const plan = d.subscription_plans || {};
        return {
          id: d.id,
          name: d.name,
          business_type: d.business_type === 'supplier' ? 'supplier' : 'pharmacy',
          city: d.city ?? null,
          role,
          status: effectiveStatus(d),
          plan_name: plan.name || 'Starter',
          plan_slug: plan.slug || 'starter',
          limits: { max_branches: plan.max_branches ?? 1, max_employees: plan.max_employees ?? 3 },
          trial_ends_at: d.trial_ends_at ?? null,
          subscription_ends_at: d.subscription_ends_at ?? null,
        };
      })
      .filter((w): w is Workspace => w !== null);
  }

  // ---------- branches ----------
  static async getBranches(pharmacyId: string): Promise<WsBranch[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: true });
    fail(error);
    return (data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      code: b.code || '',
      address: b.address || '',
      phone: b.phone || '',
      is_main: Boolean(b.is_main),
      is_active: b.is_active !== false,
      created_at: b.created_at,
    }));
  }

  static async saveBranch(pharmacyId: string, input: { id?: string; name: string; code: string; address: string; phone: string }): Promise<void> {
    const row = { name: input.name, code: input.code || null, address: input.address || null, phone: input.phone || null, updated_at: new Date().toISOString() };
    const { error } = input.id
      ? await supabase.from('branches').update(row).eq('id', input.id)
      : await supabase.from('branches').insert({ ...row, pharmacy_id: pharmacyId, is_active: true });
    fail(error);
  }

  static async setBranchActive(branchId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.from('branches').update({ is_active: isActive }).eq('id', branchId);
    fail(error);
  }

  static async setMainBranch(pharmacyId: string, branchId: string): Promise<void> {
    const { error: e1 } = await supabase.from('branches').update({ is_main: false }).eq('pharmacy_id', pharmacyId).neq('id', branchId);
    fail(e1);
    const { error: e2 } = await supabase.from('branches').update({ is_main: true, is_active: true }).eq('id', branchId);
    fail(e2);
  }

  // ---------- staff ----------
  static async getStaff(pharmacyId: string): Promise<WsStaff[]> {
    const { data, error } = await supabase.rpc('pharmacy_staff', { _pharmacy_id: pharmacyId });
    fail(error);
    return (data || []).map((s: any) => ({
      membership_id: s.membership_id,
      user_id: s.user_id,
      full_name: s.full_name || s.email,
      email: s.email,
      role: s.role,
      branch_id: s.branch_id,
      is_active: s.is_active !== false,
      created_at: s.created_at,
    }));
  }

  static async getInvites(pharmacyId: string): Promise<WsInvite[]> {
    const { data, error } = await supabase
      .from('pharmacy_invites')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    fail(error);
    return (data || []) as WsInvite[];
  }

  static async inviteStaff(pharmacyId: string, input: { email: string; full_name: string; role: StaffRole; branch_id: string | null }): Promise<void> {
    const { error } = await supabase.from('pharmacy_invites').insert({
      pharmacy_id: pharmacyId,
      email: input.email.trim().toLowerCase(),
      full_name: input.full_name || null,
      role: input.role,
      branch_id: input.branch_id,
    });
    if (error?.code === '23505') throw new Error('This person already has a pending invitation.');
    fail(error);
  }

  static async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await supabase.from('pharmacy_invites').update({ status: 'revoked' }).eq('id', inviteId);
    fail(error);
  }

  static async updateMembership(membershipId: string, patch: { role?: StaffRole; branch_id?: string | null; is_active?: boolean }): Promise<void> {
    const { error } = await supabase.from('pharmacy_memberships').update('branch_id' in patch ? {...patch,branch_ids:patch.branch_id?[patch.branch_id]:[]} : patch).eq('id', membershipId);
    fail(error);
  }

  static async myInvitations(): Promise<MyInvitation[]> {
    const { data, error } = await supabase.rpc('my_invitations');
    fail(error);
    return (data || []) as MyInvitation[];
  }

  static async acceptInvitation(inviteId: string): Promise<string> {
    const { data, error } = await supabase.rpc('accept_invitation', { _invite_id: inviteId });
    fail(error);
    return data as string;
  }

  // ---------- products & stock ----------
  static async getProducts(pharmacyId: string): Promise<WsProduct[]> {
    const [{ data: rows, error }, { data: batches, error: bErr }] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('pharmacy_id', pharmacyId).order('name', { ascending: true }),
      supabase.from('inventory_batches').select('product_id, branch_id, quantity, expiry_date').eq('pharmacy_id', pharmacyId).gt('quantity', 0),
    ]);
    fail(error);
    fail(bErr);

    const paths = (rows || []).map((p: any) => p.image_url).filter(Boolean) as string[];
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from('product-images').createSignedUrls(paths, 3600);
      for (const u of urls || []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    return (rows || []).map((p: any) => {
      const own = (batches || []).filter((b: any) => b.product_id === p.id);
      const byBranch: Record<string, number> = {};
      for (const b of own) byBranch[b.branch_id || 'none'] = (byBranch[b.branch_id || 'none'] || 0) + (b.quantity || 0);
      const expiries = own.map((b: any) => b.expiry_date as string).sort();
      return {
        id: p.id,
        name: p.name,
        generic_name: p.generic_name || '',
        category: p.categories?.name || 'Uncategorised',
        sku: p.sku || '',
        barcode: p.barcode || '',
        dosage_form: p.dosage_form || '',
        strength: p.strength || '',
        cost_price: Number(p.cost_price || 0),
        selling_price: Number(p.selling_price || 0),
        min_stock_level: p.min_stock_level ?? 10,
        is_prescription_required: Boolean(p.is_prescription_required),
        is_active: p.is_active !== false,
        image_path: p.image_url || null,
        image_src: p.image_url ? signed.get(p.image_url) ?? null : null,
        stock: own.reduce((a: number, b: any) => a + (b.quantity || 0), 0),
        stock_by_branch: byBranch,
        nearest_expiry: expiries[0] ?? null,
        created_at: p.created_at,
      };
    });
  }

  private static async uploadProductPhoto(pharmacyId: string, original: File): Promise<string> {
    const { squareProductImage } = await import('./image-resize');
    const file = await squareProductImage(original);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const path = `${pharmacyId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    return path;
  }

  static async saveProduct(pharmacyId: string, input: WsProductInput & { id?: string }, photo?: File | null): Promise<void> {
    const row: Record<string, unknown> = {
      name: input.name,
      generic_name: input.generic_name || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      dosage_form: input.dosage_form || null,
      strength: input.strength || null,
      cost_price: input.cost_price || 0,
      selling_price: input.selling_price,
      min_stock_level: input.min_stock_level,
      is_prescription_required: input.is_prescription_required,
      updated_at: new Date().toISOString(),
    };
    if (photo) row['image_url'] = await this.uploadProductPhoto(pharmacyId, photo);
    const { error } = input.id
      ? await supabase.from('products').update(row).eq('id', input.id)
      : await supabase.from('products').insert({ ...row, pharmacy_id: pharmacyId, is_active: true });
    fail(error);
  }

  static async setProductsActive(pharmacyId: string, productIds: string[], isActive: boolean): Promise<void> {
    const ids = [...new Set(productIds)];
    if (!ids.length) return;
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('pharmacy_id', pharmacyId)
      .in('id', ids)
      .select('id');
    fail(error);
    if ((data || []).length !== ids.length) throw new Error('Some selected products could not be updated. Refresh and try again.');
  }

  static async getBatches(pharmacyId: string): Promise<WsBatch[]> {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select('*, products(name)')
      .eq('pharmacy_id', pharmacyId)
      .order('expiry_date', { ascending: true });
    fail(error);
    return (data || []).map((b: any) => ({
      id: b.id,
      product_id: b.product_id,
      product_name: b.products?.name || 'Product',
      branch_id: b.branch_id,
      batch_number: b.batch_number,
      quantity: b.quantity || 0,
      cost_per_unit: Number(b.cost_per_unit || 0),
      expiry_date: b.expiry_date,
      received_date: b.received_date,
      days_to_expiry: daysUntil(b.expiry_date),
      created_at: b.created_at,
    }));
  }

  static async receiveStock(
    pharmacyId: string,
    userId: string,
    input: { product_id: string; branch_id: string; batch_number: string; quantity: number; cost_per_unit: number; expiry_date: string }
  ): Promise<void> {
    const [{data:product,error:pErr},{data:branch,error:bErr}] = await Promise.all([
      supabase.from('products').select('sku').eq('id',input.product_id).eq('pharmacy_id',pharmacyId).single(),
      supabase.from('branches').select('code').eq('id',input.branch_id).eq('pharmacy_id',pharmacyId).single(),
    ]);
    fail(pErr); fail(bErr);
    await EntryService.save(pharmacyId,'batches',{product_sku:product?.sku ?? '',branch_code:branch?.code ?? '',batch_number:input.batch_number,quantity:String(input.quantity),cost_per_unit:String(input.cost_per_unit),expiry_date:input.expiry_date});
  }

  static async adjustBatch(pharmacyId: string, userId: string, batch: WsBatch, newQuantity: number, reason: string): Promise<void> {
    const {error}=await supabase.rpc('correct_batch_stock',{_pharmacy:pharmacyId,_batch:batch.id,_quantity:newQuantity,_reason:reason}); fail(error);
  }

  // ---------- money ----------
  static async getSales(pharmacyId: string): Promise<WsSale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('id, invoice_number, total, branch_id, payment_method, created_at, sale_items(quantity, product_id, total_price, products(cost_price), inventory_batches(cost_per_unit)), cashier_id')
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });
    fail(error);
    return (data || []).map((s: any) => ({
      id: s.id,
      invoice_number: s.invoice_number,
      total: Number(s.total || 0),
      branch_id: s.branch_id,
      payment_method: s.payment_method || 'cash',
      created_at: s.created_at,
      items: (s.sale_items || []).map((i: any) => ({
        quantity: i.quantity || 0,
        unit_cost: Number(i.inventory_batches?.cost_per_unit ?? i.products?.cost_price ?? 0),
        product_id: i.product_id,
        line_total: Number(i.total_price || 0),
      })),
      cashier_id: s.cashier_id ?? null,
    }));
  }

  static async getExpenses(pharmacyId: string): Promise<WsExpense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .order('expense_date', { ascending: false });
    fail(error);
    return (data || []).map((e: any) => ({
      id: e.id,
      category: e.category,
      amount: Number(e.amount || 0),
      description: e.description || '',
      expense_date: e.expense_date || e.created_at?.slice(0, 10),
      created_at: e.created_at,
    }));
  }

  static async addExpense(pharmacyId: string, userId: string, input: { category: string; amount: number; description: string; expense_date: string }): Promise<void> {
    const { error } = await supabase.from('expenses').insert({ ...input, pharmacy_id: pharmacyId, recorded_by: userId });
    fail(error);
  }

  static async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    fail(error);
  }
}

// ---------- wholesale marketplace (pharmacy ⇄ supplier) ----------
export interface CatalogItem {
  product_id: string; supplier_id: string; supplier_name: string; supplier_city: string;
  name: string; generic_name: string; dosage_form: string; strength: string;
  unit_price: number; image_src: string | null; is_prescription_required: boolean; stock: number;
}
export interface WholesaleOrder {
  id: string; order_number: string; buyer_pharmacy_id: string; buyer_name: string; supplier_id: string; supplier_name: string;
  branch_id: string | null; branch_name: string; status: 'quote_requested' | 'quoted' | 'cancelled' | 'payment_submitted' | 'confirmed' | 'preparing' | 'dispatched' | 'in_transit' | 'delivered' | 'completed' | 'rejected';
  total_amount: number; payment_method: string; payment_reference: string | null; receipt_path: string | null;
  supplier_note: string | null; created_at: string; reviewed_at: string | null;
  contact_name: string | null; contact_phone: string | null; delivery_address: string | null; delivery_note: string | null;
  items: { product_name: string; quantity: number; unit_price: number; total_price: number }[];
}

export interface SupplierContact { id: string; name: string; city: string; phone: string; email: string; address: string }
export interface WholesaleMessage { id: string; buyer_pharmacy_id: string; supplier_id: string; sender_id: string; sender_side: 'buyer' | 'supplier'; sender_name: string | null; body: string; created_at: string }

export class WholesaleService {
  static async catalog(): Promise<CatalogItem[]> {
    const { data, error } = await supabase.rpc('supplier_catalog');
    fail(error);
    const rows = (data || []) as any[];
    const paths = rows.map((r) => r.image_url).filter(Boolean) as string[];
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from('product-images').createSignedUrls(paths, 3600);
      for (const u of urls || []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
    return rows.map((r) => ({
      product_id: r.product_id, supplier_id: r.supplier_id, supplier_name: r.supplier_name, supplier_city: r.supplier_city || '',
      name: r.name, generic_name: r.generic_name || '', dosage_form: r.dosage_form || '', strength: r.strength || '',
      unit_price: Number(r.unit_price || 0), image_src: r.image_url ? signed.get(r.image_url) ?? null : null,
      is_prescription_required: Boolean(r.is_prescription_required), stock: Number(r.stock || 0),
    }));
  }

  static async placeOrder(args: {
    userId: string; buyerId: string; supplierId: string; branchId: string;
    items: { product_id: string; quantity: number }[]; method: string; reference: string; file?: File | null;
  }): Promise<string> {
    let receiptPath: string | null = null;
    if (args.file) {
      const safe = args.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
      receiptPath = `${args.userId}/wholesale-${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('payment-receipts')
        .upload(receiptPath, args.file, { contentType: args.file.type || 'application/octet-stream' });
      if (upErr) throw new Error(`Receipt upload failed: ${upErr.message}`);
    }
    const { data, error } = await supabase.rpc('place_wholesale_order', {
      _buyer: args.buyerId, _supplier: args.supplierId, _branch: args.branchId, _items: args.items as any,
      _method: args.method, _reference: args.reference, _receipt_path: receiptPath as any,
    });
    fail(error);
    return data as string;
  }

  static async orders(pharmacyId: string, side: 'buyer' | 'supplier'): Promise<WholesaleOrder[]> {
    const col = side === 'buyer' ? 'buyer_pharmacy_id' : 'supplier_id';
    const { data, error } = await supabase
      .from('wholesale_orders')
      .select('*, wholesale_order_items(id, product_name, quantity, unit_price, total_price)')
      .eq(col, pharmacyId)
      .order('created_at', { ascending: false });
    fail(error);
    const rows = (data || []) as any[];
    const ids = [...new Set(rows.flatMap((r) => [r.buyer_pharmacy_id, r.supplier_id]))];
    const branchIds = [...new Set(rows.map((r) => r.branch_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: ph } = await supabase.from('pharmacies').select('id, name').in('id', ids);
      for (const p of ph || []) names.set(p.id, p.name);
    }
    const branches = new Map<string, string>();
    if (branchIds.length) {
      const { data: br } = await supabase.from('branches').select('id, name').in('id', branchIds);
      for (const b of br || []) branches.set(b.id, b.name);
    }
    return rows.map((r) => ({
      id: r.id, order_number: r.order_number, buyer_pharmacy_id: r.buyer_pharmacy_id,
      buyer_name: names.get(r.buyer_pharmacy_id) || 'Pharmacy', supplier_id: r.supplier_id,
      supplier_name: names.get(r.supplier_id) || 'Supplier', branch_id: r.branch_id,
      branch_name: r.branch_id ? branches.get(r.branch_id) || 'Branch' : '—', status: r.status,
      total_amount: Number(r.total_amount || 0), payment_method: r.payment_method, payment_reference: r.payment_reference,
      receipt_path: r.receipt_path, supplier_note: r.supplier_note, created_at: r.created_at, reviewed_at: r.reviewed_at,
      contact_name: r.contact_name ?? null, contact_phone: r.contact_phone ?? null, delivery_address: r.delivery_address ?? null, delivery_note: r.delivery_note ?? null,
      items: (r.wholesale_order_items || []).map((i: any) => ({ ...i, unit_price: Number(i.unit_price), total_price: Number(i.total_price) })),
    }));
  }

  static async review(orderId: string, decision: 'accept' | 'reject', note: string): Promise<void> {
    const { error } = await supabase.rpc('review_wholesale_order', { _order: orderId, _decision: decision, _note: note });
    fail(error);
  }

  static async uploadReceipt(userId: string, file: File): Promise<string> {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const path = `${userId}/wholesale-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('payment-receipts').upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (error) throw new Error(`Receipt upload failed: ${error.message}`);
    return path;
  }

  static async requestQuote(a: { buyerId: string; supplierId: string; branchId: string; items: { product_id: string; quantity: number }[]; note: string }): Promise<string> {
    const { data, error } = await (supabase.rpc as any)('request_wholesale_quote', { _buyer: a.buyerId, _supplier: a.supplierId, _branch: a.branchId, _items: a.items, _note: a.note });
    fail(error);
    return data as string;
  }

  static async sendQuote(orderId: string, prices: { item_id: string; unit_price: number }[], note: string, decline = false): Promise<void> {
    const { error } = await (supabase.rpc as any)('send_wholesale_quote', { _order: orderId, _prices: prices, _note: note, _decline: decline });
    fail(error);
  }

  static async respondQuote(orderId: string, accept: boolean, pay?: { userId: string; method: string; reference: string; file?: File | null }): Promise<void> {
    const receipt = pay?.file ? await WholesaleService.uploadReceipt(pay.userId, pay.file) : null;
    const { error } = await (supabase.rpc as any)('respond_wholesale_quote', { _order: orderId, _accept: accept, _method: pay?.method ?? 'pending', _reference: pay?.reference ?? '', _receipt_path: receipt });
    fail(error);
  }

  static async advance(orderId: string, status: string, note: string): Promise<void> {
    const { error } = await (supabase.rpc as any)('advance_wholesale_order', { _order: orderId, _status: status, _note: note });
    fail(error);
  }

  static async receive(orderId: string, note: string): Promise<void> {
    const { error } = await (supabase.rpc as any)('receive_wholesale_order', { _order: orderId, _note: note });
    fail(error);
  }

  static async timeline(orderIds: string[]): Promise<{ order_id: string; status: string; note: string | null; created_at: string }[]> {
    if (!orderIds.length) return [];
    const { data, error } = await (supabase.from as any)('wholesale_order_events').select('order_id, status, note, created_at').in('order_id', orderIds).order('created_at');
    fail(error);
    return data || [];
  }

  static async suppliers(): Promise<SupplierContact[]> {
    const { data, error } = await (supabase.rpc as any)('supplier_directory');
    fail(error);
    return ((data || []) as any[]).map((r) => ({ id: r.id, name: r.name, city: r.city || '', phone: r.phone || '', email: r.email || '', address: r.address || '' }));
  }

  static async setDelivery(orderId: string, d: { name: string; phone: string; address: string; note: string }): Promise<void> {
    const { error } = await (supabase.rpc as any)('set_wholesale_order_delivery', { _order: orderId, _contact_name: d.name, _contact_phone: d.phone, _address: d.address, _note: d.note });
    fail(error);
  }

  static async messages(buyerId: string, supplierId: string): Promise<WholesaleMessage[]> {
    const { data, error } = await (supabase.from as any)('wholesale_messages').select('*')
      .eq('buyer_pharmacy_id', buyerId).eq('supplier_id', supplierId).order('created_at', { ascending: true }).limit(300);
    fail(error);
    return (data || []) as WholesaleMessage[];
  }

  static async sendMessage(m: { buyerId: string; supplierId: string; side: 'buyer' | 'supplier'; senderId: string; senderName: string; body: string }): Promise<void> {
    const { error } = await (supabase.from as any)('wholesale_messages').insert({
      buyer_pharmacy_id: m.buyerId, supplier_id: m.supplierId, sender_side: m.side, sender_id: m.senderId, sender_name: m.senderName, body: m.body,
    });
    fail(error);
  }

  static async receiptUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(path, 600);
    if (error || !data) throw new Error(error?.message || 'Receipt not available');
    return data.signedUrl;
  }
}

export class PosService {
  static async createSale(args: { pharmacyId: string; branchId: string; items: { product_id: string; quantity: number }[]; method: string; discount: number; reference: string }): Promise<string> {
    const { data, error } = await supabase.rpc('create_sale', {
      _pharmacy: args.pharmacyId, _branch: args.branchId, _items: args.items as any,
      _method: args.method, _discount: args.discount, _reference: args.reference,
    });
    fail(error);
    return data as string;
  }
}

export interface RxItem { product_id: string; name: string; quantity: number; instructions: string }
export interface Prescription {
  id: string; branch_id: string | null; patient_name: string; patient_phone: string; prescriber: string; notes: string;
  items: RxItem[]; status: 'pending' | 'dispensed' | 'rejected'; review_note: string | null; created_at: string; dispensed_at: string | null;
}

export class PrescriptionService {
  static async list(pharmacyId: string): Promise<Prescription[]> {
    const { data, error } = await supabase.from('prescriptions').select('*').eq('pharmacy_id', pharmacyId).order('created_at', { ascending: false });
    fail(error);
    return (data || []).map((r: any) => ({
      id: r.id, branch_id: r.branch_id, patient_name: r.patient_name, patient_phone: r.patient_phone || '', prescriber: r.prescriber || '',
      notes: r.notes || '', items: Array.isArray(r.items) ? r.items : [], status: r.status, review_note: r.review_note,
      created_at: r.created_at, dispensed_at: r.dispensed_at,
    }));
  }
  static async add(pharmacyId: string, userId: string, input: { branch_id: string; patient_name: string; patient_phone: string; prescriber: string; notes: string; items: RxItem[] }): Promise<void> {
    const { error } = await supabase.from('prescriptions').insert({ pharmacy_id: pharmacyId, created_by: userId, ...input, items: input.items as any });
    fail(error);
  }
  static async review(id: string, decision: 'dispense' | 'reject', method: string, note: string): Promise<void> {
    const { error } = await supabase.rpc('review_prescription', { _id: id, _decision: decision, _method: method, _note: note });
    fail(error);
  }
}

export interface AppNotification { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

export class NotificationService {
  static async list(): Promise<AppNotification[]> {
    const { data, error } = await supabase.from('notifications').select('id, kind, title, body, link, read_at, created_at').order('created_at', { ascending: false }).limit(40);
    fail(error);
    return (data || []) as AppNotification[];
  }
  static async markAllRead(): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    fail(error);
  }
  static async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    fail(error);
  }
}

export class BrandingService {
  static async getLogoUrl(pharmacyId: string): Promise<string | null> {
    const { data } = await supabase.from('pharmacies').select('settings').eq('id', pharmacyId).maybeSingle();
    const path = (data?.settings as any)?.logo_path as string | undefined;
    if (!path) return null;
    const { data: s } = await supabase.storage.from('product-images').createSignedUrl(path, 3600);
    return s?.signedUrl ?? null;
  }
  /** Main logo plus per-branch logos (branch falls back to the main logo). */
  static async getLogoUrls(pharmacyId: string): Promise<{ main: string | null; branches: Record<string, string> }> {
    const { data } = await supabase.from('pharmacies').select('settings').eq('id', pharmacyId).maybeSingle();
    const st = (data?.settings as any) || {};
    const sign = async (p?: string) => (p ? (await supabase.storage.from('product-images').createSignedUrl(p, 3600)).data?.signedUrl ?? null : null);
    const branches: Record<string, string> = {};
    for (const [id, p] of Object.entries((st.branch_logos || {}) as Record<string, string>)) { const u = await sign(p); if (u) branches[id] = u; }
    return { main: await sign(st.logo_path), branches };
  }
  static async uploadLogo(pharmacyId: string, file: File, branchId?: string): Promise<void> {
    const optimized = await optimizeLogo(file);
    await saveBusinessLogo({ data: { pharmacyId, ...(branchId ? { branchId } : {}), data: await fileToDataUrl(optimized) } });
  }
}

/** Figures for the per-role home screens; every query is scoped to one pharmacy (RLS applies). */
export class RoleHomeService {
  static async load(pid: string, userId: string, kind: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const soon = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10);
    const out: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    let rows: { label: string; sub: string; badge: string }[] = [];
    if (kind === 'cashier' || kind === 'pharmacist') {
      const { data, error } = await supabase.from('sales').select('total,payment_method').eq('pharmacy_id', pid).eq('cashier_id', userId).gte('created_at', today.toISOString());
      fail(error);
      out["mySalesCount"] = data?.length ?? 0;
      out["mySalesTotal"] = (data ?? []).reduce((a, s) => a + Number(s.total || 0), 0);
      for (const s of data ?? []) byMethod[s.payment_method || 'cash'] = (byMethod[s.payment_method || 'cash'] ?? 0) + Number(s.total || 0);
    }
    if (kind === 'pharmacist') {
      const [{ count: pending, error: e1 }, { count: done, error: e2 }] = await Promise.all([
        supabase.from('prescriptions').select('id', { count: 'exact', head: true }).eq('pharmacy_id', pid).eq('status', 'pending'),
        supabase.from('prescriptions').select('id', { count: 'exact', head: true }).eq('pharmacy_id', pid).eq('status', 'dispensed').gte('dispensed_at', today.toISOString()),
      ]);
      fail(e1); fail(e2); out["rxPending"] = pending ?? 0; out["rxDispensed"] = done ?? 0;
    }
    if (kind === 'pharmacist' || kind === 'inventory') {
      const [{ data: batches, error: e1 }, { data: products, error: e2 }] = await Promise.all([
        supabase.from('inventory_batches').select('product_id,quantity,expiry_date,batch_number,products(name)').eq('pharmacy_id', pid),
        supabase.from('products').select('id,min_stock_level,is_active').eq('pharmacy_id', pid),
      ]);
      fail(e1); fail(e2);
      const stock: Record<string, number> = {};
      for (const b of batches ?? []) stock[b.product_id] = (stock[b.product_id] ?? 0) + (b.quantity || 0);
      const active = (products ?? []).filter((p) => p.is_active !== false);
      out["outOfStock"] = active.filter((p) => (stock[p.id] ?? 0) <= 0).length;
      out["lowStock"] = active.filter((p) => (stock[p.id] ?? 0) > 0 && (stock[p.id] ?? 0) <= (p.min_stock_level ?? 0)).length;
      const expiring = (batches ?? []).filter((b) => b.quantity > 0 && b.expiry_date <= soon).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
      out["expiring"] = expiring.length;
      rows = expiring.slice(0, 6).map((b) => ({ label: (b.products as { name?: string } | null)?.name ?? 'Product', sub: `Batch ${b.batch_number} · ${b.quantity} units`, badge: b.expiry_date }));
    }
    if (kind === 'inventory') {
      const { count, error } = await supabase.from('wholesale_orders').select('id', { count: 'exact', head: true }).eq('buyer_pharmacy_id', pid).eq('status', 'pending');
      fail(error); out["ordersPending"] = count ?? 0;
    }
    if (kind === 'accountant') {
      const [{ data: s, error: e1 }, { data: x, error: e2 }] = await Promise.all([
        supabase.from('sales').select('total').eq('pharmacy_id', pid).gte('created_at', monthStart.toISOString()),
        supabase.from('expenses').select('amount').eq('pharmacy_id', pid).gte('expense_date', monthStart.toISOString().slice(0, 10)),
      ]);
      fail(e1); fail(e2);
      out["monthSales"] = (s ?? []).reduce((a, r) => a + Number(r.total || 0), 0);
      out["monthSalesCount"] = s?.length ?? 0;
      out["monthExpenses"] = (x ?? []).reduce((a, r) => a + Number(r.amount || 0), 0);
      out["monthNet"] = out["monthSales"] - out["monthExpenses"];
    }
    if (kind === 'rider') {
      const riderData = riderHomeData(await DeliveryService.list(pid), userId);
      Object.assign(out, riderData.stats);
      rows = riderData.rows;
    }
    return { stats: out, byMethod, rows };
  }
}

/** Supplier-portal reads; scoped to the supplier's own pharmacy id (RLS applies). */
export class SupplierPortalService {
  static async batches(pid: string) {
    const { data, error } = await supabase.from('inventory_batches')
      .select('id,batch_number,quantity,expiry_date,cost_per_unit,branch_id,products(name,strength,dosage_form,min_stock_level,selling_price,category_id),branches(name)')
      .eq('pharmacy_id', pid).order('expiry_date');
    fail(error);
    return (data ?? []).map((b: any) => ({
      id: b.id as string, batch: b.batch_number as string, qty: Number(b.quantity || 0), expiry: b.expiry_date as string,
      name: b.products?.name ?? 'Product', detail: [b.products?.strength, b.products?.dosage_form].filter(Boolean).join(' · '),
      min: Number(b.products?.min_stock_level || 0), price: Number(b.products?.selling_price || 0), warehouse: b.branches?.name ?? 'Main',
    }));
  }
  static async conversations(supplierId: string) {
    const { data, error } = await (supabase.from as any)('wholesale_messages').select('buyer_pharmacy_id,body,created_at,sender_side')
      .eq('supplier_id', supplierId).order('created_at', { ascending: false }).limit(500);
    fail(error);
    const map = new Map<string, { buyerId: string; last: string; at: string; fromBuyer: number }>();
    for (const m of (data ?? []) as any[]) {
      const c = map.get(m.buyer_pharmacy_id) ?? { buyerId: m.buyer_pharmacy_id, last: m.body, at: m.created_at, fromBuyer: 0 };
      if (m.sender_side === 'buyer') c.fromBuyer++;
      map.set(m.buyer_pharmacy_id, c);
    }
    const ids = [...map.keys()];
    const names = new Map<string, string>();
    if (ids.length) { const { data: ph } = await supabase.from('pharmacies').select('id,name').in('id', ids); for (const p of ph ?? []) names.set(p.id, p.name); }
    return [...map.values()].map((c) => ({ ...c, name: names.get(c.buyerId) ?? 'Pharmacy' }));
  }
  static async notifications(pid: string) {
    const { data, error } = await supabase.from('notifications').select('id,kind,title,body,link,read_at,created_at')
      .or(`pharmacy_id.eq.${pid},pharmacy_id.is.null`).order('created_at', { ascending: false }).limit(500);
    fail(error);
    return (data ?? []) as AppNotification[];
  }
}

export interface SoldProductRow { id: string; product: string; quantity: number; unit_price: number; total: number; business: string; branch: string; invoice: string; payment_method: string; created_at: string }
