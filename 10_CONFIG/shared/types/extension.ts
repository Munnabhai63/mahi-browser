export interface ExtensionItem {
  id: string;
  profileId: string;
  extensionId: string; // Chrome extension ID or internal key
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  sourceType: 'crx' | 'unpacked' | 'store';
  sourcePath: string;
  iconPath?: string;
  installedAt: string;
}

export interface StoreExtension {
  id: string;
  name: string;
  category: 'Adblocker' | 'Crypto' | 'Proxy' | 'Productivity' | 'Security' | 'Automation';
  description: string;
  storeId: string;
  version: string;
  icon: string;
  rating: number;
  users: string;
}

export interface InstallExtensionDTO {
  profileId: string;
  sourcePath: string; // File path to .crx or unpacked folder
  name?: string;
  version?: string;
  description?: string;
}

export interface BatchInstallExtensionDTO {
  profileIds: string[];
  sourcePath?: string;
  storeExtensionId?: string;
  webStoreUrl?: string;
  name?: string;
}

