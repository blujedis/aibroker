import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmtCurrency(n: number, max = 4): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max })}`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString();
}

export function fmtDateTime(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString();
}
