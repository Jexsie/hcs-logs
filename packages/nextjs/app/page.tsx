import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <div className="flex items-center flex-col grow pt-16 px-5">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold">hcs-logs</h1>
        <p className="text-base-content/70">
          Parcel and event records anchored on a Hedera Consensus Service topic. The verification UI lands in a later
          pass. Use the root scripts to submit and verify records.
        </p>
      </div>
    </div>
  );
};

export default Home;
