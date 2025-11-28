import { AuditLogEntry, User } from '../types';
import { getCurrentUser } from './authService';

export const logAction = (action: string, details: string): AuditLogEntry => {
    const user = getCurrentUser();
    return {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        user: user.email,
        action,
        details,
    };
};