
import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 3010, // Default to 3010 for Core Service
    ledger: {
        baseUrl: process.env.LEDGER_URL || 'http://localhost:8006',
        apiKey: process.env.LEDGER_API_KEY || 'system-admin-key',
        producer: 'proveniq-core',
        producerVersion: '1.0.0'
    }
};
