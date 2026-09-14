// Import keytar as optional dependency - it may not be available in all environments
let keytar;
let keytarImportPromise;

// Lazy import keytar when needed
const getKeytar = async () => {
  if (keytar === undefined) {
    if (!keytarImportPromise) {
      keytarImportPromise = (async () => {
        try {
          const keytarModule = await import('keytar');
          return keytarModule.default;
        } catch (error) {
          console.error('Keytar not available - using fallback token storage:', error.message);
          return null;
        }
      })();
    }
    keytar = await keytarImportPromise;
  }
  return keytar;
};
import storage from 'node-persist';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAuthError, convertErrorToToolError } from '../utils/mcpErrorResponse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_NAME = 'outlook-mcp';
const ENCRYPTION_KEY_ACCOUNT = 'encryption-key';
const ACCESS_TOKEN_ACCOUNT = 'access-token';
const REFRESH_TOKEN_ACCOUNT = 'refresh-token';
const TOKEN_METADATA_KEY = 'token-metadata';

export class TokenManager {
  constructor(clientId, options = {}) {
    this.clientId = clientId;
    this.storageDir = options.storageDir || (process.env.MCP_OUTLOOK_REFRESH_TOKEN_PATH || '').trim() || path.join(__dirname, '../../.tokens');
    this.useKeytar = options.useKeytar !== false;
    this.storage = storage.create({ dir: this.storageDir, logging: false });
    this.storageInitialized = false;
    this.encryptionKey = null;
    this.connectedAccountId = null;
  }

  setConnectedAccountId(accountId) {
    this.connectedAccountId = accountId || null;
  }

  get activeScope() {
    return this.connectedAccountId || 'default';
  }

  accessKey() { return `access_token_${this.activeScope}`; }
  refreshKey() { return `refresh_token_${this.activeScope}`; }
  metadataKey() { return `token_metadata_${this.activeScope}`; }

  keytarAccessAccount() { return `${ACCESS_TOKEN_ACCOUNT}:${this.activeScope}`; }
  keytarRefreshAccount() { return `${REFRESH_TOKEN_ACCOUNT}:${this.activeScope}`; }

  async initialize() {
    if (this.storageInitialized) return;

    await this.storage.init();

    this.encryptionKey = await this.getOrCreateEncryptionKey();
    this.storageInitialized = true;
  }

  async getOrCreateEncryptionKey() {
    try {
      const keytarInstance = this.useKeytar ? await getKeytar() : null;
      if (keytarInstance) {
        const existingKey = await keytarInstance.getPassword(SERVICE_NAME, ENCRYPTION_KEY_ACCOUNT);
        if (existingKey) {
          return Buffer.from(existingKey, 'base64');
        }

        const newKey = crypto.randomBytes(32);
        await keytarInstance.setPassword(SERVICE_NAME, ENCRYPTION_KEY_ACCOUNT, newKey.toString('base64'));
        return newKey;
      }
    } catch (error) {
      // Fall through to fallback
    }
    
    // Fallback for environments without keytar (containers, MCP servers, etc.)
    // Tokens will still be encrypted and stored securely in the file system
    const fallbackKey = crypto.createHash('sha256')
      .update(this.clientId + (process.env.AZURE_TENANT_ID || 'default'))
      .digest();
    return fallbackKey;
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async storeTokens(accessToken, refreshToken, expiresIn = 3600) {
    await this.initialize();

    let usingFallback = false;
    try {
      const keytarInstance = this.useKeytar ? await getKeytar() : null;
      if (keytarInstance) {
        await keytarInstance.setPassword(SERVICE_NAME, this.keytarAccessAccount(), this.encrypt(accessToken));
        if (refreshToken) {
          await keytarInstance.setPassword(SERVICE_NAME, this.keytarRefreshAccount(), this.encrypt(refreshToken));
        }
      } else {
        usingFallback = true;
        await this.storage.setItem(this.accessKey(), this.encrypt(accessToken));
        if (refreshToken) {
          await this.storage.setItem(this.refreshKey(), this.encrypt(refreshToken));
        }
      }
    } catch (error) {
      // Keytar not available in this environment, using secure file storage instead
      usingFallback = true;
      await this.storage.setItem(this.accessKey(), this.encrypt(accessToken));
      if (refreshToken) {
        await this.storage.setItem(this.refreshKey(), this.encrypt(refreshToken));
      }
    }

    const metadata = {
      accessTokenExpiry: Date.now() + (expiresIn * 1000),
      refreshTokenExpiry: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
      lastRefresh: Date.now(),
    };
    await this.storage.setItem(this.metadataKey(), metadata);

    if (usingFallback) {
      console.error('Tokens stored securely in encrypted file storage');
    }
  }

  async getAccessToken() {
    try {
      await this.initialize();

      const metadata = await this.storage.getItem(this.metadataKey());
      if (!metadata) {
        throw createAuthError('No token metadata found', true);
      }

      const refreshThreshold = 55 * 60 * 1000; // 55 minutes
      const shouldRefresh = Date.now() > (metadata.accessTokenExpiry - refreshThreshold);

      if (shouldRefresh) {
        const error = createAuthError('Access token needs refresh', true);
        error._errorDetails = { ...error._errorDetails, needsRefresh: true };
        throw error;
      }

      const keytarInstance = this.useKeytar ? await getKeytar() : null;
      if (keytarInstance) {
        try {
          const encryptedToken = await keytarInstance.getPassword(SERVICE_NAME, this.keytarAccessAccount());
          if (encryptedToken) {
            return this.decrypt(encryptedToken);
          }
        } catch (error) {
          // Fall through to fallback
        }
      }
      
      const fallbackToken = await this.storage.getItem(this.accessKey());
      if (fallbackToken) {
        return this.decrypt(fallbackToken);
      }

      throw createAuthError('No access token found', true);
    } catch (error) {
      if (error.isError) {
        // Already an MCP error, re-throw as-is
        throw error;
      }
      throw convertErrorToToolError(error, 'Failed to retrieve access token');
    }
  }

  async getRefreshToken() {
    try {
      await this.initialize();

      const metadata = await this.storage.getItem(this.metadataKey());
      if (!metadata) {
        throw createAuthError('No token metadata found', true);
      }

      if (Date.now() > metadata.refreshTokenExpiry) {
        throw createAuthError('Refresh token has expired', true);
      }

      const keytarInstance = this.useKeytar ? await getKeytar() : null;
      if (keytarInstance) {
        try {
          const encryptedToken = await keytarInstance.getPassword(SERVICE_NAME, this.keytarRefreshAccount());
          if (encryptedToken) {
            return this.decrypt(encryptedToken);
          }
        } catch (error) {
          // Fall through to fallback
        }
      }
      
      const fallbackToken = await this.storage.getItem(this.refreshKey());
      if (fallbackToken) {
        return this.decrypt(fallbackToken);
      }

      throw createAuthError('No refresh token found', true);
    } catch (error) {
      if (error.isError) {
        // Already an MCP error, re-throw as-is
        throw error;
      }
      throw convertErrorToToolError(error, 'Failed to retrieve refresh token');
    }
  }

  async clearTokens() {
    await this.initialize();

    const keytarInstance = this.useKeytar ? await getKeytar() : null;
    if (keytarInstance) {
      try {
        await keytarInstance.deletePassword(SERVICE_NAME, this.keytarAccessAccount());
        await keytarInstance.deletePassword(SERVICE_NAME, this.keytarRefreshAccount());
      } catch (error) {
        // Silently continue - keytar might not be available
      }
    }

    await this.storage.removeItem(this.accessKey());
    await this.storage.removeItem(this.refreshKey());
    await this.storage.removeItem(this.metadataKey());
  }

  generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  generateCodeChallenge(verifier) {
    return crypto.createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  async storePKCEVerifier(verifier) {
    await this.initialize();
    await this.storage.setItem('pkce_verifier', verifier);
  }

  async getPKCEVerifier() {
    try {
      await this.initialize();
      const verifier = await this.storage.getItem('pkce_verifier');
      await this.storage.removeItem('pkce_verifier');
      if (!verifier) {
        throw createAuthError('PKCE verifier not found or expired', true);
      }
      return verifier;
    } catch (error) {
      if (error.isError) {
        // Already an MCP error, re-throw as-is
        throw error;
      }
      throw convertErrorToToolError(error, 'Failed to retrieve PKCE verifier');
    }
  }

  async isAuthenticated() {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      // For isAuthenticated, we just return false instead of throwing
      // as this is used for checking authentication status
      return false;
    }
  }

  async hasRefreshToken() {
    try {
      await this.getRefreshToken();
      return true;
    } catch {
      return false;
    }
  }

  async getTokenMetadata() {
    await this.initialize();
    return await this.storage.getItem(this.metadataKey());
  }
}