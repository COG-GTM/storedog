import { Cart } from '@customTypes/cart'

export type CartSummaryLine = {
  label: string
  amount: number | null
}

// Spree only knows tax after the address step and shipping after the delivery step.
const PRE_ADDRESS_STATES = ['cart']
const PRE_DELIVERY_STATES = ['cart', 'address']

export function getCartSummary(cart: Cart): {
  lines: CartSummaryLine[]
  total: number
} {
  const lines: CartSummaryLine[] = [
    { label: 'Subtotal', amount: cart.subtotalPrice },
  ]

  if (cart.promoTotal) {
    lines.push({ label: 'Discount', amount: cart.promoTotal })
  }

  lines.push({
    label: 'Taxes',
    amount: PRE_ADDRESS_STATES.includes(cart.state) ? null : cart.taxTotal,
  })
  lines.push({
    label: 'Shipping',
    amount: PRE_DELIVERY_STATES.includes(cart.state) ? null : cart.shipTotal,
  })

  return { lines, total: cart.totalPrice }
}
