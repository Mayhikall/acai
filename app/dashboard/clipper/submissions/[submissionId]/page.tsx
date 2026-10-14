import { SubmissionDetail } from "../../../screens";
export default async function Page({
  params,
}: PageProps<"/dashboard/clipper/submissions/[submissionId]">) {
  const { submissionId } = await params;
  return <SubmissionDetail id={submissionId} />;
}
