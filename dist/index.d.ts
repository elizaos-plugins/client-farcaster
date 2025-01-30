declare const FarcasterClientInterface: {
    name: string;
    config: {};
    start: (runtime: any) => Promise<any>;
    stop: (runtime: any) => Promise<void>;
};

export { FarcasterClientInterface as default };
