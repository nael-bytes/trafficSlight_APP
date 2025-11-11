/**
 * Gas Price Update Modal Component
 * Allows users to update gas prices for a gas station
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { updateGasPrice, getPriceHistory } from '../../utils/api';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

interface GasStation {
  _id: string;
  brand?: string;
  name?: string;
  address?: any;
  prices?: Array<{
    fuelType: string;
    price: number;
    currency?: string;
    lastUpdated?: string;
  }>;
}

interface PriceHistoryEntry {
  fuelType: string;
  oldPrice: number | null;
  newPrice: number;
  updatedBy?: {
    _id: string;
    name?: string;
    email?: string;
  };
  updatedAt: string;
}

interface GasPriceUpdateModalProps {
  visible: boolean;
  station: GasStation | null;
  onClose: () => void;
  onPriceUpdated?: (station: GasStation) => void;
}

// CRITICAL: Only show Gasoline and Premium Gasoline as per requirements
const FUEL_TYPES = [
  { value: 'gasoline', label: 'Gasoline' },
  { value: 'premium_gasoline', label: 'Premium Gasoline' },
];

export const GasPriceUpdateModal: React.FC<GasPriceUpdateModalProps> = ({
  visible,
  station,
  onClose,
  onPriceUpdated,
}) => {
  const [selectedFuelType, setSelectedFuelType] = useState<string>('gasoline');
  const [newPrice, setNewPrice] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});

  // Load current prices and history when modal opens
  useEffect(() => {
    if (visible && station) {
      loadCurrentPrices();
      loadPriceHistory();
    }
  }, [visible, station]);

  // Update new price input when fuel type changes
  useEffect(() => {
    if (station && selectedFuelType) {
      const currentPrice = currentPrices[selectedFuelType];
      if (currentPrice !== undefined) {
        setNewPrice(currentPrice.toString());
      } else {
        setNewPrice('');
      }
    }
  }, [selectedFuelType, currentPrices]);

  const loadCurrentPrices = () => {
    if (!station) {
      setCurrentPrices({});
      return;
    }

    const prices: Record<string, number> = {};
    
    // Handle both prices array and fuelPrices object formats
    if (station.prices && Array.isArray(station.prices)) {
      station.prices.forEach((price: any) => {
        if (price.fuelType && price.price !== undefined) {
          prices[price.fuelType] = price.price;
        }
      });
    } else if ((station as any).fuelPrices) {
      // Handle fuelPrices object format (gasoline, premium, etc.)
      const fuelPrices = (station as any).fuelPrices;
      if (fuelPrices.gasoline !== undefined) prices.gasoline = fuelPrices.gasoline;
      if (fuelPrices.diesel !== undefined) prices.diesel = fuelPrices.diesel;
      if (fuelPrices.premium !== undefined) prices.premium_gasoline = fuelPrices.premium;
      if (fuelPrices.premium_gasoline !== undefined) prices.premium_gasoline = fuelPrices.premium_gasoline;
      if (fuelPrices.premium_diesel !== undefined) prices.premium_diesel = fuelPrices.premium_diesel;
      if (fuelPrices.lpg !== undefined) prices.lpg = fuelPrices.lpg;
    }
    
    setCurrentPrices(prices);
  };

  const loadPriceHistory = async () => {
    if (!station?._id) return;

    setLoadingHistory(true);
    try {
      const history = await getPriceHistory(station._id, selectedFuelType, 10);
      setPriceHistory(history || []);
    } catch (error: any) {
      if (__DEV__) {
        console.error('[GasPriceUpdateModal] Error loading price history:', error);
      }
      setPriceHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFuelTypeChange = (fuelType: string) => {
    setSelectedFuelType(fuelType);
    loadPriceHistory();
  };

  const validatePrice = (price: string): { valid: boolean; value?: number; error?: string } => {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return { valid: false, error: 'Price must be a positive number' };
    }
    return { valid: true, value: numPrice };
  };

  const handleUpdatePrice = async () => {
    if (!station?._id) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Gas station not found',
      });
      return;
    }

    const validation = validatePrice(newPrice);
    if (!validation.valid) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Price',
        text2: validation.error || 'Please enter a valid price',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await updateGasPrice(station._id, selectedFuelType, validation.value!);

      if (result && (result.success || result.data)) {
        const responseData = result.success ? result.data : result;
        
        Toast.show({
          type: 'success',
          text1: 'Price Updated',
          text2: `${FUEL_TYPES.find(f => f.value === selectedFuelType)?.label} price updated successfully`,
        });

        // Update current prices
        if (responseData?.station?.prices) {
          const prices: Record<string, number> = {};
          responseData.station.prices.forEach((price: any) => {
            prices[price.fuelType] = price.price;
          });
          setCurrentPrices(prices);
        }

        // Update price history - reload to get latest
        await loadPriceHistory();

        // Notify parent component
        if (onPriceUpdated && responseData?.station) {
          onPriceUpdated(responseData.station);
        }

        // Clear input
        setNewPrice('');
      } else {
        throw new Error((result as any)?.message || 'Failed to update price');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('[GasPriceUpdateModal] Error updating price:', error);
      }
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message || 'Failed to update gas price. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentPrice = currentPrices[selectedFuelType];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="local-gas-station" size={32} color="#00ADB5" />
              <View style={styles.headerText}>
                <Text style={styles.modalTitle}>Update Gas Prices</Text>
                {station && (
                  <Text style={styles.stationName}>
                    {station.brand || station.name || 'Gas Station'}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Fuel Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Fuel Type</Text>
              <View style={styles.fuelTypeContainer}>
                {FUEL_TYPES.map((fuel) => (
                  <TouchableOpacity
                    key={fuel.value}
                    style={[
                      styles.fuelTypeButton,
                      selectedFuelType === fuel.value && styles.fuelTypeButtonActive,
                    ]}
                    onPress={() => handleFuelTypeChange(fuel.value)}
                  >
                    <Text
                      style={[
                        styles.fuelTypeButtonText,
                        selectedFuelType === fuel.value && styles.fuelTypeButtonTextActive,
                      ]}
                    >
                      {fuel.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Current Price Display */}
            {currentPrice !== undefined && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Price</Text>
                <View style={styles.currentPriceContainer}>
                  <Text style={styles.currentPriceValue}>
                    {formatPrice(currentPrice)}
                  </Text>
                  <Text style={styles.currentPriceLabel}>per liter</Text>
                </View>
              </View>
            )}

            {/* Price Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>New Price (₱)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₱</Text>
                <TextInput
                  style={styles.priceInput}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  placeholder={currentPrice !== undefined ? currentPrice.toString() : '0.00'}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                  editable={!loading}
                />
              </View>
              <Text style={styles.inputHint}>Enter the new price per liter</Text>
            </View>

            {/* Update Button */}
            <TouchableOpacity
              style={[styles.updateButton, loading && styles.updateButtonDisabled]}
              onPress={handleUpdatePrice}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#FFF" />
                  <Text style={styles.updateButtonText}>Update Price</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Price History */}
            <View style={styles.section}>
              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Price History</Text>
                {loadingHistory && <ActivityIndicator size="small" color="#00ADB5" />}
              </View>
              {priceHistory.length > 0 ? (
                <View style={styles.historyContainer}>
                  {priceHistory.map((entry, index) => (
                    <View key={index} style={styles.historyItem}>
                      <View style={styles.historyItemLeft}>
                        <Text style={styles.historyDate}>{formatDate(entry.updatedAt)}</Text>
                        {entry.updatedBy && (
                          <Text style={styles.historyUser}>
                            by {entry.updatedBy.name || entry.updatedBy.email || 'Unknown'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.historyItemRight}>
                        {entry.oldPrice !== null && (
                          <Text style={styles.historyOldPrice}>
                            {formatPrice(entry.oldPrice)}
                          </Text>
                        )}
                        <MaterialIcons name="arrow-forward" size={16} color="#666" />
                        <Text style={styles.historyNewPrice}>
                          {formatPrice(entry.newPrice)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noHistoryText}>No price history available</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  stationName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  fuelTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fuelTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fuelTypeButtonActive: {
    backgroundColor: '#00ADB5',
    borderColor: '#00ADB5',
  },
  fuelTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  fuelTypeButtonTextActive: {
    color: '#FFF',
  },
  currentPriceContainer: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentPriceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ADB5',
  },
  currentPriceLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 14,
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ADB5',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  historyItemLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  historyUser: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  historyItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyOldPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  historyNewPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ADB5',
  },
  noHistoryText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

