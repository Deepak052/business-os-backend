type SearchHandler = (organizationId: string, query: string, userPermissions: string[]) => Promise<any[]>;

interface SearchProvider {
  moduleKey: string;
  entityType: string;
  handler: SearchHandler;
}

export class SearchRegistry {
  private static providers: SearchProvider[] = [];

  static registerProvider(provider: SearchProvider) {
    this.providers.push(provider);
  }

  static async globalSearch(organizationId: string, query: string, userPermissions: string[]) {
    // Collect all search promises from registered modules
    const searchPromises = this.providers.map(async (provider) => {
      try {
        const results = await provider.handler(organizationId, query, userPermissions);
        return {
          moduleKey: provider.moduleKey,
          entityType: provider.entityType,
          results
        };
      } catch (error) {
        console.error(`Search error in module ${provider.moduleKey}`, error);
        return {
          moduleKey: provider.moduleKey,
          entityType: provider.entityType,
          results: []
        };
      }
    });

    const allResults = await Promise.all(searchPromises);
    return allResults.filter(res => res.results.length > 0);
  }
}
