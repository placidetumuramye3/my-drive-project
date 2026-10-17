/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DriveProvider, useDrive } from './context/DriveContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { FileExplorer } from './components/drive/FileExplorer';
import { TrashView } from './components/drive/TrashView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/common/ToastContainer';
import { FileUploadModal } from './components/drive/FileUploadModal';
import { FolderModal } from './components/drive/FolderModal';
import { AuthModal } from './components/auth/AuthModal';
import { PublicShareView } from './components/drive/PublicShareView';

const DriveAppContent: React.FC = () => {
  const { activeTab } = useDrive();
  const { currentUser, isLoading } = useAuth();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Detect public share link token in URL
  const [publicShareToken, setPublicShareToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get('share');
    if (qToken) return qToken;

    const hash = window.location.hash;
    if (hash.startsWith('#/share/')) return hash.replace('#/share/', '');
    if (hash.startsWith('#share=')) return hash.replace('#share=', '');

    if (window.location.pathname.startsWith('/share/')) {
      const parts = window.location.pathname.split('/share/');
      if (parts[1]) return parts[1];
    }
    return null;
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const qToken = params.get('share');
      if (qToken) {
        setPublicShareToken(qToken);
        return;
      }

      const hash = window.location.hash;
      if (hash.startsWith('#/share/')) {
        setPublicShareToken(hash.replace('#/share/', ''));
        return;
      }
      if (hash.startsWith('#share=')) {
        setPublicShareToken(hash.replace('#share=', ''));
        return;
      }

      if (window.location.pathname.startsWith('/share/')) {
        const parts = window.location.pathname.split('/share/');
        if (parts[1]) {
          setPublicShareToken(parts[1]);
          return;
        }
      }

      setPublicShareToken(null);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // If viewing a public share link, render the PublicShareView portal
  if (publicShareToken) {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-slate-50">
        <PublicShareView
          token={publicShareToken}
          onClose={() => {
            setPublicShareToken(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
        <ToastContainer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Initializing Storage Drive Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white text-slate-800 antialiased overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenNewFolder={() => setIsFolderModalOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenNewFolder={() => setIsFolderModalOpen(true)}
        />

        {/* Dynamic Center View */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
          {activeTab === 'trash' ? (
            <TrashView />
          ) : activeTab === 'admin' || activeTab === 'audit' ? (
            <AdminDashboard />
          ) : (
            <FileExplorer />
          )}
        </main>
      </div>

      {/* Global Toast Notification System */}
      <ToastContainer />

      {/* Primary Global Modals */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DriveProvider>
          <DriveAppContent />
        </DriveProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
