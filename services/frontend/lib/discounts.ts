export type DiscountResult = { ok: boolean; message: string }

type RedeemOptions = {
  discountsPath: string
  fetch: (
    url: string
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>
  applyCoupon: (couponCode: string) => Promise<any>
}

// Spree only has the FREESHIP promotion set up, so every valid discounts-service code applies it.
export const SPREE_COUPON_CODE = 'FREESHIP'

export async function redeemDiscountCode(
  input: string,
  { discountsPath, fetch, applyCoupon }: RedeemOptions
): Promise<DiscountResult> {
  const code = input.trim().toUpperCase()
  if (!code) {
    return { ok: false, message: 'Enter a discount code.' }
  }

  let res
  try {
    res = await fetch(
      `${discountsPath}/discount-code?discount_code=${encodeURIComponent(code)}`
    )
  } catch {
    return { ok: false, message: "Couldn't check that code. Please try again." }
  }

  if (res.status === 404) {
    return { ok: false, message: `${code} isn't a valid discount code.` }
  }
  const discount = await res.json().catch(() => null)
  if (!res.ok || !discount || discount.error) {
    return { ok: false, message: "Couldn't check that code. Please try again." }
  }

  const cart = await applyCoupon(SPREE_COUPON_CODE)
  if (!cart?.id) {
    const reason = typeof cart?.error === 'string' ? ` ${cart.error}` : ''
    return { ok: false, message: `${code} couldn't be applied.${reason}` }
  }

  return { ok: true, message: `${code} applied: free shipping.` }
}
