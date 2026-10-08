// Site settings. One place for the contract address, the name and the tagline.
//
// DEMO_CONTRACT is the deployed copy the site reads when NEXT_PUBLIC_CONTRACT is unset. It is
// filled in once the contract is deployed; while both are empty every page says the contract is
// not deployed yet, and the whole site still works with NEXT_PUBLIC_MOCK=1.
export const DEMO_CONTRACT: string = "0x4466DcbaDDdde74f1e1512f2a471F82828a3d189";

export const SITE_NAME = "Deposit Back";
export const SITE_TAGLINE = "Your rental deposit comes back item by item.";
export const SITE_LINE =
  "A rental deposit comes back item by item: validators read each deduction against the move-in and move-out notes and decide whether it is damage or ordinary wear.";

/** The public source repository; the footer link is hidden while this is empty. */
export const REPO_URL: string = "https://github.com/hossein6191/deposit-back";

/** The contract in use: the deploy's environment first, then the committed address. */
export const contractAddress = (): string => process.env.NEXT_PUBLIC_CONTRACT || DEMO_CONTRACT || "";
