// Regression check for search: the header renders the search box and /search queries Spree by name.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

const { outputText } = ts.transpileModule(read('lib/api/products.ts'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
})
const mod = { exports: {} }
const stubs = { 'node-fetch': () => {} }
new Function('exports', 'require', 'module', outputText)(
  mod.exports,
  (name) => (name in stubs ? stubs[name] : require(name)),
  mod
)
const { buildProductsUrl } = mod.exports

test('product search adds an encoded Spree name filter', () => {
  const url = buildProductsUrl('http://api', {
    include: 'images',
    name: 'cool bits&',
  })
  assert.match(url, /^http:\/\/api\/storefront\/products\?/)
  assert.ok(url.includes('filter[name]=cool%20bits%26'), url)
})

test('product listing without a query has no name filter', () => {
  assert.ok(
    !buildProductsUrl('http://api', { include: 'images' }).includes(
      'filter[name]'
    )
  )
})

test('the header renders the search box on desktop and phones', () => {
  const navbar = read('components/common/Navbar/Navbar.tsx')
  assert.match(navbar, /<Searchbar className="hidden md:flex"/)
  assert.match(navbar, /md:hidden">\s*<Searchbar id="mobile-search"/)
})

test('/search exists and forwards q to the products API as name', () => {
  const page = read('pages/search.tsx')
  assert.match(page, /getServerSideProps/)
  assert.match(page, /\?name=\$\{encodeURIComponent\(q\)\}/)
  assert.match(page, /cardVersion: flag \? 'v2' : 'v1'/)
})
