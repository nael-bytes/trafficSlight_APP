import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import SearchBar from '../Screens/loggedIn/SearchBar';
import type { LocationCoords, Motor } from '../types';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  searchRef: React.RefObject<any>;
  searchText: string;
  setSearchText: (text: string) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  onDestinationSelect: (destination: LocationCoords) => void;
  animateToRegion: (region: any) => void;
  selectedMotor: Motor | null;
  onMotorSelect: (motor: Motor | null) => void;
  motorList: Motor[];
  onPlaceSelectedCloseModal: () => void;
  userId: string | undefined;
  onMapSelection: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  searchRef,
  searchText,
  setSearchText,
  isTyping,
  setIsTyping,
  onDestinationSelect,
  animateToRegion,
  selectedMotor,
  onMotorSelect,
  motorList,
  onPlaceSelectedCloseModal,
  userId,
  onMapSelection,
}) => {
  // Handle map selection with immediate modal close
  const handleMapSelection = () => {
    console.log("🗺️ Map selection triggered from SearchModal");
    onMapSelection();
    onClose(); // Close the modal immediately
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.modalBackButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Where to?</Text>
        </View>

        <SearchBar
          searchRef={searchRef}
          searchText={searchText}
          setSearchText={setSearchText}
          isTyping={isTyping}
          setIsTyping={setIsTyping}
          setDestination={onDestinationSelect}
          animateToRegion={animateToRegion}
          selectedMotor={selectedMotor}
          setSelectedMotor={onMotorSelect}
          motorList={motorList}
          onPlaceSelectedCloseModal={onPlaceSelectedCloseModal}
          userId={userId}
          onMapSelection={handleMapSelection}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalBackButton: {
    marginRight: 16,
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
});
