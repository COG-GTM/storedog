// Regression check for discount code feedback: every outcome must give the shopper a message.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const source = fs.readFileSync(
  path.join(__dirname, '..', 'lib/discounts.ts'),
  'utf8'
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
})
const mod = { exports: {} }
new Function('exports', 'require', 'module', outputText)(
  mod.exports,
  require,
  mod
)
const { redeemDiscountCode } = mod.exports

const response = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

function setup({ discount, coupon }) {
  const calls = { urls: [], coupons: [] }
  const options = {
    discountsPath: '/services/discounts',
    fetch: async (url) => {
      calls.urls.push(url)
      return discount()
    },
    applyCoupon: async (code) => {
      calls.coupons.push(code)
      return coupon
    },
  }
  return { calls, options }
}

test('unknown code shows an error and does not touch the cart', async () => {
  const { calls, options } = setup({
    discount: response(404, { error: 'Discount not found', status: 0 }),
  })
  const result = await redeemDiscountCode('notacode', options)

  assert.deepEqual(result, {
    ok: false,
    message: "NOTACODE isn't a valid discount code.",
  })
  assert.deepEqual(calls.urls, [
    '/services/discounts/discount-code?discount_code=NOTACODE',
  ])
  assert.deepEqual(calls.coupons, [])
})

test('valid code applies FREESHIP in Spree and confirms it', async () => {
  const { calls, options } = setup({
    discount: response(200, {
      code: 'BFRIDAY',
      name: 'Black Friday',
      status: 1,
    }),
    coupon: { id: '1' },
  })
  const result = await redeemDiscountCode(' bfriday ', options)

  assert.deepEqual(result, {
    ok: true,
    message: 'BFRIDAY applied: free shipping.',
  })
  assert.deepEqual(calls.coupons, ['FREESHIP'])
})

test('Spree rejecting the coupon is shown to the shopper', async () => {
  const { options } = setup({
    discount: response(200, { code: 'BFRIDAY', status: 1 }),
    coupon: { error: 'The coupon code has already been applied to this order' },
  })
  const result = await redeemDiscountCode('BFRIDAY', options)

  assert.deepEqual(result, {
    ok: false,
    message:
      "BFRIDAY couldn't be applied. The coupon code has already been applied to this order",
  })
})

test('discounts service errors and empty input give feedback', async () => {
  const broken = setup({
    discount: response(500, { error: 'Discount service error' }),
  })
  assert.deepEqual(await redeemDiscountCode('PARTY', broken.options), {
    ok: false,
    message: "Couldn't check that code. Please try again.",
  })

  const empty = setup({ discount: response(200, {}) })
  assert.deepEqual(await redeemDiscountCode('  ', empty.options), {
    ok: false,
    message: 'Enter a discount code.',
  })
  assert.deepEqual(empty.calls.urls, [])
})
