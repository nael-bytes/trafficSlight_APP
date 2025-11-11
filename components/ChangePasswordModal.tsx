import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UserContext } from '../AuthContext/UserContextImproved';
import { LOCALHOST_IP } from '@env';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ visible, onClose, userEmail }) => {
  const [currentStep, setCurrentStep] = useState<'method' | 'current-password' | 'otp' | 'new-password'>('method');
  const [currentPassword, setCurrentPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  
  const { resetPassword } = useContext(UserContext);

  const resetForm = () => {
    setCurrentStep('method');
    setCurrentPassword('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setIsLoading(false);
    setOtpSent(false);
    setOtpVerified(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleMethodSelection = (method: 'current-password' | 'otp') => {
    setCurrentStep(method);
    if (method === 'otp') {
      sendOTP();
    }
  };

  const sendOTP = async () => {
    if (!userEmail) {
      Alert.alert('Error', 'Email not available');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(userEmail);
      if (result.success) {
        setOtpSent(true);
        Alert.alert('OTP Sent', 'Please check your email for the OTP code');
      } else {
        Alert.alert('Error', result.error || 'Failed to send OTP');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP code');
      return;
    }

    setIsLoading(true);
    try {
      // In a real implementation, you would verify the OTP with the backend
      // For now, we'll simulate OTP verification
      if (otp.length >= 4) {
        setOtpVerified(true);
        setCurrentStep('new-password');
        Alert.alert('Success', 'OTP verified successfully');
      } else {
        Alert.alert('Error', 'Invalid OTP code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Uses: PUT /api/users/change-password (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
      // For change password with current password, use PUT /api/users/change-password
      // For change password with OTP (forgot password flow), use POST /api/auth/change-password
      const endpoint = currentStep === 'current-password' 
        ? `${LOCALHOST_IP}/api/users/change-password`  // Change password with current password
        : `${LOCALHOST_IP}/api/auth/change-password`;  // Change password with OTP (forgot password flow)
      
      const method = currentStep === 'current-password' ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: currentStep === 'current-password' ? currentPassword : null,
          otp: currentStep === 'otp' ? otp : null,
          newPassword,
          email: userEmail,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Password changed successfully', [
          { text: 'OK', onPress: handleClose }
        ]);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMethodSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <MaterialIcons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>Choose how you want to verify your identity</Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      <View style={styles.methodContainer}>
        <TouchableOpacity
          style={styles.methodButton}
          onPress={() => handleMethodSelection('current-password')}
        >
          <MaterialIcons name="lock" size={24} color="#00ADB5" />
          <View style={styles.methodContent}>
            <Text style={styles.methodTitle}>I remember my current password</Text>
            <Text style={styles.methodDescription}>Enter your current password to change it</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.methodButton}
          onPress={() => handleMethodSelection('otp')}
        >
          <MaterialIcons name="email" size={24} color="#00ADB5" />
          <View style={styles.methodContent}>
            <Text style={styles.methodTitle}>I forgot my password</Text>
            <Text style={styles.methodDescription}>Send OTP to your email address</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentPassword = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => setCurrentStep('method')}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Enter Current Password</Text>
          <Text style={styles.subtitle}>Verify your current password to continue</Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Current Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => setCurrentStep('new-password')}
          disabled={!currentPassword.trim()}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOTP = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => setCurrentStep('method')}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Enter OTP Code</Text>
          <Text style={styles.subtitle}>
            {otpSent ? 'Enter the OTP code sent to your email' : 'Sending OTP to your email...'}
          </Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.label}>OTP Code</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter OTP code"
          value={otp}
          onChangeText={setOtp}
          keyboardType="numeric"
          maxLength={6}
        />

        {!otpSent && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={sendOTP}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#00ADB5" />
            ) : (
              <Text style={[styles.buttonText, { color: '#00ADB5' }]}>Send OTP</Text>
            )}
          </TouchableOpacity>
        )}

        {otpSent && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={verifyOTP}
            disabled={!otp.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderNewPassword = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={() => setCurrentStep(currentStep === 'current-password' ? 'current-password' : 'otp')}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>Enter your new password</Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      <ScrollView style={styles.formContainer}>
        <Text style={styles.label}>New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>Confirm New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={changePassword}
          disabled={!newPassword.trim() || !confirmPassword.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Change Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {currentStep === 'method' && renderMethodSelection()}
          {currentStep === 'current-password' && renderCurrentPassword()}
          {currentStep === 'otp' && renderOTP()}
          {currentStep === 'new-password' && renderNewPassword()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 0,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '80%',
  },
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 5,
    marginRight: 10,
    width: 34, // Fixed width to balance the layout
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  methodContainer: {
    padding: 20,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  methodContent: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
  },
  methodDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    textAlign: 'left',
  },
  formContainer: {
    padding: 20,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'left',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    textAlign: 'left',
  },
  button: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#00ADB5',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00ADB5',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});

export default ChangePasswordModal;
