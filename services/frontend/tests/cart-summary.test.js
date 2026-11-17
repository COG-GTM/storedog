// Regression check for cart/checkout totals: tax, shipping and discount lines must add up to the total.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

function loadTs(file, stubs = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
  })
  const module = { exports: {} }
  const requireStub = (name) => (name in stubs ? stubs[name] : require(name))
  new Function('exports', 'require', 'module', outputText)(
    module.exports,
    requireStub,
    module
  )
  return module.exports
}

const { formatCart } = loadTs('lib/api/cart.ts', { 'node-fetch': () => {} })
const { getCartSummary } = loadTs('lib/cartSummary.ts')
const { formatPrice } = loadTs('lib/hooks/usePrice.tsx', {
  react: { useMemo: (f) => f() },
})

// Spree storefront cart for Blue Jeans x2 + Cool Bits, shipped to California
// with the FREESHIP promotion: 10% CA tax and a $5 shipment cancelled by the promo.
const spreeCart = (attributes) => ({
  data: {
    id: '1',
    attributes: {
      token: 't',
      currency: 'USD',
      created_at: '2026-11-17T00:00:00Z',
      email: 'a@example.com',
      included_tax_total: '0.0',
      ...attributes,
    },
    relationships: { line_items: { data: [] } },
  },
  included: [],
})

const usd = (amount) =>
  formatPrice({ amount, currencyCode: 'USD', locale: 'en-US' })
const rendered = (cart) => {
  const { lines, total } = getCartSummary(cart)
  return {
    lines: Object.fromEntries(
      lines.map(({ label, amount }) => [
        label,
        amount === null ? null : usd(amount),
      ])
    ),
    sum: lines.reduce((acc, { amount }) => acc + (amount || 0), 0),
    total,
  }
}

test('delivery-state cart shows the tax, shipping and discount that make up the total', () => {
  const cart = formatCart(
    spreeCart({
      state: 'delivery',
      item_total: '149.89',
      ship_total: '5.0',
      additional_tax_total: '12.99',
      promo_total: '-5.0',
      total: '162.88',
    })
  )
  const { lines, sum, total } = rendered(cart)

  assert.deepEqual(lines, {
    Subtotal: '$149.89',
    Discount: '-$5.00',
    Taxes: '$12.99',
    Shipping: '$5.00',
  })
  assert.equal(usd(total), '$162.88')
  assert.equal(sum.toFixed(2), total.toFixed(2))
})

test('cart before the address step defers tax and shipping and its total is the subtotal', () => {
  const cart = formatCart(
    spreeCart({
      state: 'cart',
      item_total: '149.89',
      ship_total: '0.0',
      additional_tax_total: '0.0',
      promo_total: '0.0',
      total: '149.89',
    })
  )
  const { lines, sum, total } = rendered(cart)

  assert.deepEqual(lines, {
    Subtotal: '$149.89',
    Taxes: null,
    Shipping: null,
  })
  assert.equal(sum.toFixed(2), total.toFixed(2))
})

test('address-state cart shows tax but defers shipping until a rate is selected', () => {
  const cart = formatCart(
    spreeCart({
      state: 'address',
      item_total: '129.9',
      ship_total: '0.0',
      additional_tax_total: '12.99',
      promo_total: '0.0',
      total: '142.89',
    })
  )
  const { lines, sum, total } = rendered(cart)

  assert.deepEqual(lines, {
    Subtotal: '$129.90',
    Taxes: '$12.99',
    Shipping: null,
  })
  assert.equal(sum.toFixed(2), total.toFixed(2))
})
