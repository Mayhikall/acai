import { SubmissionDetail } from "../../../screens";
export default async function Page({
  params,
}: PageProps<"/dashboard/creator/reviews/[submissionId]">) {
  const { submissionId } = await params;
  return <SubmissionDetail id={submissionId} creator />;
}
