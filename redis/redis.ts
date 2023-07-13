import type { ContextExtensionConfig, IUtils, ICache, IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.type.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";
import { connect, Redis } from "https://deno.land/x/redis@v0.29.2/mod.ts";

export async function getInstance (config: ContextExtensionConfig, utils: IUtils) : Promise<ICache|void> {
    let redisHost = '', redisPort = 0, redisPassword = '';
    redisHost = config.settings.redisHost as string;
    redisPort = config.settings.redisPort as number || 18386;
    redisPassword = (config.settings.redisPassword as IObject).value as string;
    if (redisHost && redisPassword) {
        try {
            if ((config.settings.redisPassword as IObject).encrypt) redisPassword = await utils.decrypt(redisPassword);
            const client = await connect({
                hostname: redisHost,
                port: redisPort,
                password: redisPassword,
            });
            log.info('Redis: Client connection created.');
            return new Cache(client, config.domain);
        }
        catch(e) {
            log.error(`Redis: Client connection failed.`, e.message);
        }
    }
    else log.error('Redis: One or more required parameters (redisHost, redisPort, redisPassword) have not been set.');
}

class Cache implements ICache {
    private cache: Redis;
    private keyPrefix;

    constructor(client: Redis, hostname:string) {
        this.cache = client;
        this.keyPrefix = hostname + '::';
    }

    get = async (key: string) : Promise<unknown> => {
        key = this.keyPrefix + key;
        let value = await this.cache.get(key);
        if (value) {
            const item = JSON.parse(value);
            if ((item.expires !== 0) && (Date.now() >= (item.expires as number))) {
                this.remove(key);
                value = null;
            }
            else value = JSON.parse(item.value);
        }
        return value;
    }

    set = async (key: string, value: unknown, expires?: number) : Promise<void> => {
        key = this.keyPrefix + key;
        value = JSON.stringify(value);
        expires = (typeof expires == 'number' && expires > 0) ? Date.now() + (expires * 1000) : 0;
        await this.cache.set(key, JSON.stringify({ value, expires }));
    }

    setExpires = async (key: string, expires?: number) : Promise<unknown> => {
        key = this.keyPrefix + key;
        const value = await this.get(key);
        if (value) this.set(key, value, expires);
        return value;
    }

    remove = async (key: string) : Promise<void> => {
        key = this.keyPrefix + key;
        await this.cache.del(key);
    }
}
