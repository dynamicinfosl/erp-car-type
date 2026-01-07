import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import StockAlertDialog from '../../components/common/StockAlertDialog';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
  stock_quantity: number;
}

interface Sale {
  id: string;
  customer_id: string;
  sale_date: string;
  total_amount: number;
  discount: number;
  final_amount: number;
  payment_method: string;
  status: string;
  notes: string;
  customers: Customer;
  service_order_id?: string;
}

interface POSSale {
  id: string;
  sale_number: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  created_at: string;
}

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [posSales, setPosSales] = useState<POSSale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editingSaleItems, setEditingSaleItems] = useState<any[]>([]);
  const [editingProducts, setEditingProducts] = useState<Product[]>([]);

  const [showStockAlert, setShowStockAlert] = useState(false);
  const [stockAlertData, setStockAlertData] = useState<{
    productId: string;
    productName: string;
    currentStock: number;
    requestedQuantity: number;
  } | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<any>(null);

  // Filtros
  const [filterType, setFilterType] = useState<'all' | 'regular' | 'pos'>('all');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    customer_id: '',
    payment_method: 'dinheiro',
    discount: '',
    notes: '',
  });

  const [items, setItems] = useState<SaleItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    quantity: '1',
  });

  useEffect(() => {
    loadSales();
    loadPOSSales();
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers(name, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPOSSales = async () => {
    try {
      const { data, error } = await supabase
        .from('pos_sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosSales(data || []);
    } catch (error) {
      console.error('Erro ao carregar vendas PDV:', error);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, []);

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

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const addItem = () => {
    if (!currentItem.product_id || !currentItem.quantity) return;

    const product = products.find(p => p.id === currentItem.product_id);
    if (!product) return;

    const quantity = parseInt(currentItem.quantity);
    
    // Verificar estoque - mostrar popup ao invés de bloquear
    if (quantity > product.stock_quantity) {
      setStockAlertData({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock_quantity,
        requestedQuantity: quantity,
      });
      setShowStockAlert(true);
      return;
    }

    const existingItemIndex = items.findIndex(item => item.product_id === currentItem.product_id);
    
    if (existingItemIndex >= 0) {
      const newItems = [...items];
      newItems[existingItemIndex].quantity += quantity;
      newItems[existingItemIndex].total_price = newItems[existingItemIndex].quantity * product.unit_price;
      setItems(newItems);
    } else {
      setItems([...items, {
        product_id: currentItem.product_id,
        quantity,
        unit_price: product.unit_price,
        total_price: quantity * product.unit_price,
      }]);
    }

    setCurrentItem({ product_id: '', quantity: '1' });
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
          movement_type: 'in',
          quantity: quantityToAdd,
          unit_price: 0,
          total_value: 0,
          reason: 'Entrada manual durante venda',
          reference_type: 'manual_entry',
        }]);

      // Recarregar produtos
      await loadProducts();

      alert(`${quantityToAdd} unidades adicionadas ao estoque!`);
      
      // Fechar popup
      setShowStockAlert(false);

      // Adicionar o item automaticamente após adicionar estoque
      const product = products.find(p => p.id === stockAlertData.productId);
      if (product) {
        const quantity = stockAlertData.requestedQuantity;
        const existingItemIndex = items.findIndex(item => item.product_id === stockAlertData.productId);
        
        if (existingItemIndex >= 0) {
          const newItems = [...items];
          newItems[existingItemIndex].quantity += quantity;
          newItems[existingItemIndex].total_price = newItems[existingItemIndex].quantity * product.unit_price;
          setItems(newItems);
        } else {
          setItems([...items, {
            product_id: stockAlertData.productId,
            quantity,
            unit_price: product.unit_price,
            total_price: quantity * product.unit_price,
          }]);
        }
      }

      setCurrentItem({ product_id: '', quantity: '1' });
      setStockAlertData(null);
    } catch (error) {
      console.error('Erro ao adicionar estoque:', error);
      alert('Erro ao adicionar estoque');
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
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const discount = parseFloat(formData.discount) || 0;
    return { subtotal, discount, total: subtotal - discount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      alert('Adicione pelo menos um produto à venda!');
      return;
    }

    try {
      const { subtotal, discount, total } = calculateTotal();

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_id: formData.customer_id || null,
          total_amount: subtotal,
          discount,
          final_amount: total,
          payment_method: formData.payment_method,
          status: 'completed',
          notes: formData.notes,
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = items.map(item => ({
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

      for (const item of items) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity - item.quantity })
            .eq('id', item.product_id);

          await supabase
            .from('stock_movements')
            .insert([{
              product_id: item.product_id,
              movement_type: 'out',
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_value: item.total_price,
              reason: 'Venda',
              reference_id: saleData.id,
              reference_type: 'sale',
            }]);
        }
      }

      await supabase
        .from('revenues')
        .insert([{
          description: `Venda #${saleData.id.substring(0, 8)}`,
          amount: total,
          category: 'venda',
          date: new Date().toISOString(),
        }]);

      setShowModal(false);
      resetForm();
      loadSales();
      alert('Venda registrada com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar venda:', error);
      alert('Erro ao registrar venda');
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      payment_method: 'dinheiro',
      discount: '',
      notes: '',
    });
    setItems([]);
    setCurrentItem({ product_id: '', quantity: '1' });
  };

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || '';
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      'dinheiro': 'Dinheiro',
      'cartao_debito': 'Cartão Débito',
      'cartao_credito': 'Cartão Crédito',
      'pix': 'PIX',
      'transferencia': 'Transferência',
      'multiplo': 'Múltiplas Formas',
      'Venda na OS': 'Venda na OS',
    };
    return labels[method] || method;
  };

  const handlePrint = (sale: Sale) => {
    if (sale.type === 'pos') {
      window.open(`/print/sale-receipt/pos/${sale.id}`, '_blank');
    } else if (sale.service_order_id) {
      window.open(`/print/sale-receipt/os/${sale.id}`, '_blank');
    } else {
      window.open(`/print/sale-receipt/regular/${sale.id}`, '_blank');
    }
  };

  const handlePrintReceipt = (saleId: string) => {
    window.REACT_APP_NAVIGATE(`/print/pos-receipt/${saleId}`);
  };

  const handlePrintSale = (sale: any) => {
    // Usar a mesma função de impressão para todos os tipos
    const saleType = sale.type === 'pos' ? 'pos' : 'regular';
    const printUrl = `${window.location.origin}${__BASE_PATH__}/print/sale-receipt/${saleType}/${sale.id}`;
    window.open(printUrl, '_blank');
  };

  const handlePrintServiceOrder = async () => {
    if (!selectedSaleForPrint) return;

    // Buscar a OS relacionada através do service_order_id
    if (selectedSaleForPrint.service_order_id) {
      const printUrl = `/print/service-order/${selectedSaleForPrint.service_order_id}`;
      window.open(printUrl, '_blank');
    } else {
      alert('Ordem de Serviço não encontrada');
    }
    setShowPrintModal(false);
  };

  const handlePrintSaleReceipt = async () => {
    if (!selectedSaleForPrint) return;

    try {
      // Buscar configurações da empresa
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      // Buscar itens da venda
      let saleItems: any[] = [];
      if (selectedSaleForPrint.service_order_id) {
        // Se for venda de OS, buscar itens da sale_items
        const { data } = await supabase
          .from('sale_items')
          .select('*, products(name)')
          .eq('sale_id', selectedSaleForPrint.id);
        saleItems = (data || []).map(item => ({
          ...item,
          product_name: item.products?.name || 'Produto'
        }));
      } else if (selectedSaleForPrint.type === 'pos') {
        const { data } = await supabase
          .from('pos_sale_items')
          .select('*')
          .eq('sale_id', selectedSaleForPrint.id);
        saleItems = data || [];
      } else {
        const { data } = await supabase
          .from('sale_items')
          .select('*, products(name)')
          .eq('sale_id', selectedSaleForPrint.id);
        saleItems = (data || []).map(item => ({
          ...item,
          product_name: item.products?.name || 'Produto'
        }));
      }

      const fullAddress = [
        settings?.address,
        settings?.city,
        settings?.state,
        settings?.zip_code
      ].filter(Boolean).join(', ');

      // Criar nova janela para impressão
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado.');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Cupom de Venda</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            @page { margin: 0; }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              margin: 0 auto;
              padding: 10mm;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { border-top: 2px solid #000; margin-top: 10px; padding-top: 5px; }
            img { max-width: 60px; height: auto; }
          </style>
        </head>
        <body>
          <div class="center">
            ${settings?.logo_url ? `<img src="${settings.logo_url}" alt="Logo">` : ''}
            <div class="bold" style="font-size: 16px;">${settings?.company_name || 'CAR TYPE MOTORS'}</div>
            <div style="font-size: 12px;">Centro Automotivo</div>
            ${settings?.cnpj ? `<div style="font-size: 10px;">CNPJ: ${settings.cnpj}</div>` : ''}
            ${settings?.phone ? `<div style="font-size: 10px;">Tel: ${settings.phone}</div>` : ''}
            ${settings?.email ? `<div style="font-size: 10px;">${settings.email}</div>` : ''}
            ${fullAddress ? `<div style="font-size: 10px;">${fullAddress}</div>` : ''}
          </div>

          <div class="divider"></div>

          <div class="center bold" style="font-size: 14px;">CUPOM DE VENDA</div>
          <div class="center" style="font-size: 12px;">#${selectedSaleForPrint.id.substring(0, 8).toUpperCase()}</div>
          <div class="center" style="font-size: 10px;">${new Date(selectedSaleForPrint.date).toLocaleString('pt-BR')}</div>

          <div class="divider"></div>

          <div style="font-size: 10px;">
            <div class="bold">CLIENTE</div>
            <div>${selectedSaleForPrint.customer || 'Cliente Avulso'}</div>
            ${selectedSaleForPrint.customer_phone ? `<div>${selectedSaleForPrint.customer_phone}</div>` : ''}
          </div>

          ${selectedSaleForPrint.notes ? `
          <div class="divider"></div>
          <div style="font-size: 10px;">
            <div class="bold">OBSERVAÇÕES</div>
            <div>${selectedSaleForPrint.notes}</div>
          </div>
          ` : ''}

          <div class="divider"></div>

          <div style="font-size: 10px;">
            <div class="bold">ITENS</div>
            ${saleItems.map(item => `
              <div style="margin: 8px 0;">
                <div class="bold">${item.product_name || item.products?.name || 'Produto'}</div>
                <div class="item">
                  <span>${item.quantity} x R$ ${item.unit_price.toFixed(2)}</span>
                  <span class="bold">R$ ${item.total_price.toFixed(2)}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="divider"></div>

          <div style="font-size: 10px;">
            <div class="item">
              <span>Subtotal:</span>
              <span>R$ ${(selectedSaleForPrint.type === 'pos' ? selectedSaleForPrint.subtotal : selectedSaleForPrint.total_amount).toFixed(2)}</span>
            </div>
            ${selectedSaleForPrint.discount > 0 ? `
            <div class="item">
              <span>Desconto:</span>
              <span>R$ ${selectedSaleForPrint.discount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="item total bold" style="font-size: 12px;">
              <span>TOTAL:</span>
              <span>R$ ${selectedSaleForPrint.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="center" style="font-size: 10px;">
            <div>Pagamento: ${getPaymentMethodLabel(selectedSaleForPrint.payment_method)}</div>
            <div style="margin-top: 15px;">Obrigado pela preferência!</div>
          </div>

          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #f97316; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Imprimir
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
              Fechar
            </button>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setShowPrintModal(false);
    } catch (error) {
      console.error('Erro ao gerar cupom:', error);
      alert('Erro ao gerar cupom de impressão');
    }
  };

  const toggleSelectSale = (saleId: string, saleType: string) => {
    const fullId = `${saleType}-${saleId}`;
    if (selectedSales.includes(fullId)) {
      setSelectedSales(selectedSales.filter(id => id !== fullId));
    } else {
      setSelectedSales([...selectedSales, fullId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSales.length === filteredSales.length) {
      setSelectedSales([]);
    } else {
      setSelectedSales(filteredSales.map(sale => `${sale.type}-${sale.id}`));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSales.length === 0) return;
    
    if (!confirm(`Deseja realmente excluir ${selectedSales.length} venda(s)?`)) return;

    try {
      for (const fullId of selectedSales) {
        const [type, id] = fullId.split('-');
        if (type === 'pos') {
          await supabase.from('pos_sales').delete().eq('id', id);
        } else {
          await supabase.from('sales').delete().eq('id', id);
        }
      }
      
      setSelectedSales([]);
      loadSales();
      alert('Vendas excluídas com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir vendas:', error);
      alert('Erro ao excluir vendas');
    }
  };

  const handleEditSale = async (sale: any) => {
    try {
      // Carregar itens da venda
      let saleItems: any[] = [];
      
      if (sale.type === 'pos') {
        const { data } = await supabase
          .from('pos_sale_items')
          .select('*')
          .eq('sale_id', sale.id);
        saleItems = data || [];
      } else {
        const { data } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', sale.id);
        saleItems = data || [];
      }

      setEditingSale(sale);
      setEditingSaleItems(saleItems);
      setShowEditModal(true);
    } catch (error) {
      console.error('Erro ao carregar venda:', error);
      alert('Erro ao carregar dados da venda');
    }
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    try {
      const subtotal = editingSaleItems.reduce((sum, item) => sum + item.total_price, 0);
      const finalAmount = subtotal - (editingSale.discount || 0);

      if (editingSale.type === 'pos') {
        // Atualizar venda PDV
        await supabase
          .from('pos_sales')
          .update({
            customer_name: editingSale.customer,
            customer_phone: editingSale.customer_phone || '',
            discount: editingSale.discount || 0,
            subtotal: subtotal,
            total_amount: finalAmount,
            payment_method: editingSale.payment_method,
          })
          .eq('id', editingSale.id);

        // Deletar itens antigos
        await supabase
          .from('pos_sale_items')
          .delete()
          .eq('sale_id', editingSale.id);

        // Inserir novos itens
        await supabase
          .from('pos_sale_items')
          .insert(editingSaleItems.map(item => ({
            sale_id: editingSale.id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          })));
      } else {
        // Atualizar venda regular
        await supabase
          .from('sales')
          .update({
            customer_id: editingSale.customer_id || null,
            total_amount: subtotal,
            discount: editingSale.discount || 0,
            final_amount: finalAmount,
            payment_method: editingSale.payment_method,
            notes: editingSale.notes || '',
          })
          .eq('id', editingSale.id);

        // Deletar itens antigos
        await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', editingSale.id);

        // Inserir novos itens
        await supabase
          .from('sale_items')
          .insert(editingSaleItems.map(item => ({
            sale_id: editingSale.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          })));
      }

      setShowEditModal(false);
      setEditingSale(null);
      setEditingSaleItems([]);
      setCurrentItem({ product_id: '', quantity: '1' });
      loadSales();
      alert('Venda atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar venda:', error);
      alert('Erro ao atualizar venda');
    }
  };

  const addEditingItem = () => {
    const product = products.find(p => p.id === currentItem.product_id);
    if (!product) return;

    const quantity = parseInt(currentItem.quantity);
    
    // Verificar estoque - mostrar popup ao invés de bloquear
    if (quantity > product.stock_quantity) {
      setStockAlertData({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock_quantity,
        requestedQuantity: quantity,
      });
      setShowStockAlert(true);
      return;
    }

    const newItem = {
      product_id: currentItem.product_id,
      product_name: product.name,
      quantity,
      unit_price: product.unit_price,
      total_price: quantity * product.unit_price,
    };

    setEditingSaleItems([...editingSaleItems, newItem]);
    setCurrentItem({ product_id: '', quantity: '1' });
  };

  const removeEditingItem = (index: number) => {
    setEditingSaleItems(editingSaleItems.filter((_, i) => i !== index));
  };

  const updateEditingItemQuantity = (index: number, newQuantity: number) => {
    const newItems = [...editingSaleItems];
    newItems[index].quantity = newQuantity;
    newItems[index].total_price = newQuantity * newItems[index].unit_price;
    setEditingSaleItems(newItems);
  };

  const updateEditingItemPrice = (index: number, newPrice: number) => {
    const newItems = [...editingSaleItems];
    newItems[index].unit_price = newPrice;
    newItems[index].total_price = newItems[index].quantity * newPrice;
    setEditingSaleItems(newItems);
  };

  const handleDeleteSale = async (saleId: string, saleType: string) => {
    if (!confirm('Deseja realmente excluir esta venda? Os produtos retornarão ao estoque.')) return;

    try {
      // Buscar itens da venda para devolver ao estoque
      let saleItems: any[] = [];
      
      if (saleType === 'pos') {
        const { data } = await supabase
          .from('pos_sale_items')
          .select('*')
          .eq('sale_id', saleId);
        saleItems = data || [];

        // Devolver produtos ao estoque (buscar product_id pelo nome)
        for (const item of saleItems) {
          const { data: productData } = await supabase
            .from('products')
            .select('id, stock_quantity')
            .eq('name', item.product_name)
            .single();

          if (productData) {
            await supabase
              .from('products')
              .update({ 
                stock_quantity: productData.stock_quantity + item.quantity 
              })
              .eq('id', productData.id);

            // Registrar movimento de estoque
            await supabase
              .from('stock_movements')
              .insert([{
                product_id: productData.id,
                movement_type: 'in',
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_value: item.total_price,
                reason: 'Devolução - Venda Cancelada',
                reference_id: saleId,
                reference_type: 'sale_cancellation',
              }]);
          }
        }

        // Deletar venda
        await supabase.from('pos_sales').delete().eq('id', saleId);
      } else {
        const { data } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', saleId);
        saleItems = data || [];

        // Devolver produtos ao estoque
        for (const item of saleItems) {
          const { data: productData } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (productData) {
            await supabase
              .from('products')
              .update({ 
                stock_quantity: productData.stock_quantity + item.quantity 
              })
              .eq('id', item.product_id);

            // Registrar movimento de estoque
            await supabase
              .from('stock_movements')
              .insert([{
                product_id: item.product_id,
                movement_type: 'in',
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_value: item.total_price,
                reason: 'Devolução - Venda Cancelada',
                reference_id: saleId,
                reference_type: 'sale_cancellation',
              }]);
          }
        }

        // Deletar venda
        await supabase.from('sales').delete().eq('id', saleId);
      }

      loadSales();
      alert('Venda excluída e produtos devolvidos ao estoque!');
    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      alert('Erro ao excluir venda');
    }
  };

  // Filtrar vendas
  const getFilteredSales = () => {
    let allSales: any[] = [];

    // Adicionar vendas regulares
    if (filterType === 'all' || filterType === 'regular') {
      allSales = [...allSales, ...sales.map(sale => ({
        ...sale,
        type: 'regular',
        date: sale.created_at || sale.sale_date,
        customer: sale.customers?.name || 'Cliente Avulso',
        total: sale.final_amount,
      }))];
    }

    // Adicionar vendas do PDV
    if (filterType === 'all' || filterType === 'pos') {
      allSales = [...allSales, ...posSales.map(sale => ({
        ...sale,
        type: 'pos',
        date: sale.created_at,
        customer: sale.customer_name || 'Cliente Avulso',
        total: sale.total_amount,
      }))];
    }

    // Filtrar por forma de pagamento
    if (filterPayment) {
      allSales = allSales.filter(sale => sale.payment_method === filterPayment);
    }

    // Filtrar por data
    if (filterDateStart) {
      allSales = allSales.filter(sale => new Date(sale.date) >= new Date(filterDateStart));
    }
    if (filterDateEnd) {
      allSales = allSales.filter(sale => new Date(sale.date) <= new Date(filterDateEnd + 'T23:59:59'));
    }

    // Filtrar por busca com normalização de texto
    if (searchTerm) {
      // Função para normalizar texto removendo acentos
      const normalizeText = (text: string) => {
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      };

      const normalizedSearchTerm = normalizeText(searchTerm);

      allSales = allSales.filter(sale => 
        normalizeText(sale.customer || '').includes(normalizedSearchTerm) ||
        (sale.customer_phone && sale.customer_phone.includes(searchTerm)) ||
        normalizeText(sale.id).includes(normalizedSearchTerm) ||
        normalizeText(sale.payment_method || '').includes(normalizedSearchTerm)
      );
    }

    // Ordenar por data (mais recente primeiro)
    allSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allSales;
  };

  const filteredSales = getFilteredSales();

  const { subtotal, discount, total } = calculateTotal();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vendas</h1>
              <p className="text-gray-600 mt-1">Registre vendas de produtos e peças</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-add-line text-xl"></i>
              Nova Venda
            </button>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Venda
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                >
                  <option value="all">Todas</option>
                  <option value="regular">Vendas Regulares</option>
                  <option value="pos">Vendas PDV</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma de Pagamento
                </label>
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                >
                  <option value="">Todas</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Cartão Débito</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência</option>
                  <option value="multiplo">Múltiplas Formas</option>
                  <option value="Venda na OS">Venda na OS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cliente ou número..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {(filterType !== 'all' || filterPayment || filterDateStart || filterDateEnd || searchTerm) && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setFilterType('all');
                    setFilterPayment('');
                    setFilterDateStart('');
                    setFilterDateEnd('');
                    setSearchTerm('');
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium cursor-pointer whitespace-nowrap"
                >
                  Limpar Filtros
                </button>
              </div>
            )}
          </div>

          {/* Ações em Massa */}
          {selectedSales.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6 flex items-center justify-between">
              <p className="text-sm font-medium text-teal-900">
                {selectedSales.length} venda(s) selecionada(s)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer text-sm"
                >
                  <i className="ri-delete-bin-line"></i>
                  Excluir Selecionadas
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedSales.length === filteredSales.length && filteredSales.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Desconto</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Total</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Pagamento</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSales.map((sale) => (
                    <tr key={`${sale.type}-${sale.id}`} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedSales.includes(`${sale.type}-${sale.id}`)}
                          onChange={() => toggleSelectSale(sale.id, sale.type)}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          sale.payment_method === 'Venda na OS'
                            ? 'bg-purple-100 text-purple-800'
                            : sale.type === 'pos'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}>
                          {sale.payment_method === 'Venda na OS' ? 'Venda na OS' : sale.type === 'pos' ? 'PDV' : 'Regular'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(sale.date).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {sale.customer}
                        </div>
                        {sale.customer_phone && (
                          <div className="text-sm text-gray-500">{sale.customer_phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        R$ {(sale.type === 'pos' ? sale.subtotal : sale.total_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {sale.discount > 0 ? `R$ ${sale.discount.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        R$ {sale.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getPaymentMethodLabel(sale.payment_method)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditSale(sale)}
                            className="text-blue-600 hover:text-blue-700 cursor-pointer"
                            title="Editar"
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </button>
                          <button
                            onClick={() => handlePrintSale(sale)}
                            className={`hover:opacity-80 cursor-pointer ${
                              sale.payment_method === 'Venda na OS'
                                ? 'text-purple-600'
                                : sale.type === 'pos'
                                ? 'text-orange-600'
                                : 'text-teal-600'
                            }`}
                            title="Imprimir"
                          >
                            <i className="ri-printer-line text-lg"></i>
                          </button>
                          {sale.service_order_id && (
                            <button
                              onClick={() => {
                                const osUrl = `${window.location.origin}${__BASE_PATH__}/service-orders?id=${sale.service_order_id}`;
                                window.open(osUrl, '_blank');
                              }}
                              className="text-purple-600 hover:text-purple-700 cursor-pointer"
                              title="Ver Ordem de Serviço"
                            >
                              <i className="ri-file-list-3-line text-lg"></i>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              window.REACT_APP_NAVIGATE(`/sales/returns?sale_id=${sale.id}&sale_type=${sale.type}`);
                            }}
                            className="text-purple-600 hover:text-purple-700 cursor-pointer"
                            title="Devolução"
                          >
                            <i className="ri-arrow-go-back-line text-lg"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteSale(sale.id, sale.type)}
                            className="text-red-600 hover:text-red-700 cursor-pointer"
                            title="Excluir"
                          >
                            <i className="ri-delete-bin-line text-lg"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredSales.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <i className="ri-shopping-cart-line text-5xl mb-4"></i>
                  <p>Nenhuma venda encontrada</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição Completo */}
      {showEditModal && editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Editar Venda</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações do Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editingSale.type === 'pos' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Cliente
                      </label>
                      <input
                        type="text"
                        value={editingSale.customer}
                        onChange={(e) => setEditingSale({ ...editingSale, customer: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Telefone
                      </label>
                      <input
                        type="text"
                        value={editingSale.customer_phone || ''}
                        onChange={(e) => setEditingSale({ ...editingSale, customer_phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cliente
                    </label>
                    <select
                      value={editingSale.customer_id || ''}
                      onChange={(e) => setEditingSale({ ...editingSale, customer_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="">Cliente Avulso</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forma de Pagamento
                  </label>
                  <select
                    value={editingSale.payment_method}
                    onChange={(e) => setEditingSale({ ...editingSale, payment_method: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                    <option value="multiplo">Múltiplas Formas</option>
                  </select>
                </div>
              </div>

              {/* Produtos da Venda */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Produtos</h3>
                
                {/* Adicionar Produto */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Adicionar Produto
                    </label>
                    <select
                      value={currentItem.product_id}
                      onChange={(e) => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="">Selecione um produto</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - R$ {product.unit_price.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={addEditingItem}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-add-line"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Produtos */}
                {editingSaleItems.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-600">
                          <th className="pb-2">Produto</th>
                          <th className="pb-2">Qtd</th>
                          <th className="pb-2">Preço Unit.</th>
                          <th className="pb-2">Total</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingSaleItems.map((item, index) => (
                          <tr key={index} className="border-t border-gray-200">
                            <td className="py-2 text-sm">{item.product_name}</td>
                            <td className="py-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateEditingItemQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_price}
                                onChange={(e) => updateEditingItemPrice(index, parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="py-2 text-sm font-medium">R$ {item.total_price.toFixed(2)}</td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeEditingItem(index)}
                                className="text-red-600 hover:text-red-700 cursor-pointer"
                              >
                                <i className="ri-delete-bin-line"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Desconto e Observações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desconto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingSale.discount || 0}
                    onChange={(e) => setEditingSale({ ...editingSale, discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {editingSale.type === 'regular' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observações
                    </label>
                    <input
                      type="text"
                      value={editingSale.notes || ''}
                      onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Resumo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">
                      R$ {editingSaleItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}
                    </span>
                  </div>
                  {editingSale.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Desconto:</span>
                      <span className="text-red-600">- R$ {editingSale.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span>Total:</span>
                    <span className="text-teal-600">
                      R$ {(editingSaleItems.reduce((sum, item) => sum + item.total_price, 0) - (editingSale.discount || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSale(null);
                  setEditingSaleItems([]);
                  setCurrentItem({ product_id: '', quantity: '1' });
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateSale}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Venda */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Nova Venda</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente (Opcional)
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Cliente Avulso</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forma de Pagamento *
                  </label>
                  <select
                    required
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Produtos</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Produto
                    </label>
                    <select
                      value={currentItem.product_id}
                      onChange={(e) => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="">Selecione um produto</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - R$ {product.unit_price.toFixed(2)} (Estoque: {product.stock_quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={addItem}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-add-line"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-600">
                          <th className="pb-2">Produto</th>
                          <th className="pb-2">Qtd</th>
                          <th className="pb-2">Preço Unit.</th>
                          <th className="pb-2">Total</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="border-t border-gray-200">
                            <td className="py-2 text-sm">{getProductName(item.product_id)}</td>
                            <td className="py-2 text-sm">{item.quantity}</td>
                            <td className="py-2 text-sm">R$ {item.unit_price.toFixed(2)}</td>
                            <td className="py-2 text-sm font-medium">R$ {item.total_price.toFixed(2)}</td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-700 cursor-pointer"
                              >
                                <i className="ri-delete-bin-line"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Desconto (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observações
                    </label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Desconto:</span>
                      <span className="text-red-600">- R$ {discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span>Total:</span>
                    <span className="text-teal-600">R$ {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={items.length === 0}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Finalizar Venda
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
    </div>
  );
}
