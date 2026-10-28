import { ServicesListing } from "@/features/services/components/services-listing";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <ServicesListing initialCategory={category} />;
}
