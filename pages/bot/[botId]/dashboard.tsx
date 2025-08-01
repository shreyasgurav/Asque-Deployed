"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthContext';
import { authenticatedFetch, signOut, formatPhoneNumber } from '@/lib/auth';
import SEO from '@/components/ui/SEO';
import Loading from '@/components/ui/Loading';
import TypingIndicator from '@/components/ui/TypingIndicator';
import Layout from '@/components/layout/Layout';
import { ChevronLeft, BarChart3, Edit3, HelpCircle, Settings, User } from 'lucide-react';

interface Bot {
  id: string;
  name: string;
  description?: string;
  profilePictureUrl?: string;
  welcomeMessage?: string;
  status: 'training' | 'deployed';
  ownerId: string;
  trainingMessages: TrainingMessage[];
  createdAt: Date;
  updatedAt: Date;
  deployedAt?: Date;
  analytics?: BotAnalytics;
  unansweredQuestions?: UnansweredQuestion[];
}

interface TrainingMessage {
  id: string;
  content: string;
  timestamp: Date;
  category?: string;
  summary?: string;
  keywords?: string[];
}

interface BotAnalytics {
  totalVisitors: number;
  totalChats: number;
  totalMessages: number;
  averageResponseTime: number;
  lastActiveAt?: Date;
}

interface UnansweredQuestion {
  id: string;
  question: string;
  timestamp: Date;
  sessionId: string;
  isAnswered: boolean;
  creatorResponse?: string;
  respondedAt?: Date;
}

interface ApiResponse {
  success: boolean;
  data?: Bot;
  error?: string;
}

// Custom 2-line menu icon
const TwoLineMenuIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="4" y1="16" x2="20" y2="16" />
  </svg>
);

// Define the DashboardSidebar component
interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  bot: Bot;
  sidebarRef: React.RefObject<HTMLDivElement>;
  router: ReturnType<typeof useRouter>;
  handleDeployBot: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  bot,
  sidebarRef,
  router,
  handleDeployBot,
}) => {
  const navigationTabs = [
    { id: 'overview', label: 'Overview', icon: Settings },
    { id: 'edit', label: 'Edit Bot', icon: Edit3 },
    { id: 'unanswered', label: `Unanswered (${bot.unansweredQuestions?.filter(q => !q.isAnswered).length || 0})`, icon: HelpCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <>
      {/* Overlay for mobile when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <div
        ref={sidebarRef}
        className={`bg-slate-900 fixed lg:relative h-full border-r border-white/10 transition-all duration-300 ease-in-out z-[110] flex flex-col
          ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-16 lg:translate-x-0'}
          ${!isOpen && 'lg:overflow-hidden'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Top Section - Toggle Button */}
          <div className="p-3 sticky top-0 z-60 bg-slate-900/95 lg:static lg:z-auto lg:bg-transparent">
            <div className="flex items-center">
              <button
                onClick={onToggle}
                className="p-2 rounded-full text-[var(--sidebar-toggle-text)] hover:bg-[var(--sidebar-toggle-hover-bg)] hover:text-white transition-colors mr-2"
                aria-label="Toggle sidebar"
                style={{ zIndex: 60, position: 'relative' }}
              >
                {isOpen ? <ChevronLeft size={20} /> : <TwoLineMenuIcon size={20} />}
              </button>
              {isOpen && (
                <h2 className="ml-3 text-lg font-semibold text-[var(--sidebar-header-text)]">Dashboard</h2>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          {isOpen && (
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <div className="space-y-1">
                {navigationTabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`
                        w-full text-left p-3 rounded-lg cursor-pointer transition-colors text-sm
                        ${activeTab === tab.id
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-selected-text)]'
                            : 'bg-[var(--sidebar-bg-default)] hover:bg-[var(--sidebar-hover-bg)] text-[var(--sidebar-text-default)]'
                        } flex items-center gap-3 hover:bg-slate-700/60
                      `}
                    >
                      <IconComponent size={18} />
                      <span className="flex-1">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                <button
                  onClick={() => router.push(`/bot/${bot.id}/train`)}
                  className="w-full text-left p-3 rounded-lg cursor-pointer transition-colors text-sm bg-slate-800/50 hover:bg-slate-700/60 text-slate-200 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Train Bot</span>
                </button>

                {bot.status === 'training' ? (
                  <button
                    onClick={handleDeployBot}
                    disabled={false} // We'll check this in the API
                    className="w-full text-left p-3 rounded-lg cursor-pointer transition-colors text-sm bg-green-600/20 hover:bg-green-600/30 text-green-300 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Deploy Bot</span>
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/bot/${bot.id}`)}
                    className="w-full text-left p-3 rounded-lg cursor-pointer transition-colors text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>View Public Chat</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Sidebar Bottom Section */}
        {isOpen && (
          <div className="p-4 mt-auto text-xs text-[var(--sidebar-time-text)] border-t border-white/10">
            <a href="/about" className="block mb-1 opacity-70 hover:opacity-100 transition-opacity">About</a>
            <a href="/contact" className="block mb-1 opacity-70 hover:opacity-100 transition-opacity">Contact</a>
            <a href="https://www.linkedin.com/in/shreyasdgurav/" target="_blank" rel="noopener noreferrer" className="block opacity-80 hover:opacity-100 transition-opacity">
              By <span className="text-blue-500 font-semibold">Shreyas Gurav</span>
            </a>
          </div>
        )}
      </div>
    </>
  );
};

// Add UserDropdown component for the user icon dropdown in the header
const UserDropdown: React.FC<{ user: any }> = ({ user }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative ml-2" ref={ref}>
      <div
        className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
      >
        <User size={18} className="text-white" />
      </div>
      {open && (
        <div
          className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 animate-fade-in"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-4 py-3 border-b border-slate-800 text-xs text-slate-400 font-semibold">
            {user?.phoneNumber ? formatPhoneNumber(user.phoneNumber) : 'No phone'}
          </div>
          <button
            className="block w-full text-left px-4 py-3 text-slate-200 hover:bg-slate-800 text-sm"
            onClick={() => { router.push('/my-bots'); setOpen(false); }}
          >
            My Bots
          </button>
          <button
            className="block w-full text-left px-4 py-3 text-slate-200 hover:bg-slate-800 text-sm"
            onClick={() => { router.push('/create'); setOpen(false); }}
          >
            Create Bot
          </button>
          <div className="border-t border-slate-800 my-1" />
          <button
            className="block w-full text-left px-4 py-3 text-red-400 hover:bg-slate-800 text-sm"
            onClick={async () => { await signOut(); setOpen(false); }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default function BotDashboard() {
  const router = useRouter();
  const { botId } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'unanswered' | 'analytics'>('overview');
  
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Edit form states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    welcomeMessage: '',
    profilePicture: null as File | null,
    profilePicturePreview: null as string | null
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Unanswered questions
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  
  // Analytics loading
  const [analytics, setAnalytics] = useState<BotAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (botId && typeof botId === 'string' && user && !authLoading) {
      fetchBot(botId);
    }
  }, [botId, user, authLoading]);

  useEffect(() => {
    if (botId && typeof botId === 'string' && activeTab === 'analytics' && bot) {
      loadAnalytics(botId);
    }
  }, [activeTab, botId, bot]);

  const fetchBot = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Load dashboard data (optimized for performance)
      const response = await authenticatedFetch(`/api/bots/${id}/dashboard`);
      const result = await response.json() as ApiResponse;

      if (result.success && result.data) {
        setBot(result.data);
        setEditForm({
          name: result.data.name,
          description: result.data.description || '',
          welcomeMessage: result.data.welcomeMessage || '',
          profilePicture: null,
          profilePicturePreview: result.data.profilePictureUrl || null
        });
      } else {
        if (response.status === 403) {
          setError("Access denied: You do not own this bot");
        } else {
          setError(result.error || "Bot not found");
        }
      }
    } catch (err: any) {
      console.error("Error fetching bot:", err);
      if (err.name === 'AbortError') {
        setError("Request timed out. Please try again.");
      } else if (err.message?.includes('403')) {
        setError("Access denied: You do not own this bot");
      } else {
        setError("Failed to load bot. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async (botId: string) => {
    if (activeTab !== 'analytics') return;
    
    try {
      setLoadingAnalytics(true);
      const response = await authenticatedFetch(`/api/bots/${botId}/analytics`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setAnalytics(result.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image file size must be less than 5MB');
      return;
    }

    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setEditForm(prev => ({
        ...prev,
        profilePicture: file,
        profilePicturePreview: e.target?.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfilePicture = () => {
    setEditForm(prev => ({
      ...prev,
      profilePicture: null,
      profilePicturePreview: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpdateBot = async () => {
    if (!bot || !editForm.name.trim()) {
      setError('Bot name is required');
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      let profilePictureUrl = bot.profilePictureUrl;

      // Upload new profile picture if selected
      if (editForm.profilePicture) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', editForm.profilePicture);
          formData.append('type', 'bot-profile');

          const uploadResponse = await authenticatedFetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error('Upload failed');
          }

          const uploadResult = await uploadResponse.json();
          if (uploadResult.success && uploadResult.url) {
            profilePictureUrl = uploadResult.url;
          }
        } catch (error) {
          setError('Failed to upload profile picture');
          setIsEditing(false);
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      } else if (editForm.profilePicturePreview === null) {
        // User removed the profile picture
        profilePictureUrl = undefined;
      }

      const updateData = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        welcomeMessage: editForm.welcomeMessage.trim() || undefined,
        profilePictureUrl
      };

      const response = await authenticatedFetch(`/api/bots/${bot.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      const result = await response.json() as ApiResponse;

      if (result.success && result.data) {
        setBot(result.data);
        setActiveTab('overview');
        // Show success message (you could add a toast notification here)
      } else {
        setError(result.error || 'Failed to update bot');
      }
    } catch (error) {
      console.error('Error updating bot:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!bot) return;

    setIsDeleting(true);
    try {
      const response = await authenticatedFetch(`/api/bots/${bot.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        router.push('/my-bots');
      } else {
        setError(result.error || 'Failed to delete bot');
      }
    } catch (error) {
      console.error('Error deleting bot:', error);
      setError('Failed to delete bot');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRespondToQuestion = async (questionId: string) => {
    if (!responseText.trim()) return;

    setIsResponding(true);
    try {
      const response = await authenticatedFetch(`/api/bots/${bot?.id}/unanswered/${questionId}`, {
        method: 'POST',
        body: JSON.stringify({ response: responseText.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh bot data to get updated unanswered questions
        if (bot) {
          await fetchBot(bot.id);
        }
        setRespondingTo(null);
        setResponseText('');
        // Show success feedback briefly
        setError(null);
      } else {
        setError(result.error || 'Failed to respond to question');
      }
    } catch (error: any) {
      console.error('Error responding to question:', error);
      if (error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Failed to respond to question. Please try again.');
      }
    } finally {
      setIsResponding(false);
    }
  };

  const handleDeployBot = async () => {
    if (!bot) return;

    try {
      const response = await authenticatedFetch(`/api/bots/${bot.id}/deploy`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        await fetchBot(bot.id);
      } else {
        setError(result.error || 'Failed to deploy bot');
      }
    } catch (error) {
      console.error('Error deploying bot:', error);
      setError('Failed to deploy bot');
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'overview' | 'edit' | 'unanswered' | 'analytics');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <div
              className="absolute inset-0 w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto"
              style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
            ></div>
          </div>
          <p className="text-slate-300 font-medium">Loading bot dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="max-w-md mx-auto p-8 bg-slate-800/50 backdrop-blur-xl border-slate-700/50 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-400 mb-6">{error || "Bot not found"}</p>
          <Button
            onClick={() => router.push("/my-bots")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            Back to My Bots
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <Layout showFooter={false} showHeader={false}>
      <SEO 
        title={`${bot.name} Dashboard`}
        description={`Manage your AI chatbot ${bot.name}. Edit settings, view analytics, and respond to questions.`}
      />
      <ProtectedRoute>
        <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
          {/* Sidebar Component */}
          <DashboardSidebar
            isOpen={isSidebarOpen}
            onToggle={toggleSidebar}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            bot={bot}
            sidebarRef={sidebarRef}
            router={router}
            handleDeployBot={handleDeployBot}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-screen bg-[var(--background)]">
            {/* Header */}
            <div className="bg-slate-800/30 backdrop-blur-xl border-b border-slate-700/30 sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    
                    {/* --- FIX APPLIED HERE --- */}
                    {/* Remove the floating toggle button from the main content area: */}
                    {/* {!isSidebarOpen && (
                      <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-full text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors lg:hidden"
                        aria-label="Toggle sidebar"
                      >
                        <TwoLineMenuIcon size={20} />
                      </button>
                    )} */}
                    {/* --- END OF FIX --- */}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push("/my-bots")}
                      className="text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200 p-2 ml-12 rounded-full"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                    <div className="flex items-center gap-2">
                      <div>
                        <h1 className="text-base md:text-lg lg:text-xl font-semibold text-white">{bot.name}</h1>
                      </div>
                    </div>
                  </div>
                  <UserDropdown user={user} />
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-6 w-full min-w-0">
                {/* Tab Content */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm text-slate-400">Total Visitors</p>
                            <p className="text-2xl font-bold text-white">
                              {loadingAnalytics ? (
                                <Loading size="sm" />
                              ) : (
                                analytics?.totalVisitors || bot.analytics?.totalVisitors || 0
                              )}
                            </p>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm text-slate-400">Total Chats</p>
                            <p className="text-2xl font-bold text-white">
                              {loadingAnalytics ? (
                                <Loading size="sm" />
                              ) : (
                                analytics?.totalChats || bot.analytics?.totalChats || 0
                              )}
                            </p>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm text-slate-400">Training Data</p>
                            <p className="text-2xl font-bold text-white">-</p>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm text-slate-400">Unanswered</p>
                            <p className="text-2xl font-bold text-white">{bot.unansweredQuestions?.filter(q => !q.isAnswered).length || 0}</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Bot Info */}
                    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Bot Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Description</p>
                          <p className="text-white">{bot.description || 'No description provided'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Welcome Message</p>
                          <p className="text-white">{bot.welcomeMessage || 'Default welcome message'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Created</p>
                          <p className="text-white">{new Date(bot.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Last Updated</p>
                          <p className="text-white">{new Date(bot.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      {bot.status === 'deployed' && (
                        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <h4 className="text-green-300 font-medium mb-2">Public URL</h4>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={`${window.location.origin}/bot/${bot.id}`}
                              readOnly
                              className="flex-1 text-sm bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-slate-300"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/bot/${bot.id}`);
                              }}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Danger Zone */}
                    <Card className="bg-red-500/10 border-red-500/30 p-6">
                      <h3 className="text-lg font-semibold text-red-300 mb-4">Danger Zone</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">Delete Bot</p>
                          <p className="text-sm text-slate-400">This action cannot be undone. All data will be permanently deleted.</p>
                        </div>
                        <Button
                          onClick={() => setShowDeleteConfirm(true)}
                          variant="outline"
                          className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500"
                        >
                          Delete Bot
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Edit Tab Content */}
                {activeTab === 'edit' && (
                  <div className="space-y-6">
                    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                      <h3 className="text-lg font-semibold text-white mb-6">Edit Bot Information</h3>
                      
                      <div className="space-y-6">
                        {/* Bot Name */}
                        <div>
                          <label htmlFor="edit-name" className="block text-sm font-semibold text-white mb-2">
                            Bot Name *
                          </label>
                          <input
                            type="text"
                            id="edit-name"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Customer Support Bot"
                            className="w-full px-2 py-2 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-lg"
                            disabled={isEditing}
                            maxLength={100}
                          />
                        </div>

                        {/* Bot Description */}
                        <div>
                          <label htmlFor="edit-description" className="block text-sm font-semibold text-white mb-2">
                            Bot Description
                            <span className="text-slate-400 text-sm ml-2">(optional)</span>
                          </label>
                          <textarea
                            id="edit-description"
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe what your bot does"
                            rows={4}
                            className="w-full px-2 py-2 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-300 text-lg"
                            disabled={isEditing}
                            maxLength={500}
                          />
                        </div>

                        {/* Welcome Message */}
                        <div>
                          <label htmlFor="edit-welcome" className="block text-sm font-semibold text-white mb-2">
                            Custom Welcome Message
                            <span className="text-slate-400 text-sm ml-2">(optional)</span>
                          </label>
                          <textarea
                            id="edit-welcome"
                            value={editForm.welcomeMessage}
                            onChange={(e) => setEditForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                            placeholder="Hi! I'm your AI assistant. How can I help you today?"
                            rows={3}
                            className="w-full px-2 py-2 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-300 text-lg"
                            disabled={isEditing}
                            maxLength={200}
                          />
                          <p className="text-xs text-slate-400 mt-2">
                            This message will be shown to users when they first chat with your bot
                          </p>
                        </div>

                        {/* Error Display */}
                        {error && (
                          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <p className="text-red-300">{error}</p>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2 flex-wrap">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setActiveTab('overview');
                              setError(null);
                            }}
                            className="flex-1 bg-slate-700/30 border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:text-white"
                            disabled={isEditing}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleUpdateBot}
                            disabled={isEditing || !editForm.name.trim()}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                          >
                            {isEditing ? (
                              <div className="flex items-center">
                                <Loading size="sm" />
                                <span className="ml-2">Updating...</span>
                              </div>
                            ) : (
                              'Save Changes'
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Unanswered Questions Tab Content */}
                {activeTab === 'unanswered' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-white">Unanswered Questions</h3>
                      <span className="px-2 py-0.5 text-xs rounded bg-yellow-400 text-yellow-900 font-bold uppercase tracking-wide">Beta</span>
                    </div>
                    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                      <p className="text-slate-400 mb-6">
                        These are questions that your bot couldn't answer. Respond to them to improve your bot's knowledge.
                      </p>

                      {(!bot.unansweredQuestions || bot.unansweredQuestions.filter(q => !q.isAnswered).length === 0) ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-medium text-white mb-2">All caught up!</h4>
                          <p className="text-slate-400">
                            No unanswered questions at the moment. Your bot is handling all queries well.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {bot.unansweredQuestions.filter(q => !q.isAnswered).map((question) => (
                            <Card key={question.id} className="bg-slate-700/30 border-slate-600/50 p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <h4 className="text-white font-medium mb-2">User Question</h4>
                                  <p className="text-slate-300 mb-3 leading-relaxed">{question.question}</p>
                                  <div className="flex items-center text-sm text-slate-400 space-x-4">
                                    <span>📅 {new Date(question.timestamp).toLocaleDateString()}</span>
                                    <span>🕒 {new Date(question.timestamp).toLocaleTimeString()}</span>
                                    <span>💬 Session: {question.sessionId.slice(-6)}</span>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                                  Pending
                                </Badge>
                              </div>

                              {respondingTo === question.id ? (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                      Your Response
                                    </label>
                                    <textarea
                                      value={responseText}
                                      onChange={(e) => setResponseText(e.target.value)}
                                      placeholder="Provide a helpful answer to this question..."
                                      rows={4}
                                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                      disabled={isResponding}
                                    />
                                  </div>
                                  <div className="flex gap-3">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setRespondingTo(null);
                                        setResponseText('');
                                      }}
                                      className="bg-slate-700/30 border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:text-white"
                                      disabled={isResponding}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => handleRespondToQuestion(question.id)}
                                      disabled={isResponding || !responseText.trim()}
                                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                    >
                                      {isResponding ? (
                                        <div className="flex items-center">
                                          <TypingIndicator />
                                        </div>
                                      ) : (
                                        'Submit Response'
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => setRespondingTo(question.id)}
                                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                  Respond to Question
                                </Button>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* Analytics Tab Content */}
                {activeTab === 'analytics' && (
                  <div className="space-y-6">
                    {/* Analytics Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400">Total Visitors</p>
                            <p className="text-3xl font-bold text-white">
                              {loadingAnalytics ? (
                                <Loading size="sm" />
                              ) : (
                                analytics?.totalVisitors || bot.analytics?.totalVisitors || 0
                              )}
                            </p>
                            <p className="text-xs text-green-400 mt-1">↗ +12% this week</p>
                          </div>
                          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400">Total Chats</p>
                            <p className="text-3xl font-bold text-white">
                              {loadingAnalytics ? (
                                <Loading size="sm" />
                              ) : (
                                analytics?.totalChats || bot.analytics?.totalChats || 0
                              )}
                            </p>
                            <p className="text-xs text-green-400 mt-1">↗ +8% this week</p>
                          </div>
                          <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400">Total Messages</p>
                            <p className="text-3xl font-bold text-white">
                              {loadingAnalytics ? (
                                <Loading size="sm" />
                              ) : (
                                analytics?.totalMessages || bot.analytics?.totalMessages || 0
                              )}
                            </p>
                            <p className="text-xs text-green-400 mt-1">↗ +15% this week</p>
                          </div>
                          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400">Avg Response Time</p>
                            <p className="text-3xl font-bold text-white">
                              {loadingAnalytics ? (
                                <Loading size="sm" />
                              ) : (
                                `${analytics?.averageResponseTime || bot.analytics?.averageResponseTime || 0}ms`
                              )}
                            </p>
                            <p className="text-xs text-green-400 mt-1">↘ -5% faster</p>
                          </div>
                          <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Performance Insights */}
                    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Performance Insights</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-white font-medium mb-3">Bot Health Score</h4>
                          <div className="flex items-center mb-2">
                            <div className="flex-1 bg-slate-700 rounded-full h-3 mr-4">
                              <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full" style={{ width: '85%' }}></div>
                            </div>
                            <span className="text-white font-bold">85%</span>
                          </div>
                          <p className="text-sm text-slate-400">Excellent performance! Your bot is responding well to user queries.</p>
                        </div>
                        <div>
                          <h4 className="text-white font-medium mb-3">User Satisfaction</h4>
                          <div className="flex items-center mb-2">
                            <div className="flex-1 bg-slate-700 rounded-full h-3 mr-4">
                              <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full" style={{ width: '92%' }}></div>
                            </div>
                            <span className="text-white font-bold">92%</span>
                          </div>
                          <p className="text-sm text-slate-400">Users are highly satisfied with your bot's responses.</p>
                        </div>
                      </div>
                    </Card>

                    {/* Usage Trends */}
                    <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Usage Trends</h3>
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-600/50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-medium text-white mb-2">Charts Coming Soon</h4>
                        <p className="text-slate-400">
                          Detailed usage charts and trends will be available in the next update.
                        </p>
                      </div>
                    </Card>
                  </div>
                )}

              </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">Delete Bot</h3>
                      <p className="text-slate-400">This action cannot be undone</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-slate-300 mb-4">
                      Are you sure you want to delete <strong>{bot?.name}</strong>? This will permanently delete:
                    </p>
                    <ul className="text-sm text-slate-400 space-y-1 ml-4">
                      <li>• All training data ({bot?.trainingMessages.length} messages)</li>
                      <li>• Chat history and analytics</li>
                      <li>• Public bot access</li>
                      <li>• All associated data</li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 bg-slate-700/30 border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:text-white"
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteBot}
                      disabled={isDeleting}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isDeleting ? (
                        <div className="flex items-center">
                          <Loading size="sm" />
                          <span className="ml-2">Deleting...</span>
                        </div>
                      ) : (
                        'Delete Forever'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ProtectedRoute>
    </Layout>
  );
} 