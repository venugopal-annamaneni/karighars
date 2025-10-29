import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export const UIFriendly = (text) => {
  return text.replace('_', ' ')        // turn project_manager → project manager
    .replace(/\b\w/g, c => c.toUpperCase())
};

export const getCategoryIcon = (categoryId) => {
  const iconMap = {
    'woodwork': '🪵',
    'misc': '🔧',
    'shopping': '🛒',
    'civil': '🏗️',
    'default': '📦'
  };
  return iconMap[categoryId?.toLowerCase()] || iconMap['default'];
};