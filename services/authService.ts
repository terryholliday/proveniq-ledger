import { User, UserRole } from '../types';

export const MOCK_USERS: User[] = [
    { id: 'user-1', email: 'admin@proveniqledger.com', role: 'Administrator' },
    { id: 'user-2', email: 'auditor@proveniqledger.com', role: 'Auditor' },
    { id: 'user-3', email: 'viewer@proveniqledger.com', role: 'Viewer' },
];

let currentUser: User = MOCK_USERS[1]; // Default to Auditor

export const getCurrentUser = (): User => {
    return currentUser;
};

export const switchUser = (userId: string): User => {
    const newUser = MOCK_USERS.find(u => u.id === userId);
    if (newUser) {
        currentUser = newUser;
    }
    return currentUser;
};
