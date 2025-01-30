import { FarcasterAgentClient } from './farcaster-agent-client';

const FarcasterClientInterface = {
    name: 'farcaster',
    config: {},
    start: async (runtime: any) => {
        const farcasterAgentClient = new FarcasterAgentClient(runtime);
        await farcasterAgentClient.start();
        return farcasterAgentClient as any;
    },
    stop: async (runtime: any) => {
        try {
            // stop it
            console.log("Stopping farcaster client", runtime.agentId);
            await runtime.clients.farcaster.stop();
        } catch (e) {
            console.error("client-farcaster interface stop error", e);
        }
    },
};
export default FarcasterClientInterface;