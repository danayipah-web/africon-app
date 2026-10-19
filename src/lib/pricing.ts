import type { DiscountCode, EventItem, PaymentMethod, PaymentStatus } from '@/domain/types';

export interface PriceQuote {
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  discountLabel: string;
  total: number;
  isFree: boolean;
}

/** Unit price for an event, honouring a session price override on the chosen date. */
export function unitPriceFor(event: Pick<EventItem, 'price' | 'dates'>, eventDateId?: string | null) {
  const d = eventDateId ? event.dates.find((x) => x.id === eventDateId) : undefined;
  return d?.sessionPrice ?? event.price;
}

export function findDiscount(codes: DiscountCode[], code: string): DiscountCode | null {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  return codes.find((d) => d.active && d.code.toUpperCase() === c) ?? null;
}

/** Total = price × attendees − discount, never below zero (spec §5.6). */
export function quote(
  event: Pick<EventItem, 'price' | 'dates' | 'options'>,
  attendees: number,
  eventDateId?: string | null,
  discount?: DiscountCode | null,
): PriceQuote {
  const unitPrice = unitPriceFor(event, eventDateId);
  const qty = Math.max(1, Math.floor(attendees || 1));
  const subtotal = round2(unitPrice * qty);
  let discountAmount = 0;
  if (discount && subtotal > 0 && event.options.allowDiscounts) {
    discountAmount = discount.type === 'percent' ? (subtotal * discount.value) / 100 : discount.value;
    discountAmount = round2(Math.min(discountAmount, subtotal));
  }
  const total = round2(subtotal - discountAmount);
  return {
    unitPrice,
    subtotal,
    discountAmount,
    discountLabel: discountAmount > 0 && discount ? discount.label : '',
    total,
    isFree: unitPrice === 0,
  };
}

/** Free events force payment status "not_required" and method "free". */
export function enforceFreeEvent(
  isFree: boolean,
  paymentStatus: PaymentStatus,
  paymentMethod: PaymentMethod,
): { paymentStatus: PaymentStatus; paymentMethod: PaymentMethod } {
  if (isFree) return { paymentStatus: 'not_required', paymentMethod: 'free' };
  return { paymentStatus, paymentMethod };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
