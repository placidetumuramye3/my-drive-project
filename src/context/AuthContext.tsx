import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, UserStatus } from '../types/drive';
import { 
  getUsers, 
  saveUsers, 
  getCurrentSession, 
  saveCurrentSession, 
  hashPassword, 
  addAuditLog, 
  savePasswordResetCode, 
  verifyPasswordResetCode, 
  clearPasswordReset,
  initializeDatabase 
} from '../services/db';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  resetPassword: (email: string, code: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  switchUser: (userId: string) => void;
  updateUserStatus: (userId: string, status: UserStatus) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  updateUserQuota: (userId: string, quotaBytes: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and load session
  useEffect(() => {
    async function init() {
      await initializeDatabase();
      const loadedUsers = getUsers();
      setUsers(loadedUsers);

      const session = getCurrentSession();
      if (session) {
        const found = loadedUsers.find(u => u.id === session.userId);
        if (found && found.status === 'active') {
          setCurrentUser(found);
        } else {
          saveCurrentSession(null);
          // Default to admin or first user for frictionless demo
          if (loadedUsers.length > 0) {
            setCurrentUser(loadedUsers[0]);
            saveCurrentSession({ userId: loadedUsers[0].id });
          }
        }
      } else if (loadedUsers.length > 0) {
        // Automatically sign in as admin for first-time immediate usability
        setCurrentUser(loadedUsers[0]);
        saveCurrentSession({ userId: loadedUsers[0].id });
      }
      setIsLoading(false);
    }
    init();
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const allUsers = getUsers();
    const user = allUsers.find(u => u.email.toLowerCase() === trimmedEmail);

    if (!user) {
      addAuditLog({
        userId: 'anonymous',
        userEmail: trimmedEmail,
        eventType: 'AUTH_LOGIN',
        description: `Failed login attempt for unknown email: ${trimmedEmail}`,
        ipAddress: '127.0.0.1',
        severity: 'warning'
      });
      return { success: false, error: 'Invalid email or password.' };
    }

    if (user.status === 'suspended') {
      return { success: false, error: 'This account has been suspended by an administrator.' };
    }
    if (user.status === 'deactivated') {
      return { success: false, error: 'This account has been deactivated. Please contact support.' };
    }

    const hashedInput = await hashPassword(pass);
    if (user.passwordHash !== hashedInput) {
      addAuditLog({
        userId: user.id,
        userEmail: user.email,
        eventType: 'AUTH_LOGIN',
        description: `Failed password verification for user ${user.email}`,
        ipAddress: '127.0.0.1',
        severity: 'warning'
      });
      return { success: false, error: 'Invalid email or password.' };
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    const updatedUsers = allUsers.map(u => u.id === user.id ? user : u);
    saveUsers(updatedUsers);
    setUsers(updatedUsers);

    setCurrentUser(user);
    saveCurrentSession({ userId: user.id });

    addAuditLog({
      userId: user.id,
      userEmail: user.email,
      eventType: 'AUTH_LOGIN',
      description: `User ${user.name} logged in successfully`,
      ipAddress: '127.0.0.1',
      severity: 'info'
    });

    return { success: true };
  };

  const register = async (name: string, email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !pass) {
      return { success: false, error: 'All fields are required.' };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (pass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const allUsers = getUsers();
    if (allUsers.some(u => u.email.toLowerCase() === trimmedEmail)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const hashedPass = await hashPassword(pass);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: trimmedName,
      email: trimmedEmail,
      passwordHash: hashedPass,
      role: 'member',
      status: 'active',
      storageQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 GB default quota
      createdAt: new Date().toISOString(),
      avatarColor: randomColor,
      lastLoginAt: new Date().toISOString(),
    };

    const updatedUsers = [...allUsers, newUser];
    saveUsers(updatedUsers);
    setUsers(updatedUsers);

    setCurrentUser(newUser);
    saveCurrentSession({ userId: newUser.id });

    addAuditLog({
      userId: newUser.id,
      userEmail: newUser.email,
      eventType: 'AUTH_REGISTER',
      description: `New user registered: ${newUser.name} (${newUser.email})`,
      ipAddress: '127.0.0.1',
      severity: 'info'
    });

    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'AUTH_LOGOUT',
        description: `User ${currentUser.email} logged out`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }
    setCurrentUser(null);
    saveCurrentSession(null);
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; code?: string; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const allUsers = getUsers();
    const user = allUsers.find(u => u.email.toLowerCase() === trimmedEmail);

    if (!user) {
      return { success: false, error: 'No account found with this email address.' };
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    savePasswordResetCode(trimmedEmail, code);

    addAuditLog({
      userId: user.id,
      userEmail: user.email,
      eventType: 'AUTH_PASSWORD_RESET',
      description: `Password recovery verification code requested for ${trimmedEmail}`,
      ipAddress: '127.0.0.1',
      severity: 'security'
    });

    return { success: true, code };
  };

  const resetPassword = async (email: string, code: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!verifyPasswordResetCode(trimmedEmail, code)) {
      return { success: false, error: 'Invalid or expired verification code.' };
    }

    if (newPass.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const allUsers = getUsers();
    const userIndex = allUsers.findIndex(u => u.email.toLowerCase() === trimmedEmail);
    if (userIndex === -1) {
      return { success: false, error: 'User not found.' };
    }

    const hashed = await hashPassword(newPass);
    allUsers[userIndex].passwordHash = hashed;
    saveUsers(allUsers);
    setUsers([...allUsers]);
    clearPasswordReset(trimmedEmail);

    addAuditLog({
      userId: allUsers[userIndex].id,
      userEmail: trimmedEmail,
      eventType: 'AUTH_PASSWORD_RESET',
      description: `Password successfully updated for ${trimmedEmail}`,
      ipAddress: '127.0.0.1',
      severity: 'security'
    });

    return { success: true };
  };

  const switchUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target) {
      setCurrentUser(target);
      saveCurrentSession({ userId: target.id });
      addAuditLog({
        userId: target.id,
        userEmail: target.email,
        eventType: 'AUTH_LOGIN',
        description: `Demo session switched to user: ${target.email} (${target.role})`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }
  };

  const updateUserStatus = (userId: string, status: UserStatus) => {
    const allUsers = getUsers();
    const updated = allUsers.map(u => u.id === userId ? { ...u, status } : u);
    saveUsers(updated);
    setUsers(updated);

    if (currentUser?.id === userId && status !== 'active') {
      logout();
    }

    addAuditLog({
      userId: currentUser?.id || 'admin',
      userEmail: currentUser?.email || 'admin@system',
      eventType: 'USER_STATUS_CHANGE',
      description: `Changed status of user ${userId} to ${status}`,
      ipAddress: '127.0.0.1',
      severity: 'security'
    });
  };

  const updateUserRole = (userId: string, role: UserRole) => {
    const allUsers = getUsers();
    const updated = allUsers.map(u => u.id === userId ? { ...u, role } : u);
    saveUsers(updated);
    setUsers(updated);

    if (currentUser?.id === userId) {
      setCurrentUser({ ...currentUser, role });
    }

    addAuditLog({
      userId: currentUser?.id || 'admin',
      userEmail: currentUser?.email || 'admin@system',
      eventType: 'USER_STATUS_CHANGE',
      description: `Updated role of user ${userId} to ${role}`,
      ipAddress: '127.0.0.1',
      severity: 'security'
    });
  };

  const updateUserQuota = (userId: string, quotaBytes: number) => {
    const allUsers = getUsers();
    const updated = allUsers.map(u => u.id === userId ? { ...u, storageQuotaBytes: quotaBytes } : u);
    saveUsers(updated);
    setUsers(updated);

    if (currentUser?.id === userId) {
      setCurrentUser({ ...currentUser, storageQuotaBytes: quotaBytes });
    }

    addAuditLog({
      userId: currentUser?.id || 'admin',
      userEmail: currentUser?.email || 'admin@system',
      eventType: 'USER_QUOTA_CHANGE',
      description: `Updated quota of user ${userId} to ${(quotaBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      ipAddress: '127.0.0.1',
      severity: 'info'
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isLoading,
        login,
        register,
        logout,
        requestPasswordReset,
        resetPassword,
        switchUser,
        updateUserStatus,
        updateUserRole,
        updateUserQuota,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
