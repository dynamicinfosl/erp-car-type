import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import Toast from '../../components/common/Toast';

interface Product {
  id: string;
  name: string;
  unit_price: number;
  stock_quantity: number;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface CashRegister {
  id: string;
  user_id: string;
  user_name: string;
  opening_amount: number;
  closing_amount: number | null;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_pix: number;
  opened_at: string;
  closed_at: string | null;
  status: string;
  notes: string | null;
}

interface PaymentMethod {
  method: string;
  amount: number;
}

interface PaymentItem {
  method: string;
  amount: number;
}

export default function POS() {
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [currentCashRegister, setCurrentCashRegister] = useState<CashRegister | null>(null);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [discount, setDiscount] = useState(0);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Estados para finalização
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState('dinheiro');
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState('');
  const [changeAmount, setChangeAmount] = useState(0);

  // Estados para seleção de produto
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [productPrice, setProductPrice] = useState(0);

  // Estado para confirmação de venda
  const [showSaleConfirmation, setShowSaleConfirmation] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const [completedSaleData, setCompletedSaleData] = useState<any>(null);
  const [emittingNFCe, setEmittingNFCe] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    checkOpenCashRegister();
  }, []);

  useEffect(() => {
    if (currentCashRegister) {
      loadProducts();
      loadCustomers();
    }
  }, [currentCashRegister]);

  useEffect(() => {
    if (selectedProduct) {
      setProductPrice(selectedProduct.unit_price);
    }
  }, [selectedProduct]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('system_users')
          .select('*')
          .eq('email', user.email)
          .single();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  };

  const checkOpenCashRegister = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setCurrentCashRegister(data);
      } else {
        setShowOpenCashModal(true);
      }
    } catch (error) {
      console.error('Erro ao verificar caixa:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCash = async () => {
    if (!openingAmount || parseFloat(openingAmount) < 0) {
      setToast({ message: 'Informe o valor de abertura', type: 'warning' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('system_users')
        .select('name')
        .eq('email', user.email)
        .single();

      const { data, error } = await supabase
        .from('cash_registers')
        .insert([{
          user_id: user.id,
          user_name: userData?.name || user.email,
          opening_amount: parseFloat(openingAmount),
          status: 'open',
        }])
        .select()
        .single();

      if (error) throw error;

      setCurrentCashRegister(data);
      setShowOpenCashModal(false);
      setOpeningAmount('');
      setToast({ message: 'Caixa aberto com sucesso!', type: 'success' });
    } catch (error) {
      console.error('Erro ao abrir caixa:', error);
      setToast({ message: 'Erro ao abrir caixa', type: 'error' });
    }
  };

  const handleCloseCash = async () => {
    if (!closingAmount || parseFloat(closingAmount) < 0) {
      setToast({ message: 'Informe o valor de fechamento', type: 'warning' });
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_registers')
        .update({
          closing_amount: parseFloat(closingAmount),
          closed_at: new Date().toISOString(),
          status: 'closed',
          notes: closingNotes || null,
        })
        .eq('id', currentCashRegister!.id);

      if (error) throw error;

      setToast({ message: 'Caixa fechado com sucesso!', type: 'success' });
      setShowCloseCashModal(false);
      setCurrentCashRegister(null);
      setClosingAmount('');
      setClosingNotes('');
      
      setTimeout(() => {
        setShowOpenCashModal(true);
      }, 1000);
    } catch (error) {
      console.error('Erro ao fechar caixa:', error);
      setToast({ message: 'Erro ao fechar caixa', type: 'error' });
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit_price, stock_quantity')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setAllProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setToast({ message: 'Erro ao carregar produtos', type: 'error' });
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone')
        .order('name');

      if (error) throw error;
      setCustomers([
        { id: 'balcao', name: 'Cliente Avulso (Balcão)', phone: '' },
        ...(data || [])
      ]);
      setSelectedCustomer('balcao');
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const filteredProducts = allProducts.filter(product => {
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };
    return normalizeText(product.name).includes(normalizeText(searchTerm));
  });

  const filteredCustomers = customers.filter(customer => {
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };
    return customer.id !== 'balcao' && normalizeText(customer.name).includes(normalizeText(customerSearchTerm));
  });

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
    setProductPrice(product.unit_price);
    setSearchTerm('');
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    if (productQuantity <= 0) {
      setToast({ message: 'Quantidade inválida', type: 'warning' });
      return;
    }

    if (selectedProduct.stock_quantity > 0 && productQuantity > selectedProduct.stock_quantity) {
      setToast({ message: 'Estoque insuficiente', type: 'warning' });
      return;
    }

    const existingItem = cart.find(item => item.product_id === selectedProduct.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + productQuantity;
      if (selectedProduct.stock_quantity > 0 && newQuantity > selectedProduct.stock_quantity) {
        setToast({ message: 'Estoque insuficiente', type: 'warning' });
        return;
      }
      
      setCart(cart.map(item =>
        item.product_id === selectedProduct.id
          ? {
              ...item,
              quantity: newQuantity,
              unit_price: productPrice,
              total_price: newQuantity * productPrice,
            }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: productQuantity,
        unit_price: productPrice,
        total_price: productQuantity * productPrice,
      }]);
    }

    setSelectedProduct(null);
    setProductQuantity(1);
    setSearchTerm('');
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.total_price, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - discount;
  };

  const handleOpenPaymentModal = () => {
    if (cart.length === 0) {
      setToast({ message: 'Adicione produtos ao carrinho', type: 'warning' });
      return;
    }
    setShowPaymentModal(true);
    setPayments([]);
    setCurrentPaymentAmount('');
    setChangeAmount(0);
  };

  const addPayment = () => {
    const amount = parseFloat(currentPaymentAmount);
    if (!amount || amount <= 0) {
      setToast({ message: 'Informe um valor válido', type: 'warning' });
      return;
    }

    const remaining = getRemaining();

    if (currentPaymentMethod === 'dinheiro' && amount > remaining) {
      const change = amount - remaining;
      setChangeAmount(change);
      
      const newPayment: PaymentMethod = {
        method: currentPaymentMethod,
        amount: remaining,
      };
      setPayments([...payments, newPayment]);
    } else {
      const newPayment: PaymentMethod = {
        method: currentPaymentMethod,
        amount: Math.min(amount, remaining),
      };
      setPayments([...payments, newPayment]);
      setChangeAmount(0);
    }

    setCurrentPaymentAmount('');
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
    setChangeAmount(0);
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  const getRemaining = () => {
    return calculateTotal() - getTotalPaid();
  };

  const handleConfirmSale = async () => {
    const totalPaid = getTotalPaid();
    const total = calculateTotal();

    if (totalPaid < total) {
      setToast({ message: 'Pagamento incompleto', type: 'warning' });
      return;
    }

    if (!currentCashRegister) {
      setToast({ message: 'Nenhum caixa aberto', type: 'error' });
      return;
    }

    try {
      const saleNumber = `PDV-${Date.now()}`;
      const subtotal = calculateSubtotal();

      const customer = customers.find(c => c.id === selectedCustomer);

      const { data: saleData, error: saleError } = await supabase
        .from('pos_sales')
        .insert([{
          sale_number: saleNumber,
          customer_name: customer?.id === 'balcao' ? null : customer?.name,
          customer_phone: customer?.id === 'balcao' ? null : customer?.phone,
          payment_method: payments.length === 1 ? payments[0].method : 'multiplo',
          subtotal,
          discount,
          total_amount: total,
          cash_register_id: currentCashRegister.id,
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      const items = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await supabase
        .from('pos_sale_items')
        .insert(items);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        const product = allProducts.find(p => p.id === item.product_id);
        if (product && product.stock_quantity > 0) {
          const { error: stockError } = await supabase
            .from('products')
            .update({
              stock_quantity: product.stock_quantity - item.quantity,
            })
            .eq('id', item.product_id);

          if (stockError) throw stockError;
        }
      }

      let cashTotal = 0;
      let cardTotal = 0;
      let pixTotal = 0;

      payments.forEach(payment => {
        if (payment.method === 'dinheiro') {
          cashTotal += payment.amount;
        } else if (payment.method === 'cartao_credito' || payment.method === 'cartao_debito') {
          cardTotal += payment.amount;
        } else if (payment.method === 'pix') {
          pixTotal += payment.amount;
        }
      });

      const { error: cashError } = await supabase
        .from('cash_registers')
        .update({
          total_sales: currentCashRegister.total_sales + total,
          total_cash: currentCashRegister.total_cash + cashTotal,
          total_card: currentCashRegister.total_card + cardTotal,
          total_pix: currentCashRegister.total_pix + pixTotal,
        })
        .eq('id', currentCashRegister.id);

      if (cashError) throw cashError;

      await supabase.from('revenues').insert([{
        description: `Venda PDV ${saleNumber}`,
        amount: total,
        category: 'Vendas',
        status: 'received',
        date: new Date().toISOString().split('T')[0],
      }]);

      setCompletedSaleId(saleData.id);
      setCompletedSaleData({
        saleNumber,
        customer: customer?.name || 'Cliente Avulso',
        items: cart,
        subtotal,
        discount,
        total,
        payments,
      });

      setShowPaymentModal(false);
      setShowSaleConfirmation(true);
      
      resetSale();
      loadProducts();
      checkOpenCashRegister();
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      setToast({ message: 'Erro ao finalizar venda', type: 'error' });
    }
  };

  const resetSale = () => {
    setCart([]);
    setSelectedCustomer('balcao');
    setDiscount(0);
    setSearchTerm('');
    setSelectedProduct(null);
    setPayments([]);
    setCurrentPaymentAmount('');
    setShowCustomerSearch(false);
    setCustomerSearchTerm('');
  };

  const handlePrintReceipt = () => {
    if (completedSaleId) {
      const printUrl = `${window.location.origin}${__BASE_PATH__}/print/pos-receipt/${completedSaleId}`;
      window.open(printUrl, '_blank');
    }
  };

  const handleCloseSaleConfirmation = () => {
    setShowSaleConfirmation(false);
    setCompletedSaleId(null);
    setCompletedSaleData(null);
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      'dinheiro': 'Dinheiro',
      'cartao_debito': 'Cartão Débito',
      'cartao_credito': 'Cartão Crédito',
      'pix': 'PIX',
    };
    return labels[method] || method;
  };

  const handleEmitNFCe = async () => {
    if (!completedSaleId || !completedSaleData) return;

    setEmittingNFCe(true);
    try {
      const { data, error } = await supabase.functions.invoke('focus-nfe-emit-nfc-e', {
        body: {
          saleId: completedSaleId,
          saleNumber: completedSaleData.saleNumber,
          customer: completedSaleData.customer,
          items: completedSaleData.items,
          total: completedSaleData.total,
          payments: completedSaleData.payments,
        },
      });

      if (error) throw error;

      if (data.success) {
        setToast({ 
          message: `NFC-e emitida com sucesso! Número: ${data.numero}`, 
          type: 'success' 
        });
        
        await supabase
          .from('pos_sales')
          .update({
            nfce_number: data.numero,
            nfce_key: data.chave,
            nfce_url: data.url,
            nfce_pdf_url: data.url_pdf,
          })
          .eq('id', completedSaleId);
      } else {
        setToast({ 
          message: data.message || 'Erro ao emitir NFC-e', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Erro ao emitir NFC-e:', error);
      setToast({ message: 'Erro ao emitir NFC-e', type: 'error' });
    } finally {
      setEmittingNFCe(false);
    }
  };

  if (showOpenCashModal) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        
        <div className="flex-1 overflow-auto ml-64 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-cash-line text-4xl text-white"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Abertura de Caixa</h2>
              <p className="text-gray-600">Informe o valor inicial do caixa para começar</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Operador
                </label>
                <input
                  type="text"
                  value={currentUser?.name || ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor de Abertura (R$) *
                </label>
                <input
                  type="number"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                  autoFocus
                />
              </div>

              <button
                onClick={handleOpenCash}
                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition font-semibold text-lg cursor-pointer whitespace-nowrap"
              >
                Abrir Caixa
              </button>
            </div>
          </div>
        </div>

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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden flex flex-col ml-64">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ponto de Venda</h1>
              <p className="text-sm text-gray-600 mt-1">
                Operador: <span className="font-semibold">{currentUser?.name || currentCashRegister?.user_name}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4">
                <p className="text-xs text-gray-500">Caixa Aberto</p>
                <p className="text-lg font-bold text-green-600">
                  R$ {currentCashRegister?.opening_amount.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setShowCloseCashModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer text-sm"
              >
                <i className="ri-close-circle-line"></i>
                Fechar Caixa
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Side - Products */}
          <div className="flex-1 overflow-auto p-6">
            <div className="mb-4">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl"></i>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar produto..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                {searchTerm && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3">
                        <p className="text-sm text-gray-500 text-center">Nenhum produto encontrado</p>
                      </div>
                    ) : (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleSelectProduct(product)}
                          className="w-full px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0 cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className={`text-xs ${product.stock_quantity > 0 ? 'text-gray-500' : 'text-red-600 font-semibold'}`}>
                                {product.stock_quantity > 0 ? `Estoque: ${product.stock_quantity}` : 'SEM ESTOQUE'}
                              </p>
                            </div>
                            <p className="text-lg font-bold text-orange-600">
                              R$ {product.unit_price.toFixed(2)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Produto Selecionado */}
            {selectedProduct && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-orange-500">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Produto Selecionado</h3>
                
                {selectedProduct.stock_quantity === 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <i className="ri-alert-line text-red-600 text-xl"></i>
                    <p className="text-sm text-red-800 font-semibold">Este produto está sem estoque!</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                    <input
                      type="text"
                      value={selectedProduct.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                      <input
                        type="number"
                        value={productQuantity}
                        onChange={(e) => setProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unit. (R$)</label>
                      <input
                        type="number"
                        value={productPrice}
                        onChange={(e) => setProductPrice(parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total (R$)</label>
                      <input
                        type="text"
                        value={(productQuantity * productPrice).toFixed(2)}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAddToCart}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-add-line mr-2"></i>
                      Adicionar ao Carrinho
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProduct(null);
                        setSearchTerm('');
                      }}
                      className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Informações */}
            {!selectedProduct && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-information-line text-2xl text-blue-600 mt-1"></i>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Como usar o PDV</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Digite o nome do produto na busca acima</li>
                      <li>• Selecione o produto desejado</li>
                      <li>• Ajuste quantidade e preço se necessário</li>
                      <li>• Adicione ao carrinho</li>
                      <li>• Finalize a venda no painel ao lado</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Cart */}
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Carrinho de Compras</h2>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <i className="ri-shopping-cart-line text-5xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500 text-sm">Nenhum item no carrinho</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.product_id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 pr-2">
                          <h3 className="font-medium text-gray-900 text-sm">{item.product_name}</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.quantity} x R$ {item.unit_price.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-gray-900">
                          R$ {item.total_price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                  {!showCustomerSearch ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
                        {customers.find(c => c.id === selectedCustomer)?.name || 'Cliente Avulso (Balcão)'}
                      </div>
                      {selectedCustomer === 'balcao' && (
                        <button
                          onClick={() => setShowCustomerSearch(true)}
                          className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        placeholder="Buscar cliente..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        autoFocus
                      />
                      {customerSearchTerm && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                          {filteredCustomers.length === 0 ? (
                            <div className="p-2">
                              <p className="text-xs text-gray-500 text-center">Nenhum cliente encontrado</p>
                            </div>
                          ) : (
                            filteredCustomers.map((customer) => (
                              <button
                                key={customer.id}
                                onClick={() => {
                                  setSelectedCustomer(customer.id);
                                  setShowCustomerSearch(false);
                                  setCustomerSearchTerm('');
                                }}
                                className="w-full px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0 cursor-pointer"
                              >
                                <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                                {customer.phone && <p className="text-xs text-gray-500">{customer.phone}</p>}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setShowCustomerSearch(false);
                          setCustomerSearchTerm('');
                          setSelectedCustomer('balcao');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">R$ {calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Desconto:</span>
                        <span className="text-red-600">- R$ {discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                      <span>TOTAL</span>
                      <span className="text-orange-600">R$ {calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={resetSale}
                    className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition whitespace-nowrap cursor-pointer font-medium"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={handleOpenPaymentModal}
                    className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition whitespace-nowrap cursor-pointer font-medium"
                  >
                    FINALIZAR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Pagamento</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">R$ {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Desconto:</span>
                      <span className="text-red-600">- R$ {discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span>Total:</span>
                    <span className="text-teal-600">R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Adicionar Forma de Pagamento */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Adicionar Forma de Pagamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Forma de Pagamento
                    </label>
                    <select
                      value={currentPaymentMethod}
                      onChange={(e) => setCurrentPaymentMethod(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao_debito">Cartão Débito</option>
                      <option value="cartao_credito">Cartão Crédito</option>
                      <option value="pix">PIX</option>
                      <option value="transferencia">Transferência</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor Recebido
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={currentPaymentAmount}
                        onChange={(e) => setCurrentPaymentAmount(e.target.value)}
                        placeholder="0,00"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <button
                        onClick={addPayment}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-add-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formas de Pagamento Adicionadas */}
              {payments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Pagamentos Adicionados
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {payments.map((payment, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-white p-3 rounded-lg"
                      >
                        <div>
                          <span className="font-medium">
                            {getPaymentMethodLabel(payment.method)}
                          </span>
                          <span className="text-gray-600 ml-2">
                            R$ {payment.amount.toFixed(2)}
                          </span>
                        </div>
                        <button
                          onClick={() => removePayment(index)}
                          className="text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumo de Pagamento */}
              <div className="bg-teal-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Total:</span>
                    <span className="font-medium">R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Pago:</span>
                    <span className="font-medium text-green-600">
                      R$ {getTotalPaid().toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-teal-200 pt-2 mt-1">
                    <span>Restante:</span>
                    <span className={getRemaining() > 0 ? 'text-red-600' : 'text-green-600'}>
                      R$ {getRemaining().toFixed(2)}
                    </span>
                  </div>
                  {changeAmount > 0 && (
                    <div className="flex justify-between text-lg font-bold border-t border-teal-200 pt-2">
                      <span>Troco:</span>
                      <span className="text-green-600">R$ {changeAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPayments([]);
                  setCurrentPaymentAmount('');
                  setChangeAmount(0);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSale}
                disabled={getRemaining() > 0}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Finalizar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Venda */}
      {showSaleConfirmation && completedSaleData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                  <i className="ri-check-line text-3xl text-green-600"></i>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Venda Confirmada!</h2>
                  <p className="text-green-100 text-sm">A venda foi registrada com sucesso</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Número da Venda */}
              <div className="text-center bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Número da Venda</p>
                <p className="text-2xl font-bold text-gray-900">{completedSaleData.saleNumber}</p>
              </div>

              {/* Cliente */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm font-medium text-gray-700 mb-1">Cliente</p>
                <p className="text-lg font-bold text-gray-900">{completedSaleData.customer}</p>
              </div>

              {/* Itens */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Itens da Venda</h3>
                <div className="space-y-2">
                  {completedSaleData.items.map((item: CartItem, index: number) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{item.product_name}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity} x R$ {item.unit_price.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          R$ {item.total_price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagamentos */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Formas de Pagamento</h3>
                <div className="space-y-2">
                  {completedSaleData.payments.map((payment: PaymentItem, index: number) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                      <p className="font-medium text-gray-900">{getPaymentMethodLabel(payment.method)}</p>
                      <p className="text-lg font-bold text-gray-900">R$ {payment.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totais */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-medium text-gray-900">R$ {completedSaleData.subtotal.toFixed(2)}</span>
                  </div>
                  {completedSaleData.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Desconto:</span>
                      <span className="font-medium text-red-600">- R$ {completedSaleData.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-300">
                    <span>TOTAL</span>
                    <span className="text-green-700">R$ {completedSaleData.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={handleCloseSaleConfirmation}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition whitespace-nowrap cursor-pointer font-medium"
                >
                  Fechar
                </button>
                <button
                  onClick={handlePrintReceipt}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition whitespace-nowrap cursor-pointer font-medium"
                >
                  <i className="ri-printer-line mr-2"></i>
                  Imprimir Cupom
                </button>
                <button
                  onClick={handleEmitNFCe}
                  disabled={emittingNFCe}
                  className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition whitespace-nowrap cursor-pointer font-medium disabled:opacity-50"
                >
                  {emittingNFCe ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Emitindo...
                    </>
                  ) : (
                    <>
                      <i className="ri-file-text-line mr-2"></i>
                      Emitir NFC-e
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fechamento de Caixa */}
      {showCloseCashModal && currentCashRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Fechamento de Caixa</h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Abertura</p>
                  <p className="text-2xl font-bold text-gray-900">
                    R$ {currentCashRegister.opening_amount.toFixed(2)}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Vendas</p>
                  <p className="text-2xl font-bold text-orange-600">
                    R$ {currentCashRegister.total_sales.toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Dinheiro</p>
                  <p className="text-xl font-bold text-green-600">
                    R$ {currentCashRegister.total_cash.toFixed(2)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Cartão</p>
                  <p className="text-xl font-bold text-blue-600">
                    R$ {currentCashRegister.total_card.toFixed(2)}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg col-span-2">
                  <p className="text-sm text-gray-600 mb-1">PIX</p>
                  <p className="text-xl font-bold text-purple-600">
                    R$ {currentCashRegister.total_pix.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-orange-100 border-l-4 border-orange-600 p-4 rounded">
                <p className="text-sm text-gray-700 mb-1">Valor Esperado no Caixa</p>
                <p className="text-3xl font-bold text-orange-600">
                  R$ {(currentCashRegister.opening_amount + currentCashRegister.total_cash).toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Real no Caixa (R$) *
                </label>
                <input
                  type="number"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                  autoFocus
                />
              </div>

              {closingAmount && (
                <div className={`p-4 rounded-lg ${
                  parseFloat(closingAmount) === (currentCashRegister.opening_amount + currentCashRegister.total_cash)
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className="text-sm font-medium mb-1">
                    {parseFloat(closingAmount) === (currentCashRegister.opening_amount + currentCashRegister.total_cash)
                      ? '✓ Caixa Conferido'
                      : '⚠ Diferença no Caixa'}
                  </p>
                  <p className="text-lg font-bold">
                    {parseFloat(closingAmount) > (currentCashRegister.opening_amount + currentCashRegister.total_cash)
                      ? `+ R$ ${(parseFloat(closingAmount) - (currentCashRegister.opening_amount + currentCashRegister.total_cash)).toFixed(2)} (Sobra)`
                      : parseFloat(closingAmount) < (currentCashRegister.opening_amount + currentCashRegister.total_cash)
                      ? `- R$ ${((currentCashRegister.opening_amount + currentCashRegister.total_cash) - parseFloat(closingAmount)).toFixed(2)} (Falta)`
                      : 'Valores conferem'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  rows={3}
                  placeholder="Adicione observações sobre o fechamento..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCloseCashModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseCash}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition whitespace-nowrap cursor-pointer"
              >
                Fechar Caixa
              </button>
            </div>
          </div>
        </div>
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