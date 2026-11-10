import {
  Baby, Banknote, Briefcase, Bus, Car, Coffee, Coins, CreditCard, Dumbbell, Gamepad2, Gift, GraduationCap, HeartPulse, Home,
  Landmark, Laptop, type LucideIcon, Package, PawPrint, Phone, Plane, Receipt, Repeat, Shield, Shirt, ShoppingCart, Smartphone,
  Sparkles, Tv, Utensils, Wifi, Wrench, Zap,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  home: Home, car: Car, bus: Bus, shield: Shield, repeat: Repeat, tv: Tv, landmark: Landmark, card: CreditCard, cart: ShoppingCart,
  utensils: Utensils, coffee: Coffee, game: Gamepad2, heart: HeartPulse, dumbbell: Dumbbell, package: Package, briefcase: Briefcase,
  coins: Coins, banknote: Banknote, phone: Phone, smartphone: Smartphone, wifi: Wifi, zap: Zap, plane: Plane, gift: Gift,
  shirt: Shirt, baby: Baby, paw: PawPrint, school: GraduationCap, laptop: Laptop, wrench: Wrench, receipt: Receipt, sparkles: Sparkles,
};

export const iconFor = (key: string): LucideIcon => ICONS[key] ?? Package;

export const COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b', '#8b5cf6'];
