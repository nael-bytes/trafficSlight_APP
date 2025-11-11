// Cache Performance Dashboard Component
// Displays comprehensive cache analytics and performance metrics

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { cacheAnalytics, analyticsUtils } from '../utils/cacheAnalytics';
import { predictiveCache, predictiveUtils } from '../utils/predictiveCache';
import { cacheCompression, compressionUtils } from '../utils/cacheCompression';
import { backgroundSync, syncUtils } from '../utils/backgroundSync';

const { width } = Dimensions.get('window');

interface CacheDashboardProps {
  visible: boolean;
  onClose: () => void;
}

export const CacheDashboard: React.FC<CacheDashboardProps> = ({ visible, onClose }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [compressionStats, setCompressionStats] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'predictions' | 'compression' | 'sync'>('overview');

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const [analyticsData, predictionsData, compressionData, syncData] = await Promise.all([
        cacheAnalytics.getAnalytics(),
        predictiveCache.getPredictions(60 * 60 * 1000), // Next hour
        cacheCompression.getOverallStats(),
        backgroundSync.getSyncStatistics(),
      ]);

      setAnalytics(analyticsData);
      setPredictions(predictionsData);
      setCompressionStats(compressionData);
      setSyncStatus(syncData);
    } catch (error) {
      console.error('[CacheDashboard] Error loading data:', error);
    }
  }, []);

  // Refresh data
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  // Load data on mount
  useEffect(() => {
    if (visible) {
      loadDashboardData();
    }
  }, [visible, loadDashboardData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [visible, loadDashboardData]);

  if (!visible) return null;

  const renderOverview = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Cache Performance Overview</Text>
      
      {analytics && (
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <MaterialIcons name="speed" size={24} color="#4CAF50" />
            <Text style={styles.metricValue}>{analyticsUtils.formatHitRate(analytics.metrics.hitRate)}</Text>
            <Text style={styles.metricLabel}>Hit Rate</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialIcons name="timer" size={24} color="#2196F3" />
            <Text style={styles.metricValue}>{analyticsUtils.formatResponseTime(analytics.metrics.averageResponseTime)}</Text>
            <Text style={styles.metricLabel}>Avg Response</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialIcons name="storage" size={24} color="#FF9800" />
            <Text style={styles.metricValue}>{analyticsUtils.formatCacheSize(analytics.metrics.totalCacheSize)}</Text>
            <Text style={styles.metricLabel}>Cache Size</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialIcons name="trending-up" size={24} color="#9C27B0" />
            <Text style={styles.metricValue}>{analytics.metrics.performanceScore.toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Performance</Text>
          </View>
        </View>
      )}

      {analytics && analytics.alerts.length > 0 && (
        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          {analytics.alerts.slice(0, 3).map((alert: any, index: number) => (
            <View key={index} style={[styles.alertItem, { backgroundColor: alert.type === 'error' ? '#FFEBEE' : alert.type === 'warning' ? '#FFF3E0' : '#E3F2FD' }]}>
              <MaterialIcons 
                name={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'} 
                size={16} 
                color={alert.type === 'error' ? '#F44336' : alert.type === 'warning' ? '#FF9800' : '#2196F3'} 
              />
              <Text style={styles.alertText}>{alert.message}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderAnalytics = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Detailed Analytics</Text>
      
      {analytics && (
        <>
          <View style={styles.analyticsSection}>
            <Text style={styles.subsectionTitle}>Cache Metrics</Text>
            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsLabel}>Total Requests</Text>
                <Text style={styles.analyticsValue}>{analytics.metrics.totalRequests}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsLabel}>Cache Hits</Text>
                <Text style={styles.analyticsValue}>{analytics.metrics.cacheHits}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsLabel}>Cache Misses</Text>
                <Text style={styles.analyticsValue}>{analytics.metrics.cacheMisses}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsLabel}>Expired Entries</Text>
                <Text style={styles.analyticsValue}>{analytics.metrics.expiredEntries}</Text>
              </View>
            </View>
          </View>

          {analytics.topAccessedKeys.length > 0 && (
            <View style={styles.analyticsSection}>
              <Text style={styles.subsectionTitle}>Top Accessed Keys</Text>
              {analytics.topAccessedKeys.slice(0, 5).map((key: any, index: number) => (
                <View key={index} style={styles.keyItem}>
                  <Text style={styles.keyName}>{key.key}</Text>
                  <View style={styles.keyStats}>
                    <Text style={styles.keyCount}>{key.accessCount} accesses</Text>
                    <Text style={styles.keyTime}>{new Date(key.lastAccessed).toLocaleTimeString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {analytics.recommendations.length > 0 && (
            <View style={styles.analyticsSection}>
              <Text style={styles.subsectionTitle}>Recommendations</Text>
              {analytics.recommendations.map((rec: string, index: number) => (
                <View key={index} style={styles.recommendationItem}>
                  <MaterialIcons name="lightbulb-outline" size={16} color="#FFC107" />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderPredictions = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Predictive Caching</Text>
      
      {predictions.length > 0 ? (
        <>
          <Text style={styles.subsectionTitle}>Upcoming Predictions</Text>
          {predictions.slice(0, 10).map((prediction: any, index: number) => (
            <View key={index} style={styles.predictionItem}>
              <MaterialIcons 
                name={predictiveUtils.getDataTypeIcon(prediction.dataType)} 
                size={20} 
                color={predictiveUtils.getConfidenceColor(prediction.confidence)} 
              />
              <View style={styles.predictionInfo}>
                <Text style={styles.predictionKey}>{prediction.key}</Text>
                <Text style={styles.predictionDetails}>
                  {predictiveUtils.formatConfidence(prediction.confidence)} confidence • 
                  {predictiveUtils.formatTimeUntilAccess(prediction.nextPredictedAccess)}
                </Text>
              </View>
              <View style={[styles.confidenceBar, { backgroundColor: predictiveUtils.getConfidenceColor(prediction.confidence) }]}>
                <View style={[styles.confidenceFill, { width: `${prediction.confidence * 100}%` }]} />
              </View>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.noDataText}>No predictions available</Text>
      )}
    </View>
  );

  const renderCompression = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Cache Compression</Text>
      
      {compressionStats && (
        <>
          <View style={styles.compressionSection}>
            <Text style={styles.subsectionTitle}>Compression Statistics</Text>
            <View style={styles.compressionGrid}>
              <View style={styles.compressionItem}>
                <Text style={styles.compressionLabel}>Original Size</Text>
                <Text style={styles.compressionValue}>{compressionUtils.formatSize(compressionStats.totalOriginalSize)}</Text>
              </View>
              <View style={styles.compressionItem}>
                <Text style={styles.compressionLabel}>Compressed Size</Text>
                <Text style={styles.compressionValue}>{compressionUtils.formatSize(compressionStats.totalCompressedSize)}</Text>
              </View>
              <View style={styles.compressionItem}>
                <Text style={styles.compressionLabel}>Space Saved</Text>
                <Text style={styles.compressionValue}>{compressionUtils.formatSize(compressionStats.totalSpaceSaved)}</Text>
              </View>
              <View style={styles.compressionItem}>
                <Text style={styles.compressionLabel}>Compression Ratio</Text>
                <Text style={styles.compressionValue}>{compressionUtils.formatCompressionRatio(compressionStats.averageCompressionRatio)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.compressionSection}>
            <Text style={styles.subsectionTitle}>Compression Benefits</Text>
            <View style={styles.benefitItem}>
              <MaterialIcons name="save" size={20} color="#4CAF50" />
              <Text style={styles.benefitText}>
                Saved {compressionUtils.formatSize(compressionStats.totalSpaceSaved)} of storage space
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialIcons name="speed" size={20} color="#2196F3" />
              <Text style={styles.benefitText}>
                Improved cache performance with {compressionStats.compressionCount} compressed entries
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );

  const renderSync = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Background Sync</Text>
      
      {syncStatus && (
        <>
          <View style={styles.syncSection}>
            <Text style={styles.subsectionTitle}>Sync Status</Text>
            <View style={styles.syncGrid}>
              <View style={styles.syncItem}>
                <Text style={styles.syncLabel}>Status</Text>
                <Text style={[styles.syncValue, { color: syncUtils.getStatusColor({ ...syncStatus, isRunning: true }) }]}>
                  {syncUtils.formatSyncStatus(syncStatus)}
                </Text>
              </View>
              <View style={styles.syncItem}>
                <Text style={styles.syncLabel}>Success Rate</Text>
                <Text style={styles.syncValue}>{syncUtils.formatSuccessRate(syncStatus.successRate)}</Text>
              </View>
              <View style={styles.syncItem}>
                <Text style={styles.syncLabel}>Pending Items</Text>
                <Text style={styles.syncValue}>{syncStatus.pendingItems}</Text>
              </View>
              <View style={styles.syncItem}>
                <Text style={styles.syncLabel}>Total Synced</Text>
                <Text style={styles.syncValue}>{syncStatus.totalSynced}</Text>
              </View>
            </View>
          </View>

          <View style={styles.syncSection}>
            <Text style={styles.subsectionTitle}>Sync Performance</Text>
            <View style={styles.performanceItem}>
              <MaterialIcons name="timer" size={20} color="#FF9800" />
              <Text style={styles.performanceText}>
                Average sync time: {syncStatus.averageSyncTime.toFixed(1)}ms
              </Text>
            </View>
            <View style={styles.performanceItem}>
              <MaterialIcons name="sync" size={20} color="#2196F3" />
              <Text style={styles.performanceText}>
                Last sync: {syncUtils.formatSyncTime(syncStatus.lastSyncTime)}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cache Dashboard</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'overview', label: 'Overview', icon: 'dashboard' },
          { key: 'analytics', label: 'Analytics', icon: 'analytics' },
          { key: 'predictions', label: 'Predictions', icon: 'psychology' },
          { key: 'compression', label: 'Compression', icon: 'compress' },
          { key: 'sync', label: 'Sync', icon: 'sync' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <MaterialIcons 
              name={tab.icon as any} 
              size={16} 
              color={activeTab === tab.key ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'predictions' && renderPredictions()}
        {activeTab === 'compression' && renderCompression()}
        {activeTab === 'sync' && renderSync()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  alertsSection: {
    marginTop: 20,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  analyticsSection: {
    marginBottom: 20,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticsItem: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  keyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  keyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  keyStats: {
    alignItems: 'flex-end',
  },
  keyCount: {
    fontSize: 12,
    color: '#666',
  },
  keyTime: {
    fontSize: 10,
    color: '#999',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  predictionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  predictionKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  predictionDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  confidenceBar: {
    height: 4,
    width: 60,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginLeft: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  compressionSection: {
    marginBottom: 20,
  },
  compressionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  compressionItem: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  compressionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  compressionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  syncSection: {
    marginBottom: 20,
  },
  syncGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  syncItem: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  syncLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  syncValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  performanceText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
});
