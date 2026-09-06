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
@description('Directus KEY (data encryption key). If applying to the live app, pass the KEY already running on mchs-directus — do not generate a new one. Rotating KEY can make existing encrypted fields unreadable. The live value is not in git.')
param directusKey string

@secure()
@description('Directus SECRET (session/JWT signing secret). If applying to the live app, pass the SECRET already running on mchs-directus — rotating it invalidates staff sessions.')
param directusSecret string

@secure()
@description('Static access token for the PetSync service account (Directus user, not the admin account)')
param petsyncDirectusToken string

@secure()
@description('Petango authkey used by the PetSync job to query the shelter feed directly')
param petangoAuthkey string

@secure()
@description('GitHub PAT (repo scope) the PetSync job uses to trigger a frontend rebuild via repository_dispatch. Optional — leave empty to skip auto-rebuild.')
param githubDispatchToken string = ''

@secure()
@description('Shared secret for Arcade cleanup/cron endpoints')
param arcadeCleanupSecret string

@description('Optional extra MySQL firewall rules. Each object: name, startIpAddress, endIpAddress. Empty keeps only AllowAzureServices (required for ACA without a VNet).')
param extraMysqlFirewallRules array = []

var suffix = uniqueString(resourceGroup().id)
var storageAccountName = 'mchsstorage${suffix}'
var containerAppEnvName = 'mchs-aca-env-${environmentName}'
var mysqlServerName = 'mchs-mysql-${suffix}'
var swaName = 'mchs-frontend-${environmentName}'
var logAnalyticsName = 'mchs-logs-${environmentName}-${suffix}'
var directusCorsOrigin = 'https://monroe-humane.org,https://delightful-dune-0d730f70f.7.azurestaticapps.net'

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
    publicAccess: 'None'
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
// publicNetworkAccess stays Enabled: ACA in this template is not VNet-injected.
// AllowAzureServices (0.0.0.0) is required for Container Apps to reach MySQL
// until a private endpoint + VNet-injected ACA environment is designed.
// TODO: add a delegated subnet, VNet for the ACA environment, and a MySQL
// private endpoint, then set publicNetworkAccess to Disabled. Do not flip
// that switch in this template — it would lock out the live apps.
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
    // Burstable Standard_B1ms does not support geo-redundant backup.
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
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

resource extraMysqlFirewall 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2023-12-30' = [for rule in extraMysqlFirewallRules: {
  parent: mysqlServer
  name: rule.name
  properties: {
    startIpAddress: rule.startIpAddress
    endIpAddress: rule.endIpAddress
  }
}]

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

// 3. Log Analytics + Azure Container Apps Environment
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource acaEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    zoneRedundant: false
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
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
      secrets: [
        { name: 'db-password', value: mysqlAdminPassword }
        { name: 'admin-password', value: directusAdminPassword }
        // Apply the currently running KEY/SECRET if the live app has implicit
        // keys. Rotating KEY can brick encrypted fields. Live KEY is not in git.
        { name: 'directus-key', value: directusKey }
        { name: 'directus-secret', value: directusSecret }
        { name: 'storage-azure-account-key', value: storageAccount.listKeys().keys[0].value }
      ]
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
      containers: [
        {
          name: 'directus'
          // Pinned to the upstream image, not the custom GHCR build from
          // backend/Dockerfile — that image has an unresolved boot crash
          // (MODULE_NOT_FOUND even with a minimal Dockerfile and provenance
          // disabled). Revisit once root-caused; see deploy-containers.yml.
          image: 'directus/directus:11.5.0'
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
            { name: 'DB_PASSWORD', secretRef: 'db-password' }
            { name: 'DB_SSL', value: 'true' }
            { name: 'ADMIN_EMAIL', value: 'admin@monroe-humane.org' }
            { name: 'ADMIN_PASSWORD', secretRef: 'admin-password' }
            { name: 'CORS_ENABLED', value: 'true' }
            { name: 'CORS_ORIGIN', value: directusCorsOrigin }
            { name: 'KEY', secretRef: 'directus-key' }
            { name: 'SECRET', secretRef: 'directus-secret' }
            { name: 'PUBLIC_URL', value: 'https://mchs-directus.${acaEnvironment.properties.defaultDomain}' }
            { name: 'WEBSOCKETS_ENABLED', value: 'true' }
            { name: 'STORAGE_LOCATIONS', value: 'azure' }
            { name: 'STORAGE_AZURE_DRIVER', value: 'azure' }
            { name: 'STORAGE_AZURE_ACCOUNT_NAME', value: storageAccountName }
            { name: 'STORAGE_AZURE_ACCOUNT_KEY', secretRef: 'storage-azure-account-key' }
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
      secrets: [
        { name: 'db-pass', value: mysqlAdminPassword }
        { name: 'cleanup-secret', value: arcadeCleanupSecret }
      ]
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
      containers: [
        {
          name: 'arcade-api'
          // Align with the image CI already pushes. A live template apply
          // must keep any existing ghcr.io registry credentials on this app.
          image: 'ghcr.io/monroehumane/monroe-humane-arcade:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'DB_HOST', value: mysqlServer.properties.fullyQualifiedDomainName }
            { name: 'DB_NAME', value: 'arcade_db' }
            { name: 'DB_USER', value: mysqlAdminUser }
            { name: 'DB_PASS', secretRef: 'db-pass' }
            { name: 'DB_SSL', value: 'true' }
            { name: 'CORS_ALLOWED_ORIGINS', value: directusCorsOrigin }
            { name: 'CLEANUP_SECRET', secretRef: 'cleanup-secret' }
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
        { name: 'github-dispatch-token', value: githubDispatchToken }
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
            { name: 'GITHUB_DISPATCH_TOKEN', secretRef: 'github-dispatch-token' }
            { name: 'GITHUB_REPO', value: 'MonroeHumane/AzureMigration' }
            { name: 'PUBLIC_SITE_URL', value: 'https://monroe-humane.org' }
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
