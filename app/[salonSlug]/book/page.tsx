import { redirect } from 'next/navigation'

export default async function BookIndex({
  params,
}: {
  params: Promise<{ salonSlug: string }>
}) {
  const { salonSlug } = await params
  redirect(`/${salonSlug}/book/service`)
}
