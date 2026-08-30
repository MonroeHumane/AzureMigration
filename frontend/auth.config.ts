import AzureADProvider from "@auth/core/providers/azure-ad";
import { defineConfig } from "auth-astro";

export default defineConfig({
  providers: [
    AzureADProvider({
      clientId: import.meta.env.AZURE_AD_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID,
      clientSecret: import.meta.env.AZURE_AD_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: import.meta.env.AZURE_AD_TENANT_ID || process.env.AZURE_AD_TENANT_ID,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn() {
      // You can add logic here to restrict to specific user domains if needed.
      return true;
    },
  },
});
