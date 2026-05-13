import { redirect } from 'next/navigation'

export default async function OldPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { id } = await params
  const { type } = await searchParams
  redirect(`/print/orders/${id}?type=${type ?? 'bc'}`)
}
