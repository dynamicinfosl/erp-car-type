import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: 'ri-checkbox-circle-line',
    error: 'ri-error-warning-line',
    info: 'ri-information-line',
    warning: 'ri-alert-line',
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-orange-500',
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slide-in">
      <div className={`${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`}>
        <i className={`${icons[type]} text-2xl`}></i>
        <p className="flex-1 font-medium">{message}</p>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition cursor-pointer"
        >
          <i className="ri-close-line text-xl"></i>
        </button>
      </div>
    </div>
  );
}
