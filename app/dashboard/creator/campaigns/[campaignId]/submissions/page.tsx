import { CreatorCampaignSubmissions } from "../../../../screens";
import { PageHeader } from "../../../../workspace-ui";
export default async function Page({
  params,
}: PageProps<"/dashboard/creator/campaigns/[campaignId]/submissions">) {
  const { campaignId } = await params;
  return (
    <>
      <PageHeader
        title="Campaign submissions"
        description="Review queue untuk campaign ini."
      />
      <CreatorCampaignSubmissions campaignId={campaignId} />
    </>
  );
}
