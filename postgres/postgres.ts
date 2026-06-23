import type { IDataStore, IObject, ITransaction } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import type { PoolClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";

export type { Pool, PoolClient };

export async function getInstance (config: IObject) : Promise<DataStore|void> {
    let hostname = '', database = '', username = '', password = '', port = 5432, poolSize = 3, tls = false;
    hostname = (config.settings as IObject).dbHostname as string;
    database = (config.settings as IObject).dbDatabase as string;
    username = (config.settings as IObject).dbUsername as string;
    password = (config.settings as IObject).dbPassword as string;
    port = ((config.settings as IObject).dbPort as number) || port;
    poolSize = ((config.settings as IObject).dbPoolSize as number) || poolSize;
    tls = ((config.settings as IObject).dbTLS as boolean) || tls;
    if (hostname && database && username && password) {
        try {
            const pool = new Pool({
                hostname,
                port,
                database,
                user: username,
                password,
                tls: { enabled: tls },
            }, poolSize, true);
            const client = await pool.connect();
            client.release();
            log.info('postgres: Client connection created.');
            return new DataStore(pool);
        }
        catch(e:any) {
            log.error(`postgres: Client connection failed.`, e.message);
        }
    }
    else log.error('postgres: One or more required parameters (dbHostname, dbDatabase, dbUsername, dbPassword) have not been set.');
}

class DataStore implements IDataStore {
    private pool:Pool;

    constructor(pool:Pool) {
        this.pool = pool;
    }

    async run (query:string, parameters:IObject|undefined, _config:IObject|undefined) : Promise<unknown> {
        const client = await this.pool.connect();
        try {
            return await client.queryObject(query, parameters || {});
        }
        finally {
            client.release();
        }
    }

    async readTransaction (fn:(tx:ITransaction) => Promise<unknown>, _config:IObject|undefined) : Promise<unknown> {
        return await this.transaction(fn);
    }

    async writeTransaction (fn:(tx:ITransaction) => Promise<unknown>, _config:IObject|undefined) : Promise<unknown> {
        return await this.transaction(fn);
    }

    private async transaction (fn:(tx:ITransaction) => Promise<unknown>) : Promise<unknown> {
        const client = await this.pool.connect();
        const tx = new Transaction(client);
        try {
            await client.queryObject('BEGIN');
            const result = await fn(tx);
            await tx.commit();
            return result;
        }
        catch(e) {
            await tx.rollback();
            throw e;
        }
        finally {
            client.release();
        }
    }
}

class Transaction implements ITransaction {
    private client:PoolClient;
    private completed = false;

    constructor(client:PoolClient) {
        this.client = client;
    }

    async run (query:string, parameters:IObject|undefined, _config:IObject|undefined) : Promise<unknown> {
        return await this.client.queryObject(query, parameters || {});
    }

    async commit () : Promise<void> {
        if (!this.completed) {
            await this.client.queryObject('COMMIT');
            this.completed = true;
        }
    }

    async rollback () : Promise<void> {
        if (!this.completed) {
            await this.client.queryObject('ROLLBACK');
            this.completed = true;
        }
    }
}
