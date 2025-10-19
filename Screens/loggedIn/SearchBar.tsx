import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { GOOGLE_MAPS_API_KEY } from "@env";
import axios from "axios";
import type { GooglePlacesAutocompleteRef } from "react-native-google-places-autocomplete";
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

type Motor = {
  _id: string;
  name: string;
  fuelEfficiency: number;
  fuelType: 'Diesel' | 'Regular' | 'Premium';
  oilType: 'Mineral' | 'Semi-Synthetic' | 'Synthetic';
  age: number;
  totalDistance: number;
  currentFuelLevel: number;
  fuelTank: number;
  lastMaintenanceDate?: string;
  lastOilChange?: string;
  lastRegisteredDate?: string;
  lastTripDate?: string;
  lastRefuelDate?: string;
};

type SearchBarProps = {
  searchRef: React.RefObject<GooglePlacesAutocompleteRef>;
  searchText: string;
  setSearchText: (value: string) => void;
  isTyping: boolean;
  setIsTyping: (value: boolean) => void;
  setDestination: (
    destination: { latitude: number; longitude: number; address?: string } | null
  ) => void;
  animateToRegion: (region: any) => void;
  selectedMotor: Motor | null;
  setSelectedMotor: (motor: Motor | null) => void;
  motorList: Motor[];
  onPlaceSelectedCloseModal: () => void;
  userId: string; // added prop
  onMapSelection?: () => void; // added prop for map selection
};

const SearchBar = ({
  searchRef,
  searchText,
  setSearchText,
  isTyping,
  setIsTyping,
  setDestination,
  animateToRegion,
  selectedMotor,
  setSelectedMotor,
  motorList,
  onPlaceSelectedCloseModal,
  userId,
  onMapSelection,
}: SearchBarProps) => {
  const [savedLocations, setSavedLocations] = useState([]);
  const [recentLocations, setRecentLocations] = useState([]);
  const [activeTab, setActiveTab] = useState('recent');
  
  // Search suggestions state
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs for performance optimization
  const debouncedSearchRef = useRef<ReturnType<typeof debounce> | null>(null);
  const isTypingRef = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized location loading function
  const loadLocations = useCallback(async () => {
    try {
      // Load saved locations
      if (userId) {
        const response = await axios.get(
          `https://ts-backend-1-jyit.onrender.com/api/saved-destinations/${userId}`
        );
        const mapped = response.data.map((loc: any) => ({
          latitude: loc.location.latitude,
          longitude: loc.location.longitude,
          address: loc.label,
        }));
        setSavedLocations(mapped);
      }

      // Load recent locations from AsyncStorage
      const storedRecent = await AsyncStorage.getItem("recentLocations");
      if (storedRecent) {
        setRecentLocations(JSON.parse(storedRecent));
      }
    } catch (error) {
      console.error("Failed to load locations:", error);
    }
  }, [userId]);

  // Load locations on mount
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Memoized function to save to recent locations
  const addToRecent = useCallback(async (place: { latitude: number; longitude: number; address: string }) => {
    try {
      const storedRecent = await AsyncStorage.getItem("recentLocations");
      let recentList = storedRecent ? JSON.parse(storedRecent) : [];
      
      // Remove duplicates
      recentList = recentList.filter((item: any) => item.address !== place.address);
      
      // Add new place to the beginning
      recentList.unshift(place);
      
      // Keep only the last 10 items
      if (recentList.length > 10) {
        recentList = recentList.slice(0, 10);
      }

      // Save to AsyncStorage and update state
      await AsyncStorage.setItem("recentLocations", JSON.stringify(recentList));
      setRecentLocations(recentList);
    } catch (error) {
      console.error("Error saving to recent:", error);
    }
  }, []);

  // Memoized place selection handler
  const handlePlaceSelect = useCallback((place: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setDestination(place);
    animateToRegion({
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.001,
      longitudeDelta: 0.001,
    });
    addToRecent(place);
    onPlaceSelectedCloseModal();
  }, [setDestination, animateToRegion, addToRecent, onPlaceSelectedCloseModal]);

  // Debounced search text handler for better performance
  const debouncedSetSearchText = useCallback(
    debounce((text: string) => {
      setSearchText(text);
    }, 300), // 300ms delay
    [setSearchText]
  );

  // Optimized search suggestions handler
  const fetchSearchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&components=country:ph&types=establishment|geocode&language=en`
      );
      const data = await response.json();
      
      if (data.predictions && data.status === 'OK') {
        setSearchSuggestions(data.predictions.slice(0, 5)); // Limit to 5 suggestions
        setShowSuggestions(true);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search suggestions
  const debouncedSearchSuggestions = useCallback(
    debounce((query: string) => {
      fetchSearchSuggestions(query);
    }, 500), // 500ms delay for suggestions
    [fetchSearchSuggestions]
  );

  // Optimized text change handler
  const handleTextChange = useCallback((text: string) => {
    // Update ref immediately for UI responsiveness
    isTypingRef.current = text.length > 0;
    
    // Update local search query
    setSearchQuery(text);
    
    // Debounce the actual state update
    debouncedSetSearchText(text);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for suggestions
    searchTimeoutRef.current = setTimeout(() => {
      if (text.length >= 2) {
        debouncedSearchSuggestions(text);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 800); // Wait 800ms after user stops typing
    
    // Update typing state immediately for UI feedback
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
    } else if (text.length === 0 && isTyping) {
      setIsTyping(false);
      setShowSuggestions(false);
      setSearchSuggestions([]);
    }
  }, [debouncedSetSearchText, debouncedSearchSuggestions, setIsTyping, isTyping]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(async (suggestion: any) => {
    if (!selectedMotor) {
      Alert.alert("Select Motor", "Please select a motor before choosing a destination.");
      return;
    }

    try {
      // Get place details
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${suggestion.place_id}&key=${GOOGLE_MAPS_API_KEY}&fields=geometry,name,formatted_address`
      );
      const data = await response.json();
      
      if (data.result && data.result.geometry) {
        const place = {
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
          address: data.result.formatted_address || suggestion.description,
        };
        
        handlePlaceSelect(place);
        setSearchText(suggestion.description);
        setSearchQuery(suggestion.description);
        setShowSuggestions(false);
        setSearchSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      Alert.alert("Error", "Failed to get place details. Please try again.");
    }
  }, [selectedMotor, handlePlaceSelect, setSearchText]);

  // Optimized focus handlers
  const handleFocus = useCallback(() => {
    isTypingRef.current = true;
    setIsTyping(true);
    if (searchQuery.length >= 2) {
      setShowSuggestions(true);
    }
  }, [setIsTyping, searchQuery.length]);

  const handleBlur = useCallback(() => {
    isTypingRef.current = false;
    // Delay blur to allow for selection
    setTimeout(() => {
      if (!isTypingRef.current) {
        setIsTyping(false);
        setShowSuggestions(false);
      }
    }, 200);
  }, [setIsTyping]);

  // Memoized motor selection handler
  const handleMotorSelect = useCallback((motor: Motor) => {
    setSelectedMotor(motor);
  }, [setSelectedMotor]);

  // Memoized motor item component for better performance
  const MotorItem = useCallback(({ motor }: { motor: Motor }) => (
    <TouchableOpacity
      key={motor._id}
      style={[
        styles.motorItem,
        selectedMotor?._id === motor._id && styles.selectedMotorItem
      ]}
      onPress={() => handleMotorSelect(motor)}
    >
      <Image 
        source={require('../../assets/icons/motor-silhouette.png')} 
        style={styles.motorIcon} 
      />
      <Text style={[
        styles.motorName,
        selectedMotor?._id === motor._id && styles.selectedMotorText
      ]}>
        {motor.name}
      </Text>
    </TouchableOpacity>
  ), [selectedMotor, handleMotorSelect]);

  // Memoized motor list
  const motorListComponent = useMemo(() => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.motorList}
    >
      {motorList.map((motor) => (
        <MotorItem key={motor._id} motor={motor} />
      ))}
    </ScrollView>
  ), [motorList, MotorItem]);

  // Memoized location list for better performance
  const locationListComponent = useMemo(() => {
    const locations = activeTab === 'recent' ? recentLocations : savedLocations;
    return locations.map((location, index) => (
      <TouchableOpacity
        key={`${activeTab}-${index}`}
        style={styles.locationItem}
        onPress={() => handlePlaceSelect(location)}
      >
        <MaterialIcons 
          name={activeTab === 'recent' ? "history" : "star"} 
          size={24} 
          color="#00ADB5" 
        />
        <Text style={styles.locationText} numberOfLines={1}>
          {location.address}
        </Text>
      </TouchableOpacity>
    ));
  }, [activeTab, recentLocations, savedLocations, handlePlaceSelect]);

  // Memoized empty state
  const emptyStateComponent = useMemo(() => {
    const locations = activeTab === 'recent' ? recentLocations : savedLocations;
    return locations.length === 0 && (
      <Text style={styles.emptyText}>
        {activeTab === 'recent' 
          ? "No recent searches" 
          : "No saved locations"}
      </Text>
    );
  }, [activeTab, recentLocations, savedLocations]);

  // Memoized suggestions component
  const suggestionsComponent = useMemo(() => {
    if (!showSuggestions || searchSuggestions.length === 0) return null;

    return (
      <View style={styles.suggestionsContainer}>
        {isSearching && (
          <View style={styles.suggestionItem}>
            <ActivityIndicator size="small" color="#00ADB5" />
            <Text style={styles.suggestionText}>Searching...</Text>
          </View>
        )}
        {searchSuggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={suggestion.place_id || index}
            style={styles.suggestionItem}
            onPress={() => handleSuggestionSelect(suggestion)}
          >
            <MaterialIcons name="place" size={20} color="#666" />
            <View style={styles.suggestionContent}>
              <Text style={styles.suggestionText} numberOfLines={1}>
                {suggestion.structured_formatting?.main_text || suggestion.description}
              </Text>
              {suggestion.structured_formatting?.secondary_text && (
                <Text style={styles.suggestionSubtext} numberOfLines={1}>
                  {suggestion.structured_formatting.secondary_text}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [showSuggestions, searchSuggestions, isSearching, handleSuggestionSelect]);

  return (
    <View style={styles.container}>
      {/* Motor Selection */}
      <View style={styles.motorSection}>
        <Text style={styles.sectionTitle}>Select Your Motor</Text>
        {motorListComponent}
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            placeholder="Enter destination"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText("");
                setSearchQuery("");
                setShowSuggestions(false);
                setSearchSuggestions([]);
              }}
              style={styles.clearButton}
            >
              <MaterialIcons name="clear" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Suggestions */}
        {suggestionsComponent}
      </View>

      {/* Select from Map Button */}
      <TouchableOpacity
        style={styles.mapSelectionButton}
        onPress={() => {
          console.log("🔍 Select from Map button pressed");
          console.log("🔍 selectedMotor:", selectedMotor);
          console.log("🔍 onMapSelection function:", onMapSelection);
          
          if (!selectedMotor) {
            Alert.alert("Select Motor", "Please select a motor before choosing a destination.");
            return;
          }
          // This will be handled by the parent component
          console.log("🔍 Calling onMapSelection function");
          if (onMapSelection) {
            onMapSelection();
            console.log("✅ onMapSelection called successfully");
          } else {
            console.log("❌ onMapSelection function is not provided");
          }
        }}
      >
        <MaterialIcons name="place" size={24} color="#00ADB5" />
        <Text style={styles.mapSelectionText}>Select from Map</Text>
        <MaterialIcons name="arrow-forward" size={20} color="#00ADB5" />
      </TouchableOpacity>

      {/* Tabs for Recent/Saved */}
      {!isTyping && (
        <View style={styles.tabsContainer}>
          <View style={styles.tabButtons}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'recent' && styles.activeTab]}
              onPress={() => setActiveTab('recent')}
            >
              <MaterialIcons 
                name="history" 
                size={24} 
                color={activeTab === 'recent' ? '#00ADB5' : '#666'} 
              />
              <Text style={[
                styles.tabText,
                activeTab === 'recent' && styles.activeTabText
              ]}>Recent</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'saved' && styles.activeTab]}
              onPress={() => setActiveTab('saved')}
            >
              <MaterialIcons 
                name="star" 
                size={24} 
                color={activeTab === 'saved' ? '#00ADB5' : '#666'} 
              />
              <Text style={[
                styles.tabText,
                activeTab === 'saved' && styles.activeTabText
              ]}>Saved</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.locationList}>
            {locationListComponent}
            {emptyStateComponent}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  motorSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  motorList: {
    flexGrow: 0,
  },
  motorItem: {
    alignItems: 'center',
    padding: 12,
    marginRight: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    width: 100,
  },
  selectedMotorItem: {
    backgroundColor: '#00ADB5',
  },
  motorIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  motorName: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  selectedMotorText: {
    color: '#FFFFFF',
  },
  searchSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchContainer: {
    flex: 0,
  },
  searchInput: {
    height: 50,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
  },
  searchResultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchResultText: {
    fontSize: 16,
    color: '#333333',
  },
  tabsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabButtons: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00ADB5',
  },
  tabText: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#00ADB5',
    fontWeight: '600',
  },
  locationList: {
    flex: 1,
    padding: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontStyle: 'italic'
  },
  // Search input styles
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
  },
  // Suggestions styles
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionContent: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  suggestionSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  // Map Selection Button styles
  mapSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: '#00ADB5',
    borderStyle: 'dashed',
  },
  mapSelectionText: {
    fontSize: 16,
    color: '#00ADB5',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  }
});

export default SearchBar;
