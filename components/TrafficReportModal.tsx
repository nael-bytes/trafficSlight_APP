// Traffic report modal component

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import * as ImagePicker from 'expo-image-picker';
import { submitTrafficReport } from '../utils/api';
import { reverseGeocodeLocation } from '../utils/location';
import type { User } from '../types';

interface TrafficReportModalProps {
  visible: boolean;
  user: User | null;
  currentLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const reportTypes = [
  { label: 'Accident', value: 'Accident' },
  { label: 'Traffic Jam', value: 'Traffic Jam' },
  { label: 'Road Closure', value: 'Road Closure' },
  { label: 'Hazard', value: 'Hazard' },
];

export const TrafficReportModal: React.FC<TrafficReportModalProps> = ({
  visible,
  user,
  currentLocation,
  onClose,
  onSuccess,
}) => {
  const [reportType, setReportType] = useState('Accident');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [address, setAddress] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Reverse geocode location when modal opens and location is available
  useEffect(() => {
    if (visible && currentLocation && !address) {
      const getAddress = async () => {
        setGeocoding(true);
        try {
          const addr = await reverseGeocodeLocation(currentLocation);
          setAddress(addr);
          console.log('[TrafficReportModal] Reverse geocoded address:', addr);
        } catch (error) {
          console.error('[TrafficReportModal] Reverse geocoding failed:', error);
          // Fallback to coordinates if geocoding fails
          setAddress(`${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`);
        } finally {
          setGeocoding(false);
        }
      };

      getAddress();
    }
  }, [visible, currentLocation, address]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access gallery is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    try {
      if (!user || !currentLocation) {
        Alert.alert('Error', 'User or location not available');
        return;
      }

      if (!description.trim()) {
        Alert.alert('Required', 'Please enter a description');
        return;
      }

      if (!address) {
        Alert.alert('Error', 'Address not available. Please wait for location to be processed.');
        return;
      }

      setSubmitting(true);
      
      await submitTrafficReport({
        reportType,
        location: currentLocation,
        address: address, // Add the reverse geocoded address
        description: description.trim(),
        userId: user._id,
        // image: image || undefined,
      });

      Alert.alert('Success', 'Report submitted successfully!');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('[TrafficReportModal] Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDescription('');
    setImage(null);
    setReportType('Accident');
    setAddress('');
    setDropdownOpen(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Add Traffic Report</Text>

          <View style={styles.dropdownContainer}>
            <DropDownPicker
              open={dropdownOpen}
              value={reportType}
              items={reportTypes}
              setOpen={setDropdownOpen}
              setValue={setReportType}
              setItems={() => {}}
              style={styles.dropdown}
              placeholder="Select report type"
              zIndex={3000}
              zIndexInverse={1000}
            />
          </View>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            style={styles.input}
            maxLength={200}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
            <Text style={styles.imageButtonText}>
              {image ? 'Change Image' : 'Upload Image (Optional)'}
            </Text>
          </TouchableOpacity> */}

          {image && (
            <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="cover" />
          )}

          {/* Location/Address Display */}
          <View style={styles.locationContainer}>
            <Text style={styles.locationLabel}>Location:</Text>
            {geocoding ? (
              <Text style={styles.locationText}>Getting address...</Text>
            ) : (
              <Text style={styles.locationText} numberOfLines={2}>
                {address || 'Address not available'}
              </Text>
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  dropdownContainer: {
    marginBottom: 16,
    zIndex: 1000,
  },
  dropdown: {
    borderColor: '#ddd',
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    minHeight: 80,
  },
  imageButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  imageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#2196F3',
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
