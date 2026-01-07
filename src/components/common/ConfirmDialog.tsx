import { useState, useEffect } from 'react';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}: ConfirmDialogProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleConfirm = () => {
    setIsVisible(false);
    setTimeout(onConfirm, 200);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(onCancel, 200);
  };

  const colors = {
    danger: {
      icon: 'ri-error-warning-line',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      icon: 'ri-alert-line',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700'
    },
    info: {
      icon: 'ri-information-line',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700'
    }
  };

  const style = colors[type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-200 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`${style.iconBg} rounded-full p-3 flex-shrink-0`}>
              <i className={`${style.icon} ${style.iconColor} text-2xl`}></i>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmação</h3>
              <p className="text-gray-600">{message}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-6 py-2.5 ${style.button} text-white rounded-lg transition cursor-pointer whitespace-nowrap font-medium`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
