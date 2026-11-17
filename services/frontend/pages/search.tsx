import type { GetServerSidePropsContext } from 'next'
import { ProductList } from '@components/product'
import { Page } from '@customTypes/page'
import { Product } from '@customTypes/product'

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_API_ROUTE
    ? `${process.env.NEXT_PUBLIC_FRONTEND_API_ROUTE}/api`
    : 'http://localhost:3000/api'
  const q = typeof context.query.q === 'string' ? context.query.q.trim() : ''

  const products = await fetch(
    `${baseUrl}/products${q ? `?name=${encodeURIComponent(q)}` : ''}`
  ).then((res) => res.json())
  const pages: Page[] = await fetch(`${baseUrl}/pages`).then((res) =>
    res.json()
  )
  const taxons = await fetch(`${baseUrl}/taxonomies`).then((res) => res.json())

  return {
    props: {
      products: Array.isArray(products) ? (products as Product[]) : [],
      pages,
      taxons,
    },
  }
}

export default ProductList
