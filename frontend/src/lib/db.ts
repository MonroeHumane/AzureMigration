import { TableClient, AzureNamedKeyCredential, odata } from "@azure/data-tables";

// In Astro, environment variables are typically accessed via import.meta.env
// But on the server, process.env is also sometimes used if they were loaded via external scripts.
const accountName = import.meta.env.AZURE_TABLES_ACCOUNT_NAME || process.env.AZURE_TABLES_ACCOUNT_NAME || "";
const accountKey = import.meta.env.AZURE_TABLES_ACCOUNT_KEY || process.env.AZURE_TABLES_ACCOUNT_KEY || "";
const tableName = "GrantScoutTracker";

export function getTableClient() {
  if (!accountName || !accountKey) {
    console.warn("Missing Azure Table Storage credentials.");
  }
  
  const credential = new AzureNamedKeyCredential(accountName, accountKey);
  const tableUrl = `https://${accountName}.table.core.windows.net`;
  
  return new TableClient(tableUrl, tableName, credential);
}

export type GrantStatus = 'open' | 'watch' | 'applied' | 'skipped';

export interface GrantEntity {
  partitionKey: string;
  rowKey: string;
  title: string;
  source: string;
  open_url?: string;
  apply_url?: string;
  status: GrantStatus;
  deadline_notes?: string;
  fit_notes?: string;
}

export async function listGrants(): Promise<GrantEntity[]> {
  try {
    const client = getTableClient();
    const entities = client.listEntities<GrantEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'GRANT'` }
    });
    
    const grants: GrantEntity[] = [];
    for await (const entity of entities) {
      grants.push(entity);
    }
    return grants;
  } catch (error) {
    console.error("Failed to list grants from Azure Table Storage:", error);
    return [];
  }
}

export async function addGrant(grant: Omit<GrantEntity, "partitionKey" | "rowKey">) {
  const client = getTableClient();
  const newEntity: GrantEntity = {
    partitionKey: "GRANT",
    rowKey: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
    ...grant,
  };
  
  await client.createEntity(newEntity);
  return newEntity;
}
