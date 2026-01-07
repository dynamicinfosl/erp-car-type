import { useState } from 'react';

interface StockAlertDialogProps {
  productName: string;
  currentStock: number;
  requestedQuantity: number;
  onAddStock: (quantity: number) => void;
  onCancel: () => void;
}

export default function StockAlertDialog({
  productName,
  currentStock,
  requestedQuantity,
  onAddStock,
  onCancel,
}: StockAlertDialogProps) {
  const [stockToAdd, setStockToAdd] = useState(requestedQuantity - currentStock);

  const handleConfirm = () => {
    if (stockToAdd > 0) {
      onAddStock(stockToAdd);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mx-auto mb-4">
            <i className="ri-alert-line text-3xl text-orange-600"></i>
          </div>

          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
            Estoque Insuficiente
          </h3>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Produto:</span>
                <span className="font-medium text-gray-900">{productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estoque Atual:</span>
                <span className="font-medium text-red-600">{currentStock} unidades</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quantidade Solicitada:</span>
                <span className="font-medium text-gray-900">{requestedQuantity} unidades</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-600">Faltam:</span>
                <span className="font-bold text-orange-600">{requestedQuantity - currentStock} unidades</span>
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-center mb-6">
            Deseja adicionar estoque agora para continuar com a venda?
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantidade a Adicionar no Estoque
            </label>
            <input
              type="number"
              min={requestedQuantity - currentStock}
              value={stockToAdd}
              onChange={(e) => setStockToAdd(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-center text-lg font-semibold"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Estoque após adição: {currentStock + stockToAdd} unidades
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={stockToAdd < (requestedQuantity - currentStock)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition cursor-pointer whitespace-nowrap font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-add-line mr-2"></i>
              Adicionar Estoque
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
