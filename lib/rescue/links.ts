/**
 * Official links only. A hard-coded allowlist: nothing a user or a project page
 * supplies is ever linked from the rescue plan.
 *
 * Verified 19–20 Nov 2026:
 *  - explorer approval checkers: listed on each explorer's own domain (search
 *    index of etherscan.io, bscscan.com, basescan.org, arbiscan.io,
 *    optimistic.etherscan.io; Etherscan's guide at info.etherscan.com/tokenapprovals/).
 *    The pages themselves sit behind a bot check, so they were not fetched.
 *  - wallet help centres, IC3 and exchange support pages: HTTP 200 on the URL below.
 * Polygon's main-chain checker couldn't be confirmed, so Polygon gets the
 * generic wallet steps instead of a link.
 */
export interface OfficialLink {
  label: string;
  url: string;
  note?: string;
}

/** Chain (as used for DEX lookups) → its explorer's own token-approval checker. */
export const REVOKE_CHECKERS: Record<string, OfficialLink> = {
  ethereum: { label: "Etherscan Token Approval Checker", url: "https://etherscan.io/tokenapprovalchecker" },
  bsc: { label: "BscScan Token Approval Checker", url: "https://bscscan.com/tokenapprovalchecker" },
  base: { label: "BaseScan Token Approval Checker", url: "https://basescan.org/tokenapprovalchecker" },
  arbitrum: { label: "Arbiscan Token Approval Checker", url: "https://arbiscan.io/tokenapprovalchecker" },
  optimism: { label: "Optimism Etherscan Token Approval Checker", url: "https://optimistic.etherscan.io/tokenapprovalchecker" },
};

export const REVOKE_GUIDE: OfficialLink = { label: "Etherscan's guide to token approvals", url: "https://info.etherscan.com/tokenapprovals/" };

export const WALLET_HELP: OfficialLink[] = [
  { label: "MetaMask Support", url: "https://support.metamask.com/" },
  { label: "Phantom Help Center", url: "https://help.phantom.com/" },
  { label: "Trust Wallet Help Center", url: "https://help.trustwallet.com/" },
];

export const IC3: OfficialLink = { label: "FBI Internet Crime Complaint Center (IC3)", url: "https://www.ic3.gov/", note: "For people in the United States." };

export const EXCHANGE_SUPPORT: OfficialLink[] = [
  { label: "Binance Support", url: "https://www.binance.com/en/support" },
  { label: "Coinbase Help", url: "https://help.coinbase.com/en" },
  { label: "Kraken Support", url: "https://support.kraken.com/" },
  { label: "OKX Help Center", url: "https://www.okx.com/help" },
  { label: "Bybit Help Center", url: "https://www.bybit.com/en/help-center" },
];

const ALL: OfficialLink[] = [...Object.values(REVOKE_CHECKERS), REVOKE_GUIDE, ...WALLET_HELP, IC3, ...EXCHANGE_SUPPORT];

/** True only for URLs on the allowlist (exact match). Used by tests and as a guard. */
export function isOfficial(url: string): boolean {
  return ALL.some((l) => l.url === url);
}

export function revokeCheckerFor(chain: string | null | undefined): OfficialLink | null {
  return chain ? REVOKE_CHECKERS[chain] ?? null : null;
}

export const SCAM_SHIELD = "Anyone who guarantees to recover your crypto for an upfront fee is running a scam. Real authorities never charge recovery fees.";
