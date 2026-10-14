import { CampaignDetail } from "../../../screens";
export default async function Page({
  params,
}: PageProps<"/dashboard/creator/campaigns/[campaignId]">) {
  const { campaignId } = await params;
  return <CampaignDetail id={campaignId} creator />;
}
