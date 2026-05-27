import { useParams } from "react-router-dom";
import { ReelFeed } from "../components/reel/ReelFeed";

export function ReelsPage() {
  const { reelId } = useParams();
  return <ReelFeed detailId={reelId || ""} />;
}
