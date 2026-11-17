// Regression check for cart/checkout thumbnails: a variant without its own images uses the product's image.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const { outputText } = ts.transpileModule(read('lib/api/cart.ts'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
})
const mod = { exports: {} }
new Function('exports', 'require', 'module', outputText)(
  mod.exports,
  (name) => (name === 'node-fetch' ? () => {} : require(name)),
  mod
)
const { getLineItemImage } = mod.exports

const jeansImage = {
  id: '18',
  type: 'image',
  attributes: {
    original_url: '/rails/active_storage/blue_jeans.jpeg',
    alt: 'Blue Jeans',
  },
}
const jeansProduct = {
  id: '132',
  type: 'product',
  relationships: { images: { data: [{ id: '18', type: 'image' }] } },
}

test('Blue Jeans size variant without images uses the product image', () => {
  const variant = {
    id: '252',
    relationships: {
      images: { data: [] },
      product: { data: { id: '132', type: 'product' } },
    },
  }
  assert.deepEqual(getLineItemImage(variant, [jeansProduct, jeansImage]), {
    url: '/services/backend/rails/active_storage/blue_jeans.jpeg',
    alt: 'Blue Jeans',
  })
})

test("a variant's own image wins over the product image", () => {
  const ownImage = {
    id: '7',
    type: 'image',
    attributes: {
      original_url: '/rails/active_storage/cool_bits.jpg',
      alt: 'Cool Bits',
    },
  }
  const variant = {
    id: '233',
    relationships: {
      images: { data: [{ id: '7', type: 'image' }] },
      product: { data: { id: '132', type: 'product' } },
    },
  }
  assert.equal(
    getLineItemImage(variant, [jeansProduct, jeansImage, ownImage]).url,
    '/services/backend/rails/active_storage/cool_bits.jpg'
  )
})

test('no image anywhere falls back to the placeholder (undefined)', () => {
  const variant = { id: '1', relationships: { images: { data: [] } } }
  assert.equal(getLineItemImage(variant, []), undefined)
})

test('every cart request includes the product images', () => {
  for (const file of [
    'lib/CartContext.tsx',
    'lib/api/checkout.ts',
    'components/checkout/context.tsx',
  ]) {
    const includes = read(file).match(/'line_items,[^']*'/g) || []
    assert.ok(includes.length > 0, file)
    for (const include of includes) {
      assert.ok(
        include.includes('variants.product.images'),
        `${file}: ${include}`
      )
    }
  }
})
