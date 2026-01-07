import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StockAlertDialog from '../../components/common/StockAlertDialog';
import InvoiceValidationModal from '../../components/common/InvoiceValidationModal';
import Sidebar from '../../components/layout/Sidebar';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Vehicle {
  id: string;
  customer_id: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  color: string;
  chassis: string;
  km: string;
}

interface ServiceOrderItem {
  id?: string;
  item_type: 'product' | 'service';
  product_id?: string;
  service_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  total: number;
  needs_purchase?: boolean;
  supplier?: string;
  supplier_notes?: string;
}

interface ServiceOrder {
  id: string;
  customer_id: string;
  vehicle_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  advance_payment: number;
  notes: string;
  created_at: string;
  customer?: Customer;
  vehicle?: Vehicle;
  items?: ServiceOrderItem[];
  discount?: number;
  final_amount?: number;
  payment_method?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

export default function ServiceOrders() {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{id: string, name: string, price: number, type: 'product' | 'service'}>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    status: 'in_diagnosis',
    payment_status: 'pending',
    total_amount: 0,
    discount: 0,
    advance_payment: 0,
    notes: '',
  });

  const [currentItem, setCurrentItem] = useState<ServiceOrderItem>({
    item_type: 'product',
    description: '',
    quantity: 1,
    unit_price: 0,
    cost_price: 0,
    total: 0,
    needs_purchase: false,
    supplier: '',
    supplier_notes: '',
  });

  const [items, setItems] = useState<ServiceOrderItem[]>([]);

  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    description: '',
    category: 'peca',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    min_stock: '1',
  });
  const [newServiceForm, setNewServiceForm] = useState({
    name: '',
    description: '',
    unit_price: '',
    estimated_time: '',
    category: 'mecanica',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Adicionar estado para emissão de NF-e
  const [isEmittingInvoice, setIsEmittingInvoice] = useState(false);
  const [showInvoiceValidationModal, setShowInvoiceValidationModal] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<string | null>(null);

  const [supplierProductSearch, setSupplierProductSearch] = useState('');
  const [showSupplierProductResults, setShowSupplierProductResults] = useState(false);
  const [supplierProductResults, setSupplierProductResults] = useState<Array<{id: string, name: string, cost_price: number, unit_price: number}>>([]);
  const [isNewSupplierProduct, setIsNewSupplierProduct] = useState(false);

  // Adicionar estados para o popup de estoque
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [stockAlertData, setStockAlertData] = useState<{
    productId: string;
    productName: string;
    currentStock: number;
    requestedQuantity: number;
  } | null>(null);

  // Adicionar estados para confirmação de pagamento
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [paymentData, setPaymentData] = useState({
    discount: 0,
    payment_method: 'Dinheiro',
    final_amount: 0,
    amount_paid: 0,
  });

  // Adicionar estado para newCustomerForm
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
  });

  // Adicionar estado para newVehicleForm
  const [newVehicleForm, setNewVehicleForm] = useState({
    brand: '',
    model: '',
    year: '',
    plate: '',
    color: '',
    chassis: '',
    km: '',
  });

  useEffect(() => {
    loadServiceOrders();
    loadCustomers();
    loadProducts();
    loadServices();
  }, []);

  useEffect(() => {
    if (formData.customer_id) {
      loadVehicles(formData.customer_id);
    }
  }, [formData.customer_id]);

  const loadServiceOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordersWithItems = await Promise.all(
        (data || []).map(async (order) => {
          const { data: itemsData } = await supabase
            .from('service_order_items')
            .select('*')
            .eq('service_order_id', order.id);

          return {
            ...order,
            items: itemsData || [],
          };
        })
      );

      setServiceOrders(ordersWithItems);
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadVehicles = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', customerId);

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Erro ao carregar veículos:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit_price, cost_price, stock_quantity')
        .eq('active', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, unit_price')
        .eq('active', true);

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    }
  };

  const handleSearchItem = (value: string) => {
    setCurrentItem({ ...currentItem, description: value });
    
    if (value.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Função para normalizar texto removendo acentos
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };

    const normalizedValue = normalizeText(value);

    if (currentItem.item_type === 'product') {
      const productResults = products
        .filter(p => normalizeText(p.name).includes(normalizedValue))
        .map(p => ({ id: p.id, name: p.name, price: p.unit_price, cost_price: p.cost_price, stock_quantity: p.stock_quantity, type: 'product' as const }));
      setSearchResults(productResults);
    } else {
      const serviceResults = services
        .filter(s => normalizeText(s.name).includes(normalizedValue))
        .map(s => ({ id: s.id, name: s.name, price: s.unit_price, type: 'service' as const }));
      setSearchResults(serviceResults);
    }
    
    setShowSearchResults(true);
  };

  const selectItem = (item: any) => {
    let costPrice = 0;
    if (item.type === 'product') {
      costPrice = item.cost_price || 0;
    }

    setCurrentItem({
      ...currentItem,
      item_type: item.type,
      product_id: item.type === 'product' ? item.id : undefined,
      service_id: item.type === 'service' ? item.id : undefined,
      description: item.name,
      quantity: 1,
      unit_price: item.price,
      cost_price: costPrice,
      total: item.price,
      needs_purchase: false,
      supplier: '',
      supplier_notes: '',
    });
    setShowSearchResults(false);
  };

  const handleSearchSupplierProduct = (value: string) => {
    setSupplierProductSearch(value);
    setCurrentItem({ ...currentItem, description: value });
    
    if (value.length < 2) {
      setSupplierProductResults([]);
      setShowSupplierProductResults(false);
      setIsNewSupplierProduct(false);
      return;
    }

    // Função para normalizar texto removendo acentos
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };

    const normalizedValue = normalizeText(value);

    const productResults = products
      .filter(p => normalizeText(p.name).includes(normalizedValue))
      .map(p => ({ 
        id: p.id, 
        name: p.name, 
        cost_price: p.cost_price || 0, 
        unit_price: p.unit_price 
      }));
    
    setSupplierProductResults(productResults);
    setShowSupplierProductResults(true);
    
    // Se não encontrou nenhum produto, é um produto novo
    setIsNewSupplierProduct(productResults.length === 0);
  };

  const selectSupplierProduct = (product: any) => {
    setCurrentItem({
      ...currentItem,
      product_id: product.id,
      description: product.name,
      cost_price: product.cost_price,
      unit_price: product.unit_price,
    });
    setSupplierProductSearch(product.name);
    setShowSupplierProductResults(false);
    setIsNewSupplierProduct(false);
  };

  const addItem = async () => {
    if (!currentItem.description || currentItem.unit_price <= 0) {
      showToast('Preencha a descrição e o valor de venda', 'error');
      return;
    }

    // Validar se é produto e precisa de compra
    if (currentItem.item_type === 'product' && currentItem.needs_purchase) {
      if (!currentItem.supplier || currentItem.supplier.trim() === '') {
        showToast('Informe o fornecedor para produtos que precisam ser comprados', 'warning');
        return;
      }
      if (!currentItem.cost_price || currentItem.cost_price <= 0) {
        showToast('Informe o custo do produto', 'warning');
        return;
      }

      // Se é um produto novo, criar no banco
      if (isNewSupplierProduct) {
        try {
          const { data: newProduct, error } = await supabase
            .from('products')
            .insert([{
              name: currentItem.description,
              description: `Produto cadastrado via OS - Fornecedor: ${currentItem.supplier}`,
              category: 'peca',
              unit_price: currentItem.unit_price,
              cost_price: currentItem.cost_price,
              stock_quantity: 0,
              min_stock: 1,
              active: true,
            }])
            .select()
            .single();

          if (error) throw error;

          // Atualizar o item com o ID do produto criado
          currentItem.product_id = newProduct.id;
          
          // Recarregar produtos
          await loadProducts();
          
          showToast('Produto cadastrado com sucesso!', 'success');
        } catch (error) {
          console.error('Erro ao cadastrar produto:', error);
          showToast('Erro ao cadastrar produto', 'error');
          return;
        }
      } else if (currentItem.product_id) {
        // Se é um produto existente, atualizar custo e preço
        try {
          await supabase
            .from('products')
            .update({
              cost_price: currentItem.cost_price,
              unit_price: currentItem.unit_price,
            })
            .eq('id', currentItem.product_id);

          // Recarregar produtos
          await loadProducts();
          
          showToast('Custo e preço do produto atualizados!', 'info');
        } catch (error) {
          console.error('Erro ao atualizar produto:', error);
        }
      }
    }

    // Verificar estoque se for produto e não precisar comprar
    if (currentItem.item_type === 'product' && !currentItem.needs_purchase && currentItem.product_id) {
      const product = products.find(p => p.id === currentItem.product_id);
      if (product && product.stock_quantity < currentItem.quantity) {
        // Mostrar popup para adicionar estoque
        setStockAlertData({
          productId: product.id,
          productName: product.name,
          currentStock: product.stock_quantity,
          requestedQuantity: currentItem.quantity,
        });
        setShowStockAlert(true);
        return;
      }
    }

    const newItem = {
      ...currentItem,
      total: currentItem.quantity * currentItem.unit_price,
    };

    setItems([...items, newItem]);
    
    // Resetar campos
    setCurrentItem({
      item_type: 'product',
      description: '',
      quantity: 1,
      unit_price: 0,
      cost_price: 0,
      total: 0,
      needs_purchase: false,
      supplier: '',
      supplier_notes: '',
    });
    setSupplierProductSearch('');
    setIsNewSupplierProduct(false);
  };

  const handleAddStock = async (quantityToAdd: number) => {
    if (!stockAlertData) return;

    try {
      // Atualizar estoque do produto
      const newStock = stockAlertData.currentStock + quantityToAdd;
      
      const { error } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', stockAlertData.productId);

      if (error) throw error;

      // Registrar movimentação de estoque
      await supabase
        .from('stock_movements')
        .insert([{
          product_id: stockAlertData.productId,
          type: 'in',
          quantity: quantityToAdd,
          reason: 'Entrada manual durante venda',
        }]);

      // Recarregar produtos
      await loadProducts();

      showToast(`${quantityToAdd} unidades adicionadas ao estoque!`, 'success');
      
      // Fechar popup
      setShowStockAlert(false);
      setStockAlertData(null);

      // Adicionar o item automaticamente após adicionar estoque
      const newItem = {
        ...currentItem,
        total: currentItem.quantity * currentItem.unit_price,
      };

      setItems([...items, newItem]);
      
      // Resetar campos
      setCurrentItem({
        item_type: 'product',
        description: '',
        quantity: 1,
        unit_price: 0,
        cost_price: 0,
        total: 0,
        needs_purchase: false,
        supplier: '',
        supplier_notes: '',
      });
      setSupplierProductSearch('');
      setIsNewSupplierProduct(false);
    } catch (error) {
      console.error('Erro ao adicionar estoque:', error);
      showToast('Erro ao adicionar estoque', 'error');
    }
  };

  const handleCancelStockAlert = () => {
    setShowStockAlert(false);
    setStockAlertData(null);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id || !formData.vehicle_id || items.length === 0) {
      showToast('Preencha todos os campos obrigatórios e adicione pelo menos um item', 'error');
      return;
    }

    try {
      const totalAmount = calculateTotal();
      
      // Validar pagamento antecipado
      if (formData.advance_payment > totalAmount) {
        showToast('O pagamento antecipado não pode ser maior que o valor total', 'error');
        return;
      }

      // Determinar status de pagamento automaticamente
      let paymentStatus = 'pending';
      if (formData.advance_payment > 0 && formData.advance_payment < totalAmount) {
        paymentStatus = 'partial';
      } else if (formData.advance_payment >= totalAmount) {
        paymentStatus = 'paid';
      }
      
      const orderData = {
        customer_id: formData.customer_id,
        vehicle_id: formData.vehicle_id,
        status: formData.status,
        payment_status: paymentStatus,
        total_amount: totalAmount,
        advance_payment: formData.advance_payment || 0,
        notes: formData.notes,
      };

      let orderId: string;

      if (editingOrder) {
        const { error } = await supabase
          .from('service_orders')
          .update(orderData)
          .eq('id', editingOrder.id);

        if (error) throw error;

        await supabase
          .from('service_order_items')
          .delete()
          .eq('service_order_id', editingOrder.id);

        orderId = editingOrder.id;
      } else {
        const { data, error } = await supabase
          .from('service_orders')
          .insert([orderData])
          .select()
          .single();

        if (error) throw error;
        orderId = data.id;
      }

      const itemsToInsert = items.map(item => ({
        service_order_id: orderId,
        item_type: item.item_type,
        product_id: item.product_id || null,
        service_id: item.service_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price || 0,
        total_price: item.total || (item.quantity * item.unit_price),
        needs_purchase: item.needs_purchase || false,
        supplier: item.supplier || null,
        supplier_notes: item.supplier_notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('service_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Processar estoque e atualizar custos
      for (const item of items) {
        if (item.item_type === 'product' && item.product_id) {
          const product = products.find(p => p.id === item.product_id);
          
          if (product) {
            // Atualizar custo do produto se foi informado
            if (item.cost_price && item.cost_price > 0) {
              await supabase
                .from('products')
                .update({ cost_price: item.cost_price })
                .eq('id', item.product_id);
            }

            // Dar baixa no estoque apenas se não precisar comprar
            if (!item.needs_purchase && product.stock_quantity >= item.quantity) {
              const newStock = product.stock_quantity - item.quantity;
              
              await supabase
                .from('products')
                .update({ stock_quantity: newStock })
                .eq('id', item.product_id);

              // Registrar movimentação de estoque
              await supabase
                .from('stock_movements')
                .insert([{
                  product_id: item.product_id,
                  type: 'out',
                  quantity: item.quantity,
                  reason: `Ordem de Serviço #${orderId.slice(0, 8)}`,
                  reference_id: orderId,
                }]);
            }
          }
        }
      }

      // Registrar sinal no financeiro se houver
      if (formData.advance_payment > 0 && !editingOrder) {
        await supabase.from('revenues').insert([{
          description: `Sinal - Ordem de Serviço #${orderId.slice(0, 8)}`,
          amount: formData.advance_payment,
          category: 'Serviços',
          date: new Date().toISOString().split('T')[0],
          status: 'received',
        }]);
      }

      showToast(editingOrder ? 'Ordem atualizada com sucesso!' : 'Ordem criada com sucesso!', 'success');
      resetForm();
      loadServiceOrders();
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      showToast('Erro ao salvar ordem', 'error');
    }
  };

  // Nova função para confirmar pagamento e entregar
  const handleConfirmPayment = async () => {
    if (!editingOrder) return;

    try {
      // Primeiro, salvar as alterações da OS (itens, etc)
      if (items.length === 0) {
        showToast('Adicione pelo menos um item à ordem', 'error');
        return;
      }

      // Atualizar a OS com os novos dados
      const orderData = {
        customer_id: formData.customer_id,
        vehicle_id: formData.vehicle_id,
        status: 'delivered',
        payment_status: 'paid',
        total_amount: calculateTotal(),
        advance_payment: formData.advance_payment || 0,
        notes: formData.notes,
        discount: paymentData.discount,
        final_amount: calculateTotal() - (formData.advance_payment || 0) - paymentData.discount,
        payment_method: paymentData.payment_method,
      };

      const { error: updateError } = await supabase
        .from('service_orders')
        .update(orderData)
        .eq('id', editingOrder.id);

      if (updateError) throw updateError;

      // Deletar itens antigos e inserir novos
      await supabase
        .from('service_order_items')
        .delete()
        .eq('service_order_id', editingOrder.id);

      const itemsToInsert = items.map(item => ({
        service_order_id: editingOrder.id,
        item_type: item.item_type,
        product_id: item.product_id || null,
        service_id: item.service_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price || 0,
        total_price: item.total || (item.quantity * item.unit_price),
        needs_purchase: item.needs_purchase || false,
        supplier: item.supplier || null,
        supplier_notes: item.supplier_notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('service_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Processar estoque e atualizar custos
      for (const item of items) {
        if (item.item_type === 'product' && item.product_id) {
          const product = products.find(p => p.id === item.product_id);
          
          if (product) {
            // Atualizar custo do produto se foi informado
            if (item.cost_price && item.cost_price > 0) {
              await supabase
                .from('products')
                .update({ cost_price: item.cost_price })
                .eq('id', item.product_id);
            }

            // Dar baixa no estoque apenas se não precisar comprar
            if (!item.needs_purchase && product.stock_quantity >= item.quantity) {
              const newStock = product.stock_quantity - item.quantity;
              
              await supabase
                .from('products')
                .update({ stock_quantity: newStock })
                .eq('id', item.product_id);

              // Registrar movimentação de estoque
              await supabase
                .from('stock_movements')
                .insert([{
                  product_id: item.product_id,
                  type: 'out',
                  quantity: item.quantity,
                  reason: `Ordem de Serviço #${editingOrder.id.slice(0, 8)}`,
                  reference_id: editingOrder.id,
                }]);
            }
          }
        }
      }

      // Registrar pagamento restante no financeiro
      if (calculateTotal() - (formData.advance_payment || 0) - paymentData.discount > 0) {
        await supabase.from('revenues').insert([{
          description: `Pagamento Final - OS #${editingOrder.id.slice(0, 8)}`,
          amount: calculateTotal() - (formData.advance_payment || 0) - paymentData.discount,
          category: 'Serviços',
          date: new Date().toISOString().split('T')[0],
          status: 'received',
          customer_name: editingOrder.customer?.name,
        }]);
      }

      // Criar venda para cada produto vendido na OS
      const customer = customers.find(c => c.id === editingOrder.customer_id);
      const vehicle = vehicles.find(v => v.id === editingOrder.vehicle_id);

      for (const item of items) {
        if (item.item_type === 'product' && item.product_id) {
          const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert([{
              customer_id: editingOrder.customer_id,
              service_order_id: editingOrder.id,
              total_amount: item.total || (item.quantity * item.unit_price),
              discount: 0,
              final_amount: item.total || (item.quantity * item.unit_price),
              payment_method: paymentData.payment_method,
              status: 'completed',
              notes: `OS #${editingOrder.id.slice(0, 8)} - ${vehicle?.model || ''} ${vehicle?.plate || ''}`,
            }])
            .select()
            .single();

          if (saleError) {
            console.error('Erro ao registrar venda:', saleError);
            continue;
          }

          await supabase
            .from('sale_items')
            .insert([{
              sale_id: saleData.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total || (item.quantity * item.unit_price),
            }]);
        }
      }

      showToast('Pagamento confirmado e OS entregue com sucesso!', 'success');
      setShowPaymentConfirmation(false);
      resetForm();
      loadServiceOrders();
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      showToast('Erro ao confirmar pagamento', 'error');
    }
  };

  const handleEdit = (order: ServiceOrder) => {
    setEditingOrder(order);
    setFormData({
      customer_id: order.customer_id,
      vehicle_id: order.vehicle_id,
      status: order.status, // Agora vai carregar o status correto do banco (incluindo 'delivered')
      payment_status: order.payment_status,
      total_amount: order.total_amount,
      discount: order.discount || 0,
      advance_payment: order.advance_payment || 0,
      notes: order.notes || '',
    });
    
    // Normalizar os itens para garantir que tenham a propriedade 'total'
    const normalizedItems = (order.items || []).map(item => ({
      ...item,
      total: item.total || item.total_price || (item.quantity * item.unit_price),
    }));
    
    setItems(normalizedItems);
    setCustomerSearchTerm(order.customer?.name || '');
    
    // Inicializar dados de pagamento
    const totalAmount = normalizedItems.reduce((sum, item) => sum + (item.total || item.total_price || 0), 0);
    const remainingAmount = totalAmount - (order.advance_payment || 0) - (order.discount || 0);
    
    setPaymentData({
      discount: order.discount || 0,
      payment_method: order.payment_method || 'Dinheiro',
      final_amount: order.final_amount || order.total_amount,
      amount_paid: remainingAmount > 0 ? remainingAmount : 0,
    });
    
    // Mostrar seção de pagamento se status for "ready" ou "delivered"
    // Isso permite editar o pagamento mesmo após a entrega
    if (order.status === 'ready' || order.status === 'delivered') {
      setShowPaymentConfirmation(true);
    }
    
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      message: 'Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          // Primeiro, verificar se existem vendas vinculadas a esta OS
          const { data: relatedSales, error: salesCheckError } = await supabase
            .from('sales')
            .select('id')
            .eq('service_order_id', id);

          if (salesCheckError) {
            console.error('Erro ao verificar vendas:', salesCheckError);
            throw salesCheckError;
          }

          // Se existirem vendas, excluir os itens das vendas primeiro
          if (relatedSales && relatedSales.length > 0) {
            for (const sale of relatedSales) {
              // Excluir itens da venda
              const { error: saleItemsError } = await supabase
                .from('sale_items')
                .delete()
                .eq('sale_id', sale.id);

              if (saleItemsError) {
                console.error('Erro ao excluir itens da venda:', saleItemsError);
                throw saleItemsError;
              }

              // Excluir a venda
              const { error: saleError } = await supabase
                .from('sales')
                .delete()
                .eq('id', sale.id);

              if (saleError) {
                console.error('Erro ao excluir venda:', saleError);
                throw saleError;
              }
            }
          }

          // Depois excluir os itens da OS
          const { error: itemsDeleteError } = await supabase
            .from('service_order_items')
            .delete()
            .eq('service_order_id', id);

          if (itemsDeleteError) {
            console.error('Erro ao excluir itens da OS:', itemsDeleteError);
            throw itemsDeleteError;
          }

          // Por fim, deletar a OS
          const { error: orderDeleteError } = await supabase
            .from('service_orders')
            .delete()
            .eq('id', id);

          if (orderDeleteError) {
            console.error('Erro ao excluir OS:', orderDeleteError);
            throw orderDeleteError;
          }

          showToast('Ordem excluída com sucesso!', 'success');
          
          // Recarregar a lista de ordens
          await loadServiceOrders();
        } catch (error) {
          console.error('Erro ao excluir ordem:', error);
          showToast('Erro ao excluir ordem', 'error');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      vehicle_id: '',
      status: 'in_diagnosis',
      payment_status: 'pending',
      total_amount: 0,
      discount: 0,
      advance_payment: 0,
      notes: '',
    });
    setItems([]);
    setEditingOrder(null);
    setShowModal(false);
    setCustomerSearchTerm('');
    setShowCustomerDropdown(false);
    setCurrentItem({
      item_type: 'product',
      description: '',
      quantity: 1,
      unit_price: 0,
      cost_price: 0,
      total: 0,
      needs_purchase: false,
      supplier: '',
      supplier_notes: '',
    });
    setSupplierProductSearch('');
    setIsNewSupplierProduct(false);
    setShowSupplierProductResults(false);
    setShowPaymentConfirmation(false);
    setPaymentData({
      discount: 0,
      payment_method: 'Dinheiro',
      final_amount: 0,
      amount_paid: 0,
    });
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCustomerForm.name || !newCustomerForm.phone) {
      showToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    try {
      // Verificar se já existe um cliente com este telefone
      const { data: existingCustomer, error: checkError } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('phone', newCustomerForm.phone)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingCustomer) {
        // Cliente já existe, perguntar se quer usar este cliente
        const useExisting = confirm(
          `Já existe um cliente cadastrado com este telefone:\n\n` +
          `Nome: ${existingCustomer.name}\n` +
          `Telefone: ${existingCustomer.phone}\n\n` +
          `Deseja usar este cliente existente?`
        );

        if (useExisting) {
          setShowCustomerModal(false);
          await loadCustomers();
          setFormData({ ...formData, customer_id: existingCustomer.id });
          setCustomerSearchTerm(existingCustomer.name);
          showToast('Cliente existente selecionado!', 'success');
          setNewCustomerForm({
            name: '',
            phone: '',
            email: '',
            cpf: '',
            address: '',
            city: '',
            state: '',
            zip_code: '',
            notes: '',
          });
          return;
        } else {
          showToast('Altere o telefone para cadastrar um novo cliente', 'warning');
          return;
        }
      }

      // Se não existe, criar novo cliente
      const { data, error } = await supabase
        .from('customers')
        .insert([newCustomerForm])
        .select()
        .single();

      if (error) throw error;

      showToast('Cliente criado com sucesso!', 'success');
      setNewCustomerForm({
        name: '',
        phone: '',
        email: '',
        cpf: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        notes: '',
      });
      setShowCustomerModal(false);
      await loadCustomers();
      setFormData({ ...formData, customer_id: data.id });
      setCustomerSearchTerm(data.name);
    } catch (error: any) {
      console.error('Erro ao criar cliente:', error);
      
      // Tratamento específico para erro de telefone duplicado
      if (error?.code === '23505' && error?.message?.includes('customers_phone_key')) {
        showToast('Este telefone já está cadastrado. Use a busca para encontrar o cliente.', 'error');
      } else if (error?.code === '23505' && error?.message?.includes('customers_cpf_key')) {
        showToast('Este CPF já está cadastrado. Use a busca para encontrar o cliente.', 'error');
      } else if (error?.code === '23505' && error?.message?.includes('customers_email_key')) {
        showToast('Este email já está cadastrado. Use a busca para encontrar o cliente.', 'error');
      } else {
        showToast('Erro ao criar cliente. Verifique os dados e tente novamente.', 'error');
      }
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id || !newVehicleForm.model || !newVehicleForm.plate) {
      showToast('Selecione um cliente e preencha os campos obrigatórios', 'error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .insert([{
          customer_id: formData.customer_id,
          brand: newVehicleForm.brand || null,
          model: newVehicleForm.model,
          year: newVehicleForm.year ? parseInt(newVehicleForm.year) : null,
          plate: newVehicleForm.plate || null,
          color: newVehicleForm.color || null,
          chassis: newVehicleForm.chassis || null,
          km: newVehicleForm.km ? parseInt(newVehicleForm.km) : null,
        }])
        .select()
        .single();

      if (error) throw error;

      showToast('Veículo criado com sucesso!', 'success');
      setNewVehicleForm({
        brand: '',
        model: '',
        year: '',
        plate: '',
        color: '',
        chassis: '',
        km: '',
      });
      setShowVehicleModal(false);
      await loadVehicles(formData.customer_id);
      setFormData({ ...formData, vehicle_id: data.id });
    } catch (error) {
      console.error('Erro ao criar veículo:', error);
      showToast('Erro ao criar veículo', 'error');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProductForm.name || !newProductForm.unit_price) {
      showToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: newProductForm.name,
          description: newProductForm.description,
          category: newProductForm.category,
          unit_price: parseFloat(newProductForm.unit_price),
          cost_price: parseFloat(newProductForm.cost_price) || 0,
          stock_quantity: parseInt(newProductForm.stock_quantity) || 0,
          min_stock: parseInt(newProductForm.min_stock) || 1,
          active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      showToast('Produto cadastrado com sucesso!', 'success');
      setShowNewProductModal(false);
      setNewProductForm({
        name: '',
        description: '',
        category: 'peca',
        unit_price: '',
        cost_price: '',
        stock_quantity: '',
        min_stock: '1',
      });
      
      // Recarregar produtos e selecionar o novo
      await loadProducts();
      setCurrentItem({
        ...currentItem,
        product_id: data.id,
        description: data.name,
        unit_price: data.unit_price,
        cost_price: data.cost_price || 0,
      });
    } catch (error) {
      console.error('Erro ao cadastrar produto:', error);
      showToast('Erro ao cadastrar produto', 'error');
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newServiceForm.name || !newServiceForm.unit_price) {
      showToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{
          name: newServiceForm.name,
          description: newServiceForm.description,
          category: newServiceForm.category,
          unit_price: parseFloat(newServiceForm.unit_price),
          estimated_time: newServiceForm.estimated_time || null,
          active: true,
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro detalhado ao cadastrar serviço:', error);
        throw error;
      }

      showToast('Serviço cadastrado com sucesso!', 'success');
      setShowNewServiceModal(false);
      setNewServiceForm({
        name: '',
        description: '',
        unit_price: '',
        estimated_time: '',
        category: 'mecanica',
      });
      
      // Recarregar serviços e selecionar o novo
      await loadServices();
      setCurrentItem({
        ...currentItem,
        service_id: data.id,
        description: data.name,
        unit_price: data.unit_price,
      });
    } catch (error: any) {
      console.error('Erro ao cadastrar serviço:', error);
      showToast(`Erro ao cadastrar serviço: ${error.message || 'Erro desconhecido'}`, 'error');
    }
  };

  const handlePrint = (orderId: string) => {
    // Normalizar o base path para evitar barras duplas
    const basePath = __BASE_PATH__.replace(/\/$/, ''); // Remove barra final se existir
    const printPath = `/print/service-order/${orderId}`;
    const printUrl = `${window.location.origin}${basePath}${printPath}`;
    window.open(printUrl, '_blank');
  };

  // Adicionar função para emitir NF-e
  const handleEmitInvoice = async (orderId: string) => {
    setConfirmDialog({
      message: 'Tem certeza que deseja emitir a NF-e para esta ordem de serviço? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          setIsEmittingInvoice(true);
          setConfirmDialog(null);

          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('Sessão não encontrada');
          }

          const response = await fetch(
            `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/focus-nfe-emit-nfe-service`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ serviceOrderId: orderId }),
            }
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Erro ao emitir NF-e');
          }

          showToast('NF-e emitida com sucesso!', 'success');
          loadServiceOrders();

          // Abrir PDF da nota em nova aba
          if (result.invoice?.pdf_url) {
            window.open(result.invoice.pdf_url, '_blank');
          }
        } catch (error: any) {
          console.error('Erro ao emitir NF-e:', error);
          showToast(error.message || 'Erro ao emitir NF-e', 'error');
        } finally {
          setIsEmittingInvoice(false);
        }
      }
    });
  };

  const onEmit = async () => {
    if (!selectedOrderForInvoice) return;

    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
      
      // Criar um AbortController com timeout de 2 minutos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/focus-nfe-emit-nfe-service`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session.access_token}`,
            },
            body: JSON.stringify({ serviceOrderId: selectedOrderForInvoice }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Erro ao emitir NF-e');
        }

        showToast('NF-e emitida com sucesso!', 'success');
        loadServiceOrders();

        // Abrir PDF da nota em nova aba
        if (result.invoice?.pdf_url) {
          window.open(result.invoice.pdf_url, '_blank');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('A emissão está demorando mais que o esperado. A nota pode estar sendo processada. Aguarde alguns minutos e verifique se a nota foi emitida antes de tentar novamente.');
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Erro ao emitir NF-e:', error);
      showToast(error.message || 'Erro ao emitir NF-e', 'error');
      throw error;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'in_diagnosis': { label: 'Em Diagnóstico', color: 'bg-blue-100 text-blue-800' },
      'waiting_approval': { label: 'Aguardando Aprovação', color: 'bg-yellow-100 text-yellow-800' },
      'in_service': { label: 'Em Serviço', color: 'bg-purple-100 text-purple-800' },
      'ready': { label: 'Pronto', color: 'bg-green-100 text-green-800' },
      'delivered': { label: 'Entregue', color: 'bg-gray-100 text-gray-800' },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getPaymentBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'pending': { label: 'Pendente', color: 'bg-red-100 text-red-800' },
      'partial': { label: 'Parcial', color: 'bg-orange-100 text-orange-800' },
      'paid': { label: 'Pago', color: 'bg-green-100 text-green-800' },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getDateRange = (filter: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: yesterday.toISOString(),
          end: today.toISOString()
        };
      case 'week':
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          start: weekStart.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start: monthStart.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      case 'custom':
        if (startDate && endDate) {
          return {
            start: new Date(startDate).toISOString(),
            end: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString()
          };
        }
        return null;
      case 'all':
        return null;
      default:
        return null;
    }
  };

  const filteredOrders = serviceOrders.filter(order => {
    const matchesSearch = 
      order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.phone.includes(searchTerm) ||
      order.vehicle?.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vehicle?.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;

    // Filtro de data
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const dateRange = getDateRange(dateFilter);
      if (dateRange) {
        const orderDate = new Date(order.created_at);
        matchesDate = orderDate >= new Date(dateRange.start) && orderDate < new Date(dateRange.end);
      }
    }

    return matchesSearch && matchesStatus && matchesPayment && matchesDate;
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  };

  const filteredCustomers = customers.filter(customer => {
    // Função para normalizar texto removendo acentos
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };

    const normalizedSearchTerm = normalizeText(customerSearchTerm);
    
    return normalizeText(customer.name).includes(normalizedSearchTerm) ||
      customer.phone.includes(customerSearchTerm);
  });

  const handleCustomerSearch = (value: string) => {
    setCustomerSearchTerm(value);
    setShowCustomerDropdown(true);
    if (!value) {
      setFormData({ ...formData, customer_id: '', vehicle_id: '' });
    }
  };

  const selectCustomer = (customer: Customer) => {
    setFormData({ ...formData, customer_id: customer.id, vehicle_id: '' });
    setCustomerSearchTerm(customer.name);
    setShowCustomerDropdown(false);
  };

  const getRemainingAmount = (order: ServiceOrder) => {
    return order.total_amount - (order.advance_payment || 0);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Se o status for "entregue" ou "concluído", criar venda automaticamente
      if (newStatus === 'delivered' || newStatus === 'completed') {
        const order = serviceOrders.find(o => o.id === orderId);
        if (order && order.items && order.items.length > 0) {
          // Verificar se já existe uma venda para esta OS
          const { data: existingSale } = await supabase
            .from('sales')
            .select('id')
            .eq('service_order_id', orderId)
            .maybeSingle();

          if (!existingSale) {
            // Criar venda
            const { data: saleData, error: saleError } = await supabase
              .from('sales')
              .insert({
                customer_id: order.customer_id,
                total_amount: order.total_amount,
                payment_method: 'Dinheiro',
                status: 'completed',
                service_order_id: orderId,
              })
              .select()
              .single();

            if (saleError) throw saleError;

            // Criar itens da venda
            const saleItems = order.items.map(item => ({
              sale_id: saleData.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            }));

            const { error: itemsError } = await supabase
              .from('sale_items')
              .insert(saleItems);

            if (itemsError) throw itemsError;

            // Atualizar estoque
            for (const item of order.items) {
              const { data: product } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .single();

              if (product) {
                await supabase
                  .from('products')
                  .update({ stock_quantity: product.stock_quantity - item.quantity })
                  .eq('id', item.product_id);

                // Registrar movimentação de estoque
                await supabase
                  .from('stock_movements')
                  .insert({
                    product_id: item.product_id,
                    quantity: -item.quantity,
                    type: 'sale',
                    reference_id: saleData.id,
                    notes: `Venda da OS #${orderId.slice(0, 8)}`,
                  });
              }
            }
          } else {
            // Se já existe venda, apenas atualizar o service_order_id
            await supabase
              .from('sales')
              .update({ service_order_id: orderId })
              .eq('id', existingSale.id);
          }
        }
      }

      showToast('Status atualizado com sucesso!', 'success');
      loadServiceOrders();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status', 'error');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Ordens de Serviço</h1>
            <p className="text-gray-600">Gerencie as ordens de serviço do centro automotivo</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            {/* Filtros Rápidos de Data */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'today'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-check-line mr-2"></i>
                  Hoje
                </button>
                <button
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'yesterday'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-line mr-2"></i>
                  Ontem
                </button>
                <button
                  onClick={() => setDateFilter('week')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'week'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-2-line mr-2"></i>
                  Últimos 7 dias
                </button>
                <button
                  onClick={() => setDateFilter('month')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'month'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-event-line mr-2"></i>
                  Este mês
                </button>
                <button
                  onClick={() => setDateFilter('custom')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'custom'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-todo-line mr-2"></i>
                  Período Personalizado
                </button>
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'all'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-infinity-line mr-2"></i>
                  Todas
                </button>
              </div>
            </div>

            {/* Seletor de Período Personalizado */}
            {dateFilter === 'custom' && (
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"></i>
                  <input
                    type="text"
                    placeholder="Buscar por cliente, placa, modelo, telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="all">Todos os Status</option>
                  <option value="in_diagnosis">Em Diagnóstico</option>
                  <option value="waiting_approval">Aguardando Aprovação</option>
                  <option value="in_service">Em Serviço</option>
                  <option value="ready">Pronto</option>
                </select>
              </div>

              <div>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="all">Todos os Pagamentos</option>
                  <option value="pending">Pendente</option>
                  <option value="partial">Parcial</option>
                  <option value="paid">Pago</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line text-xl"></i>
                Nova Ordem de Serviço
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const remainingAmount = getRemainingAmount(order);
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 flex-1">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">ID</span>
                        <span className="font-mono text-sm font-semibold text-gray-900">#{order.id.slice(0, 8)}</span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Data/Hora</span>
                        <span className="text-sm font-medium text-gray-900">{formatDateTime(order.created_at)}</span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Cliente</span>
                        <span className="font-medium text-gray-900">{order.customer?.name}</span>
                        <span className="text-sm text-gray-600">{order.customer?.phone}</span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Veículo</span>
                        <span className="font-medium text-gray-900">{order.vehicle?.model}</span>
                        <span className="text-sm text-gray-600">{order.vehicle?.plate}</span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Status</span>
                        {getStatusBadge(order.status)}
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Pagamento</span>
                        {getPaymentBadge(order.payment_status)}
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Valor Total</span>
                        <span className="text-lg font-bold text-orange-600">
                          R$ {order.total_amount.toFixed(2)}
                        </span>
                        {order.payment_status === 'partial' && (
                          <span className="text-xs text-gray-600">
                            Falta: R$ {remainingAmount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrint(order.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                        title="Imprimir"
                      >
                        <i className="ri-printer-line text-xl"></i>
                      </button>
                      
                      {/* Botão Emitir NF-e - Aparece quando está Entregue e Pago, mas ainda não emitiu */}
                      {order.status === 'delivered' && order.payment_status === 'paid' && !order.invoice_number && (
                        <button
                          onClick={() => {
                            setSelectedOrderForInvoice(order.id);
                            setShowInvoiceValidationModal(true);
                          }}
                          disabled={isEmittingInvoice}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Emitir NF-e"
                        >
                          {isEmittingInvoice ? (
                            <i className="ri-loader-4-line text-xl animate-spin"></i>
                          ) : (
                            <i className="ri-file-text-line text-xl"></i>
                          )}
                        </button>
                      )}
                      
                      {/* Botão Visualizar NF-e - Aparece quando já foi emitida */}
                      {order.invoice_number && (
                        <button
                          onClick={() => window.open(order.invoice_pdf_url, '_blank')}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title={`NF-e ${order.invoice_number} - Clique para visualizar`}
                        >
                          <i className="ri-file-check-line text-xl"></i>
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleEdit(order)}
                        className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line text-xl"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Excluir"
                      >
                        <i className="ri-delete-bin-line text-xl"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <i className="ri-file-list-3-line text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500 text-lg">Nenhuma ordem de serviço encontrada</p>
                {dateFilter !== 'all' && (
                  <p className="text-gray-400 text-sm mt-2">Tente alterar o período selecionado</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingOrder ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente *</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={customerSearchTerm}
                        onChange={(e) => handleCustomerSearch(e.target.value)}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder="Digite para buscar cliente..."
                        required
                      />
                      {showCustomerDropdown && customerSearchTerm && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              onClick={() => selectCustomer(customer)}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                            >
                              <p className="font-medium text-gray-900">{customer.name}</p>
                              <p className="text-sm text-gray-600">{customer.phone}</p>
                            </div>
                          ))}
                          {filteredCustomers.length === 0 && (
                            <div className="px-4 py-3 text-gray-500 text-center">
                              Nenhum cliente encontrado
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(true)}
                      className="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition cursor-pointer whitespace-nowrap"
                      title="Adicionar novo cliente"
                    >
                      <i className="ri-add-line text-xl"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Veículo *</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.vehicle_id}
                      onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                      required
                      disabled={!formData.customer_id}
                    >
                      <option value="">Selecione um veículo</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.model} - {vehicle.plate}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowVehicleModal(true)}
                      className="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition cursor-pointer whitespace-nowrap"
                      title="Adicionar novo veículo"
                      disabled={!formData.customer_id}
                    >
                      <i className="ri-add-line text-xl"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status da Ordem
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      setFormData({ ...formData, status: newStatus });
                      
                      // Mostrar seção de pagamento automaticamente quando mudar para "ready"
                      if (newStatus === 'ready' && editingOrder && editingOrder.payment_status !== 'paid') {
                        setShowPaymentConfirmation(true);
                        // Calcular valor restante
                        const totalAmount = calculateTotal();
                        const remainingAmount = totalAmount - (editingOrder.advance_payment || 0);
                        setPaymentData({
                          ...paymentData,
                          amount_paid: remainingAmount,
                        });
                      } else if (newStatus !== 'ready' && newStatus !== 'delivered') {
                        setShowPaymentConfirmation(false);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                    required
                  >
                    <option value="in_diagnosis">Em Diagnóstico</option>
                    <option value="waiting_approval">Aguardando Aprovação</option>
                    <option value="in_service">Em Serviço</option>
                    <option value="ready">Pronto</option>
                    {/* Adicionar opção "Entregue" apenas se a OS já estiver entregue */}
                    {editingOrder && editingOrder.status === 'delivered' && (
                      <option value="delivered">Entregue</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pagamento Antecipado (Sinal)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.advance_payment || ''}
                      onChange={(e) => setFormData({ ...formData, advance_payment: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="0,00"
                    />
                  </div>
                  {formData.advance_payment > 0 && items.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Restante: R$ {(calculateTotal() - formData.advance_payment).toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                    rows={3}
                    placeholder="Observações sobre a ordem de serviço..."
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Itens da Ordem</h3>

                <div className="grid grid-cols-1 gap-4 mb-4">
                  {/* Seletor de Tipo */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Item *</label>
                    <div className="flex gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          value="product"
                          checked={currentItem.item_type === 'product'}
                          onChange={(e) => {
                            setCurrentItem({ 
                              ...currentItem, 
                              item_type: 'product',
                              description: '',
                              product_id: undefined,
                              service_id: undefined,
                              needs_purchase: false,
                              supplier: '',
                              supplier_notes: '',
                            });
                            setSearchResults([]);
                            setShowSearchResults(false);
                            setSupplierProductSearch('');
                            setIsNewSupplierProduct(false);
                          }}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          <i className="ri-box-3-line text-teal-600 mr-1"></i>
                          Produto
                        </span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          value="service"
                          checked={currentItem.item_type === 'service'}
                          onChange={(e) => {
                            setCurrentItem({ 
                              ...currentItem, 
                              item_type: 'service',
                              description: '',
                              product_id: undefined,
                              service_id: undefined,
                              needs_purchase: false,
                              supplier: '',
                              supplier_notes: '',
                            });
                            setSearchResults([]);
                            setShowSearchResults(false);
                            setSupplierProductSearch('');
                            setIsNewSupplierProduct(false);
                          }}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          <i className="ri-tools-line text-orange-600 mr-1"></i>
                          Serviço
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Seção de Compra de Fornecedor */}
                  {currentItem.item_type === 'product' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentItem.needs_purchase || false}
                              onChange={(e) => {
                                const needsPurchase = e.target.checked;
                                setCurrentItem({ 
                                  ...currentItem, 
                                  needs_purchase: needsPurchase,
                                  supplier: needsPurchase ? currentItem.supplier : '',
                                  supplier_notes: needsPurchase ? currentItem.supplier_notes : '',
                                  description: needsPurchase ? '' : currentItem.description,
                                  product_id: needsPurchase ? undefined : currentItem.product_id,
                                });
                                if (needsPurchase) {
                                  setSupplierProductSearch('');
                                  setIsNewSupplierProduct(false);
                                }
                              }}
                              className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                            />
                            <span className="ml-3 text-sm font-medium text-gray-700">
                              <i className="ri-shopping-cart-line text-orange-600 mr-1"></i>
                              Precisa comprar produto de fornecedor (Não tem no estoque)
                            </span>
                          </label>
                        </div>

                        {currentItem.needs_purchase && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fornecedor *
                              </label>
                              <input
                                type="text"
                                value={currentItem.supplier || ''}
                                onChange={(e) => setCurrentItem({ ...currentItem, supplier: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                placeholder="Nome do fornecedor"
                              />
                            </div>

                            <div className="relative">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Produto * {isNewSupplierProduct && <span className="text-orange-600">(Novo produto será cadastrado)</span>}
                              </label>
                              <input
                                type="text"
                                value={supplierProductSearch}
                                onChange={(e) => handleSearchSupplierProduct(e.target.value)}
                                onFocus={() => supplierProductSearch.length >= 2 && setShowSupplierProductResults(true)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                placeholder="Digite o nome do produto..."
                              />
                              {showSupplierProductResults && supplierProductResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                  {supplierProductResults.map((product) => (
                                    <div
                                      key={product.id}
                                      onClick={() => selectSupplierProduct(product)}
                                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="font-medium text-gray-900">{product.name}</p>
                                          <p className="text-xs text-gray-500 mt-1">
                                            Custo: R$ {product.cost_price.toFixed(2)} | Venda: R$ {product.unit_price.toFixed(2)}
                                          </p>
                                        </div>
                                        <i className="ri-arrow-right-line text-gray-400"></i>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Custo do Produto (R$) *
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={currentItem.cost_price || ''}
                                    onChange={(e) => setCurrentItem({ ...currentItem, cost_price: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                    placeholder="0,00"
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Quanto você vai pagar</p>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Valor de Venda (R$) *
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={currentItem.unit_price || ''}
                                    onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                    placeholder="0,00"
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Quanto vai cobrar do cliente</p>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Observações da Compra
                              </label>
                              <textarea
                                value={currentItem.supplier_notes || ''}
                                onChange={(e) => setCurrentItem({ ...currentItem, supplier_notes: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                                rows={2}
                                placeholder="Ex: Prazo de entrega, condições de pagamento..."
                              />
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={addItem}
                                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer whitespace-nowrap flex items-center gap-2"
                              >
                                <i className="ri-add-line text-xl"></i>
                                Adicionar Item
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Campos normais quando não precisa comprar */}
                  {(!currentItem.needs_purchase || currentItem.item_type === 'service') && (
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-5 relative">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {currentItem.item_type === 'product' ? 'Produto' : 'Serviço'} *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (currentItem.item_type === 'product') {
                                setShowNewProductModal(true);
                              } else {
                                setShowNewServiceModal(true);
                              }
                            }}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-add-circle-line"></i>
                            Cadastrar Novo
                          </button>
                        </div>
                        <input
                          type="text"
                          value={currentItem.description}
                          onChange={(e) => handleSearchItem(e.target.value)}
                          onFocus={() => currentItem.description.length >= 2 && setShowSearchResults(true)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                          placeholder={`Digite para buscar ${currentItem.item_type === 'product' ? 'produtos' : 'serviços'}...`}
                        />
                        {showSearchResults && searchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {searchResults.map((item) => (
                              <div
                                key={`${item.type}-${item.id}`}
                                onClick={() => selectItem(item)}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-gray-900">{item.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-gray-500">
                                        {item.type === 'product' ? (
                                          <>
                                            <i className="ri-box-3-line text-teal-600 mr-1"></i>
                                            Produto
                                          </>
                                        ) : (
                                          <>
                                            <i className="ri-tools-line text-orange-600 mr-1"></i>
                                            Serviço
                                          </>
                                        )}
                                      </p>
                                      {item.type === 'product' && item.stock_quantity !== undefined && (
                                        <p className={`text-xs ${item.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          • Estoque: {item.stock_quantity}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-teal-600 font-semibold">R$ {item.price.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Qtd *</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={currentItem.quantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Permitir campo vazio temporariamente
                            if (value === '') {
                              setCurrentItem({ ...currentItem, quantity: 0 });
                            } else {
                              const numValue = parseInt(value);
                              setCurrentItem({ ...currentItem, quantity: numValue >= 1 ? numValue : 1 });
                            }
                          }}
                          onBlur={(e) => {
                            // Ao sair do campo, garantir que tenha pelo menos 1
                            if (!e.target.value || parseInt(e.target.value) < 1) {
                              setCurrentItem({ ...currentItem, quantity: 1 });
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-center"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Custo Unit.</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentItem.cost_price || ''}
                            onChange={(e) => setCurrentItem({ ...currentItem, cost_price: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Venda Unit. *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentItem.unit_price || ''}
                            onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Total</label>
                        <input
                          type="text"
                          value={`R$ ${(currentItem.quantity * currentItem.unit_price).toFixed(2)}`}
                          className="w-full px-2 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold text-sm text-center"
                          readOnly
                        />
                      </div>

                      <div className="col-span-1 flex items-end">
                        <button
                          type="button"
                          onClick={addItem}
                          className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer whitespace-nowrap"
                          title="Adicionar item"
                        >
                          <i className="ri-add-line text-xl"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Seção de Margem de Lucro para itens normais */}
                  {!currentItem.needs_purchase && currentItem.cost_price > 0 && currentItem.unit_price > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="ri-money-dollar-circle-line text-green-600 text-xl"></i>
                          <span className="text-sm font-medium text-gray-700">Margem de Lucro:</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Lucro Unitário</p>
                            <p className="text-sm font-bold text-green-600">
                              R$ {(currentItem.unit_price - currentItem.cost_price).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Margem</p>
                            <p className="text-lg font-bold text-green-600">
                              {(((currentItem.unit_price - currentItem.cost_price) / currentItem.unit_price) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qtd</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Venda</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-900">{item.description}</p>
                              {item.needs_purchase && (
                                <p className="text-xs text-orange-600 mt-1">
                                  <i className="ri-shopping-cart-line"></i> Fornecedor: {item.supplier}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {item.cost_price ? `R$ ${item.cost_price.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">R$ {(item.unit_price || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">R$ {(item.total || item.total_price || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              {item.needs_purchase ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <i className="ri-shopping-cart-line mr-1"></i>
                                  Comprar
                                </span>
                              ) : item.item_type === 'service' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <i className="ri-tools-line mr-1"></i>
                                  Serviço
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <i className="ri-check-line mr-1"></i>
                                  Estoque
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-800 transition cursor-pointer"
                              >
                                <i className="ri-delete-bin-line text-lg"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total Geral:</td>
                          <td className="px-4 py-3 text-right text-lg font-bold text-teal-600">R$ {calculateTotal().toFixed(2)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Nova seção de confirmação de pagamento */}
              {editingOrder && (formData.status === 'ready' || formData.status === 'delivered') && (
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <i className="ri-money-dollar-circle-line text-green-600 text-2xl"></i>
                    Confirmação de Pagamento
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white rounded-lg p-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Valor Total</p>
                      <p className="text-xl font-bold text-gray-900">R$ {calculateTotal().toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Sinal Pago</p>
                      <p className="text-xl font-bold text-blue-600">R$ {(editingOrder.advance_payment || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Valor Restante</p>
                      <p className="text-xl font-bold text-orange-600">
                        R$ {(calculateTotal() - (editingOrder.advance_payment || 0) - paymentData.discount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Desconto (R$)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={calculateTotal() - (editingOrder.advance_payment || 0)}
                          value={paymentData.discount || ''}
                          onChange={(e) => setPaymentData({ ...paymentData, discount: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento *</label>
                      <select
                        value={paymentData.payment_method}
                        onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none cursor-pointer"
                      >
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                        <option value="PIX">PIX</option>
                        <option value="Transferência">Transferência</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Valor Final</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                        <input
                          type="text"
                          value={(calculateTotal() - (editingOrder.advance_payment || 0) - paymentData.discount).toFixed(2)}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-4 border border-green-300">
                    <div className="flex gap-3">
                      <i className="ri-information-line text-green-600 text-xl flex-shrink-0"></i>
                      <div>
                        <p className="text-sm font-medium text-green-900">Atenção</p>
                        <p className="text-sm text-green-800 mt-1">
                          Ao confirmar o pagamento, a OS será marcada como <strong>Entregue</strong> e <strong>Paga</strong>. O valor será registrado no financeiro e você poderá emitir a NF-e.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition cursor-pointer whitespace-nowrap flex items-center gap-2 text-lg font-semibold"
                    >
                      <i className="ri-check-double-line text-2xl"></i>
                      Confirmar Pagamento e Entregar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition cursor-pointer whitespace-nowrap"
                >
                  {editingOrder ? 'Atualizar Ordem' : 'Criar Ordem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Novo Cliente</h2>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
                  <input
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                  <input
                    type="text"
                    value={newCustomerForm.cpf}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, cpf: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                  <input
                    type="text"
                    value={newCustomerForm.address}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                  <input
                    type="text"
                    value={newCustomerForm.city}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                  <input
                    type="text"
                    value={newCustomerForm.state}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      // Limitar a 2 caracteres (UF)
                      if (value.length <= 2) {
                        setNewCustomerForm({ ...newCustomerForm, state: value });
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: SP, RJ, MG"
                    maxLength={2}
                  />
                  <p className="text-xs text-gray-500 mt-1">Apenas a sigla do estado (2 letras)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                  <input
                    type="text"
                    value={newCustomerForm.zip_code}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, zip_code: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={newCustomerForm.notes}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer whitespace-nowrap"
                >
                  Criar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVehicleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Novo Veículo</h2>
              <button
                onClick={() => setShowVehicleModal(false)}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={newVehicleForm.brand}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, brand: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Honda, Toyota"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modelo *</label>
                  <input
                    type="text"
                    value={newVehicleForm.model}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, model: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Civic, Corolla"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                  <input
                    type="text"
                    value={newVehicleForm.year}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, year: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: 2020"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Placa *</label>
                  <input
                    type="text"
                    value={newVehicleForm.plate}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, plate: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: ABC-1234"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                  <input
                    type="text"
                    value={newVehicleForm.color}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, color: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Preto, Branco"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chassi</label>
                  <input
                    type="text"
                    value={newVehicleForm.chassis}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, chassis: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Número do chassi"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quilometragem Atual</label>
                  <input
                    type="text"
                    value={newVehicleForm.km}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, km: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: 50000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer whitespace-nowrap"
                >
                  Criar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Novo Produto */}
      {showNewProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Cadastrar Novo Produto</h2>
              <button
                onClick={() => {
                  setShowNewProductModal(false);
                  setNewProductForm({
                    name: '',
                    description: '',
                    category: 'peca',
                    unit_price: '',
                    cost_price: '',
                    stock_quantity: '',
                    min_stock: '1',
                  });
                }}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Produto *</label>
                  <input
                    type="text"
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Óleo de Motor 5W30"
                    required
                    autoFocus
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                  <textarea
                    value={newProductForm.description}
                    onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                    rows={2}
                    placeholder="Descrição do produto..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none cursor-pointer"
                  >
                    <option value="peca">Peça</option>
                    <option value="acessorio">Acessório</option>
                    <option value="fluido">Fluido</option>
                    <option value="filtro">Filtro</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductForm.unit_price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit_price: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="0,00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductForm.cost_price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, cost_price: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.stock_quantity}
                    onChange={(e) => setNewProductForm({ ...newProductForm, stock_quantity: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.min_stock}
                    onChange={(e) => setNewProductForm({ ...newProductForm, min_stock: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProductModal(false);
                    setNewProductForm({
                      name: '',
                      description: '',
                      category: 'peca',
                      unit_price: '',
                      cost_price: '',
                      stock_quantity: '',
                      min_stock: '1',
                    });
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer whitespace-nowrap"
                >
                  Cadastrar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Novo Serviço */}
      {showNewServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Cadastrar Novo Serviço</h2>
              <button
                onClick={() => {
                  setShowNewServiceModal(false);
                  setNewServiceForm({
                    name: '',
                    description: '',
                    unit_price: '',
                    estimated_time: '',
                    category: 'mecanica',
                  });
                }}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleCreateService} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Serviço *</label>
                  <input
                    type="text"
                    value={newServiceForm.name}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Troca de Óleo"
                    required
                    autoFocus
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                  <textarea
                    value={newServiceForm.description}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                    rows={3}
                    placeholder="Descrição do serviço..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                  <select
                    value={newServiceForm.category}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none cursor-pointer"
                    required
                  >
                    <option value="mecanica">Mecânica Geral</option>
                    <option value="eletrica">Elétrica</option>
                    <option value="suspensao">Suspensão</option>
                    <option value="freios">Freios</option>
                    <option value="motor">Motor</option>
                    <option value="cambio">Câmbio</option>
                    <option value="ar_condicionado">Ar Condicionado</option>
                    <option value="alinhamento">Alinhamento e Balanceamento</option>
                    <option value="pneus">Pneus</option>
                    <option value="estetica">Estética Automotiva</option>
                    <option value="diagnostico">Diagnóstico</option>
                    <option value="revisao">Revisão</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newServiceForm.unit_price}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, unit_price: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="0,00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tempo Estimado</label>
                  <input
                    type="text"
                    value={newServiceForm.estimated_time}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, estimated_time: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: 30 minutos, 1 hora"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewServiceModal(false);
                    setNewServiceForm({
                      name: '',
                      description: '',
                      unit_price: '',
                      estimated_time: '',
                      category: 'mecanica',
                    });
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer whitespace-nowrap"
                >
                  Cadastrar Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockAlert && stockAlertData && (
        <StockAlertDialog
          productName={stockAlertData.productName}
          currentStock={stockAlertData.currentStock}
          requestedQuantity={stockAlertData.requestedQuantity}
          onAddStock={handleAddStock}
          onCancel={handleCancelStockAlert}
        />
      )}

      {showInvoiceValidationModal && selectedOrderForInvoice && (
        <InvoiceValidationModal
          serviceOrderId={selectedOrderForInvoice}
          onClose={() => {
            setShowInvoiceValidationModal(false);
            setSelectedOrderForInvoice(null);
          }}
          onEmit={async () => {
            try {
              setIsEmittingInvoice(true);
              setShowInvoiceValidationModal(false);

              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                throw new Error('Sessão não encontrada');
              }

              const response = await fetch(
                `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/focus-nfe-emit-nfe-service`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ serviceOrderId: selectedOrderForInvoice }),
                }
              );

              const result = await response.json();

              if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erro ao emitir NF-e');
              }

              showToast('NF-e emitida com sucesso!', 'success');
              loadServiceOrders();

              // Abrir PDF da nota em nova aba
              if (result.invoice?.pdf_url) {
                window.open(result.invoice.pdf_url, '_blank');
              }
            } catch (error: any) {
              console.error('Erro ao emitir NF-e:', error);
              showToast(error.message || 'Erro ao emitir NF-e', 'error');
            } finally {
              setIsEmittingInvoice(false);
              setSelectedOrderForInvoice(null);
            }
          }}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          confirmText="Excluir"
          cancelText="Cancelar"
          type="danger"
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}