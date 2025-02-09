import { FarcasterClientInterface } from "./farcaster-client";

const farcasterPlugin = {
    name: "farcaster",
    description: "Farcaster client",
    clients: [FarcasterClientInterface],
};
export default farcasterPlugin;
