import React from "react";
import { WalletButton } from "./WalletButton";
import { DashboardLink } from "./DashboardLink";

import "./ConnectAccount.css";

const ConnectAccount: React.FC = () => {
  return (
    <div className="connect-account-container">
      <DashboardLink />
      <WalletButton />
      {/* {stellarNetwork !== "PUBLIC" && <FundAccountButton />} */}
      {/* <NetworkPill /> */}
    </div>
  );
};

export default ConnectAccount;
