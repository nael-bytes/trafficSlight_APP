// Silent vote manager - updates votes without causing re-renders
// Only updates cache and backend, no component state changes

import React from 'react';
import { voteOnReport } from './api';

interface VoteCache {
  [reportId: string]: {
    count: number;
    lastUpdated: number;
    pendingVotes: Array<{ userId: string; vote: number; timestamp: number }>;
  };
}

class SilentVoteManager {
  private voteCache: VoteCache = {};
  private listeners: Set<(reportId: string, newCount: number) => void> = new Set();
  private isProcessing = false;
  private pendingVotes: Array<{ reportId: string; userId: string; vote: number }> = [];

  /**
   * Add a listener for vote count changes
   */
  addListener(listener: (reportId: string, newCount: number) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current vote count for a report
   */
  getVoteCount(reportId: string): number {
    return this.voteCache[reportId]?.count || 0;
  }

  /**
   * Get pending votes for a report
   */
  getPendingVotes(reportId: string): Array<{ userId: string; vote: number; timestamp: number }> {
    return this.voteCache[reportId]?.pendingVotes || [];
  }

  /**
   * Initialize vote count for a report
   */
  initializeVoteCount(reportId: string, initialCount: number) {
    if (!this.voteCache[reportId]) {
      this.voteCache[reportId] = {
        count: initialCount,
        lastUpdated: Date.now(),
        pendingVotes: [],
      };
    }
  }

  /**
   * Silent vote - updates cache and backend without re-renders
   */
  async silentVote(reportId: string, userId: string, vote: number): Promise<void> {
    // Initialize cache if not exists
    if (!this.voteCache[reportId]) {
      this.voteCache[reportId] = {
        count: 0,
        lastUpdated: Date.now(),
        pendingVotes: [],
      };
    }

    // Update cache immediately (no state change)
    this.voteCache[reportId].count += vote;
    this.voteCache[reportId].lastUpdated = Date.now();
    this.voteCache[reportId].pendingVotes.push({
      userId,
      vote,
      timestamp: Date.now(),
    });

    // Notify listeners (for other instances)
    this.notifyListeners(reportId, this.voteCache[reportId].count);

    // Add to pending votes queue
    this.pendingVotes.push({ reportId, userId, vote });

    // Process votes in background
    this.processPendingVotes();
  }

  /**
   * Process pending votes in background
   */
  private async processPendingVotes() {
    if (this.isProcessing || this.pendingVotes.length === 0) return;

    this.isProcessing = true;

    try {
      // Process all pending votes
      const votesToProcess = [...this.pendingVotes];
      this.pendingVotes = [];

      // Process votes in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < votesToProcess.length; i += batchSize) {
        const batch = votesToProcess.slice(i, i + batchSize);
        
        // Process batch in parallel
        await Promise.allSettled(
          batch.map(({ reportId, userId, vote }) =>
            this.processVote(reportId, userId, vote)
          )
        );

        // Small delay between batches
        if (i + batchSize < votesToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('[SilentVoteManager] Error processing votes:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual vote
   */
  private async processVote(reportId: string, userId: string, vote: number) {
    try {
      // CRITICAL FIX: Call the backend API to process the vote
      const response = await voteOnReport(reportId, userId, vote);
      
      // Update cache with actual response from backend
      if (this.voteCache[reportId]) {
        // CRITICAL: Use the response from backend to get the actual vote count
        if (response && typeof response === 'object') {
          // Handle different response formats
          const voteCount = response.votes?.reduce((sum: number, v: any) => sum + (v.vote || 0), 0) || 
                           response.voteCount || 
                           this.voteCache[reportId].count;
          this.voteCache[reportId].count = voteCount;
        }
        this.voteCache[reportId].lastUpdated = Date.now();
        
        // Remove processed vote from pending
        this.voteCache[reportId].pendingVotes = this.voteCache[reportId].pendingVotes.filter(
          pv => !(pv.userId === userId && pv.vote === vote)
        );
      }

      if (__DEV__) {
        console.log('[SilentVoteManager] ✅ Vote processed successfully:', { reportId, userId, vote, response });
      }
    } catch (error) {
      console.error('[SilentVoteManager] Vote processing failed:', error);
      
      // Revert optimistic update on error
      if (this.voteCache[reportId]) {
        this.voteCache[reportId].count -= vote;
        this.voteCache[reportId].pendingVotes = this.voteCache[reportId].pendingVotes.filter(
          pv => !(pv.userId === userId && pv.vote === vote)
        );
        
        // Notify listeners of reverted count
        this.notifyListeners(reportId, this.voteCache[reportId].count);
      }
    }
  }

  /**
   * Notify all listeners of vote count changes
   */
  private notifyListeners(reportId: string, newCount: number) {
    this.listeners.forEach(listener => {
      try {
        listener(reportId, newCount);
      } catch (error) {
        console.error('[SilentVoteManager] Listener error:', error);
      }
    });
  }

  /**
   * Get all vote counts
   */
  getAllVoteCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    Object.keys(this.voteCache).forEach(reportId => {
      counts[reportId] = this.voteCache[reportId].count;
    });
    return counts;
  }

  /**
   * Clear cache for a specific report
   */
  clearReportCache(reportId: string) {
    delete this.voteCache[reportId];
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.voteCache = {};
    this.pendingVotes = [];
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      totalReports: Object.keys(this.voteCache).length,
      totalPendingVotes: this.pendingVotes.length,
      isProcessing: this.isProcessing,
      listeners: this.listeners.size,
    };
  }
}

// Create singleton instance
export const silentVoteManager = new SilentVoteManager();

/**
 * Hook for silent voting
 */
export const useSilentVote = () => {
  const silentVote = async (reportId: string, userId: string, vote: number) => {
    await silentVoteManager.silentVote(reportId, userId, vote);
  };

  const getVoteCount = (reportId: string) => {
    return silentVoteManager.getVoteCount(reportId);
  };

  const initializeVoteCount = (reportId: string, initialCount: number) => {
    silentVoteManager.initializeVoteCount(reportId, initialCount);
  };

  return {
    silentVote,
    getVoteCount,
    initializeVoteCount,
  };
};

/**
 * Hook for listening to vote count changes
 */
export const useVoteCountListener = (reportId: string) => {
  const [voteCount, setVoteCount] = React.useState(() => 
    silentVoteManager.getVoteCount(reportId)
  );

  React.useEffect(() => {
    const unsubscribe = silentVoteManager.addListener((id, count) => {
      if (id === reportId) {
        setVoteCount(count);
      }
    });

    return unsubscribe;
  }, [reportId]);

  return voteCount;
};
