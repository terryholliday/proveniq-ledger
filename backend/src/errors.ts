
export enum ErrorCode {
    INVALID_TRANSITION = 'INVALID_TRANSITION',
    SEAL_TERMINATED = 'SEAL_TERMINATED',
    SIGNATURE_INVALID = 'SIGNATURE_INVALID',
    UNRECOGNIZED_LEDGER_EVENT_TYPE = 'UNRECOGNIZED_LEDGER_EVENT_TYPE',
    UNSUPPORTED_SCHEMA_VERSION = 'UNSUPPORTED_SCHEMA_VERSION',
    LEDGER_WRITE_FAILED = 'LEDGER_WRITE_FAILED',
    TIMESTAMP_OUT_OF_BOUNDS = 'TIMESTAMP_OUT_OF_BOUNDS',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

    // Add others as needed
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface ErrorEnvelope {
    error: {
        code: ErrorCode;
        message: string;
        details?: any;
    };
    correlation_id?: string;
    timestamp: string;
}
