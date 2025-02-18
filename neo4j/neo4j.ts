import type { IDataStore, IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import type { Driver, Session, Transaction, Result, QueryResult } from "https://deno.land/x/neo4j_lite_client@4.4.1-preview2/mod.ts";    
import neo4j from "https://deno.land/x/neo4j_lite_client@4.4.1-preview2/mod.ts";    
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";

export type { Result, Session, QueryResult };

export async function getInstance (config: IObject) : Promise<DataStore|void> {
    let hostname = '', database = '', username = '', password = '';
    hostname = (config.settings as IObject).dbHostname as string;
    database = (config.settings as IObject).dbDatabase as string;
    username = (config.settings as IObject).dbUsername as string;
    password = (config.settings as IObject).dbPassword as string;
    if (hostname && database && username && password) {
        try {
            const authToken = neo4j.auth.basic(username, password);
            const driver = neo4j.driver(hostname, authToken);
            await driver.verifyConnectivity();
            log.info('neo4j: Client connection created.');
            return new DataStore(driver, database);
        }
        catch(e) {
            log.error(`neo4j: Client connection failed.`, e.message);
        }
    }
    else log.error('neo4j: One or more required parameters (dbHostname, dbDatabase, dbUsername, dbPassword) have not been set.');
}

class DataStore implements IDataStore {
    private database:string;
    private driver:Driver;

    constructor(driver:Driver, database:string) {
        this.driver = driver;
        this.database = database;
    }

    async run (query:string, parameters:Record<string, unknown>|undefined, config:Record<string, unknown>|undefined) : Promise<unknown> {
        const database = (this.database || ((config && config.database) ? config.database : '')) as string;
        const session = this.driver.session({ database })
        const result =  await session.run(query, parameters, config);
        session.close();
        return result;
    }

    async readTransaction (fn:(tx:Transaction) => Promise<unknown>, config:Record<string, unknown>|undefined) : Promise<unknown> {
        const database = (this.database || ((config && config.database) ? config.database : '')) as string;
        const session = this.driver.session({ database });
        const result = await session.readTransaction(fn);
        session.close();
        return result;
    }

    async writeTransaction (fn:(tx:Transaction) => Promise<unknown>, config:Record<string, unknown>|undefined) : Promise<unknown> {
        const database = (this.database || ((config && config.database) ? config.database : '')) as string;
        const session = this.driver.session({ database });
        const result = await session.writeTransaction(fn);
        session.close();
        return result;
    }
}
