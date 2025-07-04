import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ScrollView,
    StyleSheet,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import PropTypes from "prop-types";


const SearchDrawer = ({
  searchRef,
  searchText,
  setSearchText,
  isTyping,
  setIsTyping,
  onPlaceSelect,
  animateSearchDrawer,
  searchBarAnim,
  GOOGLE_MAPS_API_KEY,
  tabs,
}) => {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key || "");

  const activeTabData = tabs.find((tab) => tab.key === activeTab)?.data || [];

  const handlePlaceSelect = (place) => {
    onPlaceSelect(place);
    animateSearchDrawer(false);
  };

  return (
    <Animated.View style={[styles.searchDrawer, { transform: [{ translateY: searchBarAnim }] }]}>
      <GooglePlacesAutocomplete
        ref={searchRef}
        placeholder="Where to?"
        fetchDetails
        onPress={(data, details = null) => {
          if (details) {
            const selectedPlace = {
              latitude: details.geometry.location.lat,
              longitude: details.geometry.location.lng,
              address: data.description,
            };
            handlePlaceSelect(selectedPlace);
            setIsTyping(false);
            searchRef.current?.setAddressText("");
          }
        }}
        onFocus={() => setIsTyping(true)}
        onBlur={() => setIsTyping(false)}
        textInputProps={{
          value: searchText,
          onChangeText: setSearchText,
          placeholderTextColor: "#888",
          accessible: true,
          accessibilityLabel: "Search for destination",
        }}
        query={{ key: GOOGLE_MAPS_API_KEY, language: "en" }}
        styles={{
          textInput: styles.searchInput,
          container: { flex: 1, marginBottom: 10 },
          listView: {
            position: "absolute",
            top: 50,
            backgroundColor: "#fff",
            width: "100%",
            zIndex: 100,
            elevation: 5,
          },
        }}
      />

      {searchText.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            setSearchText("");
            searchRef.current?.setAddressText("");
            setIsTyping(false);
          }}
          accessible
          accessibilityLabel="Clear search input"
        >
          <Text style={styles.clearButtonText}>✖</Text>
        </TouchableOpacity>
      )}

      {!isTyping && tabs?.length > 0 && (
        <>
          <View style={styles.tabContainer}>
            {tabs.map((tab) => (
              <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.key && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.scrollView}>
            {activeTabData.map(
              (place, index) =>
                place?.address && (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handlePlaceSelect(place)}
                  >
                    <Text style={styles.placeOption}>{place.address}</Text>
                  </TouchableOpacity>
                )
            )}
          </ScrollView>
        </>
      )}

      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => animateSearchDrawer(false)}
        accessible
        accessibilityLabel="Close search drawer"
      >
        <Text style={styles.closeButtonText}>✖ Close</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

SearchDrawer.propTypes = {
  searchRef: PropTypes.object.isRequired,
  searchText: PropTypes.string.isRequired,
  setSearchText: PropTypes.func.isRequired,
  isTyping: PropTypes.bool.isRequired,
  setIsTyping: PropTypes.func.isRequired,
  onPlaceSelect: PropTypes.func.isRequired,
  animateSearchDrawer: PropTypes.func.isRequired,
  searchBarAnim: PropTypes.object.isRequired,
  GOOGLE_MAPS_API_KEY: PropTypes.string.isRequired,
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      data: PropTypes.arrayOf(
        PropTypes.shape({
          latitude: PropTypes.number,
          longitude: PropTypes.number,
          address: PropTypes.string,
        })
      ),
    })
  ),
};

export default SearchDrawer;


import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  searchDrawer: {
    height: "95%",
    zIndex: 1001,
    backgroundColor: "white",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingRight: 50,
    paddingVertical: 10,
    fontSize: 16,
  },
  clearButton: {
    position: "absolute",
    top: 14,
    right: 16,
  },
  clearButtonText: {
    fontSize: 18,
    color: "#888",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 10,
  },
  tabText: {
    fontSize: 16,
  },
  activeTabText: {
    fontWeight: "bold",
    color: "blue",
  },
  scrollView: {
    padding: 10,
  },
  placeOption: {
    padding: 8,
  },
  closeButton: {
    padding: 16,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "red",
  },
  drawerTabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },
  drawerTabText: {
    fontSize: 16,
    padding: 10,
  },
  drawerActiveTab: {
    fontWeight: "bold",
    color: "blue",
  },
  drawerContent: {
    padding: 10,
  },
  altRouteOption: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#f0f0f0",
    marginVertical: 5,
  },
  altRouteOptionSelected: {
    backgroundColor: "#3498db",
    color: "#fff",
  },
});
