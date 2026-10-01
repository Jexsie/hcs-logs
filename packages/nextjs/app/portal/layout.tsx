import { getMetadata } from "~~/utils/scaffold-hbar/getMetadata";

export const metadata = getMetadata({
  title: "Member portal",
  description: "Indiana Group members submit parcel and event records, approved in their wallet.",
});

const PortalLayout = ({ children }: { children: React.ReactNode }) => children;

export default PortalLayout;
