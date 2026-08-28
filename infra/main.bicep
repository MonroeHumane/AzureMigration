// ==============================================================================
// Azure Infrastructure as Code - Monroe County Humane Society Platform
// ==============================================================================

@description('Primary location for all Azure resources')
param location string = resourceGroup().location

@description('Environment prefix (e.g. prod, staging)')
param environmentName string = 'prod'

@description('Administrator login name for MySQL Flexible Server')
param mysqlAdminUser string = 'monroeadmin'

@secure()
@description('Administrator password for MySQL Flexible Server')
param mysqlAdminPassword string

@secure()
@description('Directus Admin Password')
param directusAdminPassword string

@secure()
@description('Directus KEY (data encryption key)')
param directusKey string

@secure()
@description('Directus SECRET (session/JWT signing secret)')
param directusSecret string

@secure()
@description('Static access token for the PetSync service account (Directus user, not the admin account)')
param petsyncDirectusToken string

@secure()
@description('Petango authkey used by the PetSync job to query the shelter feed directly')
param petangoAuthkey string

var suffix = uniqueString(resourceGroup().id)
var storageAccountName = 'mchsstorage${suffix}'
var containerAppEnvName = 'mchs-aca-env-${environmentName}'
var mysqlServerName = 'mchs-mysql-${suffix}'
var swaName = 'mchs-frontend-${environmentName}'

// 1. Azure Blob Storage (Directus uploads & media)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: [
            'https://monroe-humane.org'
            'https://*.azurestaticapps.net'
            'http://localhost:*'
          ]
          allowedMethods: [
            'GET'
            'HEAD'
            'OPTIONS'
          ]
          allowedHeaders: [
            '*'
          ]
          exposedHeaders: [
            '*'
          ]
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource directusContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'directus-uploads'
  properties: {
    publicAccess: 'Blob'
  }
}

resource petPhotosContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'pet-photos'
  properties: {
    publicAccess: 'Blob'
  }
}

// 2. Azure Database for MySQL Flexible Server
resource mysqlServer 'Microsoft.DBforMySQL/flexibleServers@2023-12-30' = {
  name: mysqlServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: mysqlAdminUser
    administratorLoginPassword: mysqlAdminPassword
    version: '8.0.21'
    storage: {
      storageSizeGB: 20
      iops: 360
      autoGrow: 'Enabled'
    }
  }
}

resource mysqlAllowAllAzureIPs 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2023-12-30' = {
  parent: mysqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource directusDb 'Microsoft.DBforMySQL/flexibleServers/databases@2023-12-30' = {
  parent: mysqlServer
  name: 'directus_db'
  properties: {
    charset: 'utf8mb4'
    collation: 'utf8mb4_unicode_ci'
  }
}

resource arcadeDb 'Microsoft.DBforMySQL/flexibleServers/databases@2023-12-30' = {
  parent: mysqlServer
  name: 'arcade_db'
  properties: {
    charset: 'utf8mb4'
    collation: 'utf8mb4_unicode_ci'
  }
}

// 3. Azure Container Apps Environment (Serverless Managed)
resource acaEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    zoneRedundant: false
  }
}

// 4. Container App: Directus Headless CMS
resource directusApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'mchs-directus'
  location: location
  properties: {
    managedEnvironmentId: acaEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8055
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'directus'
          image: 'ghcr.io/monroehumane/monroe-humane-directus:latest'
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
          env: [
            { name: 'DB_CLIENT', value: 'mysql' }
            { name: 'DB_HOST', value: mysqlServer.properties.fullyQualifiedDomainName }
            { name: 'DB_PORT', value: '3306' }
            { name: 'DB_DATABASE', value: 'directus_db' }
            { name: 'DB_USER', value: mysqlAdminUser }
            { name: 'DB_PASSWORD', value: mysqlAdminPassword }
            { name: 'DB_SSL', value: 'true' }
            { name: 'DB_SSL__REJECT_UNAUTHORIZED', value: 'false' }
            { name: 'ADMIN_EMAIL', value: 'admin@monroe-humane.org' }
            { name: 'ADMIN_PASSWORD', value: directusAdminPassword }
            { name: 'CORS_ENABLED', value: 'true' }
            { name: 'CORS_ORIGIN', value: 'true' }
            { name: 'KEY', value: directusKey }
            { name: 'SECRET', value: directusSecret }
            { name: 'PUBLIC_URL', value: 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io' }
            { name: 'WEBSOCKETS_ENABLED', value: 'true' }
            { name: 'STORAGE_LOCATIONS', value: 'azure' }
            { name: 'STORAGE_AZURE_DRIVER', value: 'azure' }
            { name: 'STORAGE_AZURE_ACCOUNT_NAME', value: storageAccountName }
            { name: 'STORAGE_AZURE_ACCOUNT_KEY', value: storageAccount.listKeys().keys[0].value }
            { name: 'STORAGE_AZURE_CONTAINER_NAME', value: 'directus-uploads' }
            { name: 'STORAGE_AZURE_PUBLIC_URL', value: '${storageAccount.properties.primaryEndpoints.blob}directus-uploads' }
          ]
        }
      ]
    }
  }
}

// 5. Container App: Humane Arcade Backend (PHP Flight)
resource arcadeApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'mchs-arcade-api'
  location: location
  properties: {
    managedEnvironmentId: acaEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'arcade-api'
          image: 'nginx:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'DB_HOST', value: mysqlServer.properties.fullyQualifiedDomainName }
            { name: 'DB_NAME', value: 'arcade_db' }
            { name: 'DB_USER', value: mysqlAdminUser }
            { name: 'DB_PASS', value: mysqlAdminPassword }
            { name: 'CORS_ALLOWED_ORIGINS', value: 'https://monroe-humane.org,https://${swaName}.azurestaticapps.net' }
          ]
        }
      ]
    }
  }
}

// 5b. Container App Job: PetSync (Petango -> Directus, direct, scheduled, no Pi/Sheets dependency)
resource petsyncJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'mchs-petsync-job'
  location: location
  properties: {
    environmentId: acaEnvironment.id
    configuration: {
      triggerType: 'Schedule'
      scheduleTriggerConfig: {
        cronExpression: '*/30 * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      replicaTimeout: 600
      replicaRetryLimit: 1
      secrets: [
        { name: 'directus-static-token', value: petsyncDirectusToken }
        { name: 'petango-authkey', value: petangoAuthkey }
        { name: 'storage-connection-string', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
      ]
    }
    template: {
      containers: [
        {
          name: 'petsync'
          image: 'ghcr.io/monroehumane/monroe-humane-petsync:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'DIRECTUS_URL', value: 'https://${directusApp.properties.configuration.ingress.fqdn}' }
            { name: 'DIRECTUS_STATIC_TOKEN', secretRef: 'directus-static-token' }
            { name: 'PETANGO_AUTHKEY', secretRef: 'petango-authkey' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection-string' }
            { name: 'PET_PHOTO_CONTAINER', value: 'pet-photos' }
          ]
        }
      ]
    }
  }
}

// 6. Azure Static Web Apps (Astro Frontend + Static Games)
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  location: 'eastus2'
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

output directusUrl string = 'https://${directusApp.properties.configuration.ingress.fqdn}'
output arcadeApiUrl string = 'https://${arcadeApp.properties.configuration.ingress.fqdn}'
output staticWebAppsUrl string = 'https://${staticWebApp.properties.defaultHostname}'
