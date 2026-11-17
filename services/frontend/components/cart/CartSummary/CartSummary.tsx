import { FC } from 'react'
import { Cart } from '@customTypes/cart'
import { formatPrice } from '@lib/hooks/usePrice'
import { getCartSummary } from '@lib/cartSummary'

const CartSummary: FC<{ cart: Cart }> = ({ cart }) => {
  const { lines, total } = getCartSummary(cart)
  const format = (amount: number) =>
    formatPrice({ amount, currencyCode: cart.currency.code, locale: 'en-US' })

  return (
    <>
      <ul className="pb-2">
        {lines.map(({ label, amount }) => (
          <li key={label} className="flex justify-between py-1">
            <span>{label}</span>
            <span
              className={amount === null ? '' : 'font-bold tracking-wide'}
              id={label === 'Shipping' ? 'shipping-rate' : undefined}
            >
              {amount === null ? 'Calculated at checkout' : format(amount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-accent-2 py-3 font-bold mb-2">
        <span>Total</span>
        <span>{format(total)}</span>
      </div>
    </>
  )
}

export default CartSummary
