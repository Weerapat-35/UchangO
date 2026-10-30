import { CheckinPanel } from "@/features/checkin/components/checkin-panel";

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CheckinPanel bookingId={id} />;
}
