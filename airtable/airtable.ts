/*
    Reference Material:
        https://developer.Airtable.com/document-services/docs/overview/pdf-services-api/
*/

import type { IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";

export function getInstance (config: IObject) : AirtableClient|undefined {
    let apiKey = '', baseId  = '';
    apiKey = (config.settings as IObject).apiKey as string;
    baseId = (config.settings as IObject).baseId as string;
    if (apiKey && baseId) {
        try {
            const airtableClient = new AirtableClient(apiKey, baseId); 
            log.info('Airtable: Client connection created.');
            return airtableClient;
        }
        catch(e) {
            log.error(`Airtable: Client connection failed.`, e);
        }
    }
    else log.error('Airtable: One or more required parameters (apiKey, baseId) have not been set.');
}

class AirtableClient {
    private apiKey: string;
    private baseId: string;
    private baseUrl: string;
    private headers: Record<string, string>;
    constructor(apiKey: string, baseId: string) {
      this.apiKey = apiKey;
      this.baseId = baseId;
      this.baseUrl = `https://api.airtable.com/v0/${baseId}`;
      this.headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };
    }
  
    // Fetch records from a table
    async listRecords(tableName: string, options:IObject = {}) {
      const queryParams = new URLSearchParams();
      
      if (options.maxRecords) {
        queryParams.append('maxRecords', options.maxRecords as string);
      }
      if (options.view) {
        queryParams.append('view', options.view as string);
      }
      if (options.filterByFormula) {
        queryParams.append('filterByFormula', options.filterByFormula as string);
      }
      if (options.sort) {
        queryParams.append('sort', JSON.stringify(options.sort));
      }
  
      const url = `${this.baseUrl}/${tableName}?${queryParams.toString()}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              `Airtable API Error:
               Status: ${response.status}
               Type: ${errorData.error?.type || 'Unknown'}
               Message: ${errorData.error?.message || 'No error message provided'}
               Details: ${JSON.stringify(errorData.error?.details || {})}`
            );  
        }      
        
        const data = await response.json();
        return data.records;
      } catch (error) {
        console.error('Error fetching records:', error);
        throw error;
      }
    }
  
    // Create a new record
    async createRecord(tableName: string, fields: IObject) {
      const url = `${this.baseUrl}/${tableName}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ fields })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              `Airtable API Error:
               Status: ${response.status}
               Type: ${errorData.error?.type || 'Unknown'}
               Message: ${errorData.error?.message || 'No error message provided'}
               Details: ${JSON.stringify(errorData.error?.details || {})}`
            );  
        }      
        return await response.json();
      } catch (error) {
        console.error('Error creating record:', error);
        throw error;
      }
    }
  
    // Update an existing record
    async updateRecord(tableName: string, recordId: string, fields: IObject) {
      const url = `${this.baseUrl}/${tableName}/${recordId}`;
      
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({ fields })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              `Airtable API Error:
               Status: ${response.status}
               Type: ${errorData.error?.type || 'Unknown'}
               Message: ${errorData.error?.message || 'No error message provided'}
               Details: ${JSON.stringify(errorData.error?.details || {})}`
            );  
        }      
        
        return await response.json();
      } catch (error) {
        console.error('Error updating record:', error);
        throw error;
      }
    }
  
    // Delete a record
    async deleteRecord(tableName: string, recordId: string) {
      const url = `${this.baseUrl}/${tableName}/${recordId}`;
      
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: this.headers
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              `Airtable API Error:
               Status: ${response.status}
               Type: ${errorData.error?.type || 'Unknown'}
               Message: ${errorData.error?.message || 'No error message provided'}
               Details: ${JSON.stringify(errorData.error?.details || {})}`
            );  
        }      
        
        return await response.json();
      } catch (error) {
        console.error('Error deleting record:', error);
        throw error;
      }
    }
  
    // Fetch a single record by ID
    async getRecord(tableName: string, recordId: string) {
      const url = `${this.baseUrl}/${tableName}/${recordId}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              `Airtable API Error:
               Status: ${response.status}
               Type: ${errorData.error?.type || 'Unknown'}
               Message: ${errorData.error?.message || 'No error message provided'}
               Details: ${JSON.stringify(errorData.error?.details || {})}`
            );  
        }      
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching record:', error);
        throw error;
      }
    }
  }
  
  // Example usage:
  /*
  const airtable = new AirtableClient('your-api-key', 'your-base-id');
  
  // List records
  const records = await airtable.listRecords('Table Name', {
    maxRecords: 100,
    view: 'Grid view',
    filterByFormula: "AND({Status}='Active', {Category}='Tech')",
    sort: [{ field: 'Name', direction: 'asc' }]
  });
  
  // Create a record
  const newRecord = await airtable.createRecord('Table Name', {
    Name: 'John Doe',
    Email: 'john@example.com'
  });
  
  // Update a record
  const updatedRecord = await airtable.updateRecord('Table Name', 'rec123', {
    Status: 'Inactive'
  });
  
  // Delete a record
  await airtable.deleteRecord('Table Name', 'rec123');
  
  // Get a single record
  const record = await airtable.getRecord('Table Name', 'rec123');
  */