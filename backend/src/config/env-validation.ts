/**
 * PROVENIQ Memory (Ledger) - Runtime Environment Validation
 * 
 * This module validates all required environment variables at application startup.
 * If validation fails, the application will refuse to start (hard fail).
 * 
 * CRITICAL: This prevents runtime errors from missing or misconfigured environment.
 */

import { z } from 'zod';

/**
 * Environment variable schema with strict validation.
 * 
 * All required fields MUST be present and valid, or the application will not start.
 */
const EnvSchema = z.object({
  // ========================================================================
  // CRITICAL: Database Configuration
  // ========================================================================
  DATABASE_URL: z.string().url().startsWith('postgres', {
    message: 'DATABASE_URL must be a PostgreSQL connection string (postgres:// or postgresql://)',
  }),
  
  // ========================================================================
  // Application Configuration
  // ========================================================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('8006'),
  
  // ========================================================================
  // CRITICAL: Authentication
  // ========================================================================
  ADMIN_API_KEY: z.string().min(32, {
    message: 'ADMIN_API_KEY must be at least 32 characters for security',
  }),
  
  // ========================================================================
  // Firebase Authentication
  // ========================================================================
  FIREBASE_PROJECT_ID: z.string().min(1, {
    message: 'FIREBASE_PROJECT_ID is required',
  }),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  
  // ========================================================================
  // CRITICAL: Ledger Network ID
  // ========================================================================
  // This identifies the ledger network (e.g., "proveniq-prod", "proveniq-staging")
  // Events from different networks MUST NOT be mixed
  LEDGER_NETWORK_ID: z.string().min(1).max(64).default('proveniq-dev'),
  
  // ========================================================================
  // Optional: CORS Configuration
  // ========================================================================
  ALLOWED_ORIGINS: z.string().optional(),
});

type Env = z.infer<typeof EnvSchema>;

/**
 * Validated environment variables.
 * Only available after validateEnvironment() is called.
 */
let validatedEnv: Env | null = null;

/**
 * Validate environment variables at startup.
 * 
 * This function MUST be called before the application starts.
 * If validation fails, the application will exit with code 1.
 * 
 * @throws Error if validation fails (process.exit(1))
 */
export function validateEnvironment(): Env {
  try {
    const env = EnvSchema.parse(process.env);
    
    // ====================================================================
    // Additional Production-Specific Validation
    // ====================================================================
    
    if (env.NODE_ENV === 'production') {
      // 1. Ensure DATABASE_URL uses SSL in production
      if (!env.DATABASE_URL.includes('sslmode=require') && !env.DATABASE_URL.includes('ssl=true')) {
        console.error('❌ FATAL: DATABASE_URL must use SSL in production');
        console.error('   Add ?sslmode=require or ?ssl=true to your connection string');
        process.exit(1);
      }
      
      // 2. Ensure ADMIN_API_KEY is strong in production
      if (env.ADMIN_API_KEY.length < 64) {
        console.error('❌ FATAL: ADMIN_API_KEY must be at least 64 characters in production');
        process.exit(1);
      }
      
      // 3. Ensure LEDGER_NETWORK_ID is not "dev" in production
      if (env.LEDGER_NETWORK_ID.includes('dev') || env.LEDGER_NETWORK_ID.includes('test')) {
        console.error('❌ FATAL: LEDGER_NETWORK_ID cannot contain "dev" or "test" in production');
        console.error(`   Current value: ${env.LEDGER_NETWORK_ID}`);
        process.exit(1);
      }
      
      // 4. Ensure Firebase credentials are configured
      if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error('❌ FATAL: GOOGLE_APPLICATION_CREDENTIALS is required in production');
        process.exit(1);
      }
    }
    
    // ====================================================================
    // Success: Log validated configuration
    // ====================================================================
    console.log(JSON.stringify({
      level: 'info',
      msg: 'environment_validation_success',
      node_env: env.NODE_ENV,
      port: env.PORT,
      ledger_network_id: env.LEDGER_NETWORK_ID,
      database_configured: !!env.DATABASE_URL,
      firebase_configured: !!env.FIREBASE_PROJECT_ID,
      at: new Date().toISOString(),
    }));
    
    validatedEnv = env;
    return env;
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('❌ FATAL: Environment validation failed');
      console.error('');
      console.error('Missing or invalid environment variables:');
      for (const error of err.errors) {
        const field = error.path.join('.');
        const msg = error.message;
        console.error(`   • ${field}: ${msg}`);
      }
      console.error('');
      console.error('The application cannot start with invalid configuration.');
      console.error('Please check your .env file or environment variables.');
      console.error('See ENV_REFERENCE.md for required variables.');
    } else {
      console.error('❌ FATAL: Unexpected error during environment validation:', err);
    }
    
    process.exit(1);
  }
}

/**
 * Get validated environment variables.
 * 
 * @throws Error if validateEnvironment() has not been called
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error('Environment not validated. Call validateEnvironment() first.');
  }
  return validatedEnv;
}

/**
 * Allow running this module directly to test validation.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  validateEnvironment();
  console.log('');
  console.log('✅ All environment variables are valid!');
}
