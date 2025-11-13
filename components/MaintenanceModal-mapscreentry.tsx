import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface MaintenanceFormData {
  type: '' | 'oil_change' | 'refuel' | 'tune_up';
  cost: string;
  quantity: string;
  costPerLiter: string;
  notes: string;
}

interface MaintenanceModalProps {
  visible: boolean;
  formData: MaintenanceFormData;
  onClose: () => void;
  onSave: () => void;
  onChange: (field: keyof MaintenanceFormData, value: string) => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  visible,
  formData,
  onClose,
  onSave,
  onChange,
}) => {
  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="slide" 
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.formModal}>
          <Text style={styles.formTitle}>
            {formData.type
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
          </Text>

          {/* Cost */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Cost (₱)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={formData.cost}
              onChangeText={text => onChange('cost', text)}
              placeholder="Enter cost"
            />
          </View>

          {/* Cost per Liter for refuel */}
          {formData.type === 'refuel' && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Cost per Liter (₱)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.costPerLiter}
                  onChangeText={text => onChange('costPerLiter', text)}
                  placeholder="Enter cost per liter"
                />
              </View>

              {/* Calculated quantity display */}
              {formData.cost && formData.costPerLiter && 
               parseFloat(formData.cost) > 0 && 
               parseFloat(formData.costPerLiter) > 0 && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Calculated Quantity (L)</Text>
                  <View style={styles.calculatedQuantityContainer}>
                    <Text style={styles.calculatedQuantityText}>
                      {(parseFloat(formData.cost) / parseFloat(formData.costPerLiter)).toFixed(2)}L
                    </Text>
                    <Text style={styles.calculatedQuantitySubtext}>
                      {formData.cost} ÷ {formData.costPerLiter} = {(parseFloat(formData.cost) / parseFloat(formData.costPerLiter)).toFixed(2)}L
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Quantity for oil_change */}
          {formData.type === 'oil_change' && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Oil Quantity (L)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={formData.quantity}
                onChangeText={text => onChange('quantity', text)}
                placeholder="Enter quantity in liters"
              />
            </View>
          )}

          {/* Notes */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={formData.notes}
              onChangeText={text => onChange('notes', text)}
              placeholder={`Add notes about the ${formData.type.replace('_', ' ')} (optional)`}
              multiline
            />
          </View>

          {/* Buttons */}
          <View style={styles.formButtons}>
            <TouchableOpacity onPress={onClose} style={[styles.formButton, styles.cancelButton]}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={[styles.formButton, styles.saveButton]}>
              <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#00ADB5',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
  },
  calculatedQuantityContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  calculatedQuantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  calculatedQuantitySubtext: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});
