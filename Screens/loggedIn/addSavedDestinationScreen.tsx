import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import DropDownPicker from "react-native-dropdown-picker";
import axios from "axios";
import { useUser } from "../../AuthContext/UserContextImproved";
import { GOOGLE_MAPS_API_KEY, LOCALHOST_IP } from "@env";
import tw from "twrnc";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useNavigation } from "@react-navigation/native";

export default function SaveDestinationScreen() {
  const { user } = useUser();
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation();

  const [label, setLabel] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("Other");

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryItems, setCategoryItems] = useState([
    { label: "Home", value: "Home" },
    { label: "Work", value: "Work" },
    { label: "School", value: "School" },
    { label: "Other", value: "Other" },
  ]);

  const handleSave = async () => {
    if (!label || !location) {
      Alert.alert("Missing Fields", "Please fill all fields before saving.");
      return;
    }

    try {
      await axios.post(`${LOCALHOST_IP}/api/saved-destinations`, {
        userId: user._id,
        label,
        location,
        category,
      });

      Alert.alert("Success", "Destination saved successfully!");
      setLabel("");
      setLocation(null);
      setCategory("Other");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Something went wrong while saving.");
    }
  };

  return (
    <View style={tw`flex-1 bg-white`}>
      <View style={tw`p-4`}>
        <View style={tw`w py-4 pt-10 border-b border-gray-200 flex-row items-center bg-white`}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={tw`text-lg font-bold ml-4`}>Search Address</Text>
        </View>

        <GooglePlacesAutocomplete
          placeholder="Enter location"
          fetchDetails
          query={{
            key: GOOGLE_MAPS_API_KEY,
            language: "en",
          }}
          onPress={(data, details = null) => {
            if (details) {
              const lat = details.geometry.location.lat;
              const lng = details.geometry.location.lng;
              setLocation({ latitude: lat, longitude: lng });
              setAddress(data.description);

              mapRef.current?.animateToRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }
          }}
          styles={{
            container: { flex: 0 },
            textInput: {
              height: 44,
              borderColor: "#ccc",
              borderWidth: 1,
              borderRadius: 6,
              paddingHorizontal: 10,
              fontSize: 16,
            },
          }}
        />
      </View>

      <View style={tw`px-4 mt-4`}>
        <Text style={tw`text-lg font-semibold mb-2`}>Label</Text>
        <TextInput
          style={tw`border border-gray-300 rounded p-2 text-base`}
          placeholder="e.g., Home, Office"
          value={label}
          onChangeText={setLabel}
        />
      </View>

      <View style={tw`px-4 mt-4 z-10`}>
        <Text style={tw`text-lg font-semibold mb-2`}>Category</Text>
        <DropDownPicker
          open={categoryOpen}
          value={category}
          items={categoryItems}
          setOpen={setCategoryOpen}
          setValue={setCategory}
          setItems={setCategoryItems}
          placeholder="Select category"
          style={tw`border border-gray-300`}
          dropDownContainerStyle={tw`border border-gray-300`}
        />
      </View>

      {location && (
        <MapView
          ref={mapRef}
          style={{
            width: Dimensions.get("window").width,
            height: 250,
            marginTop: 20,
          }}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={location}
            draggable
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setLocation({ latitude, longitude });
            }}
          />
        </MapView>
      )}

      <TouchableOpacity
        onPress={handleSave}
        style={tw`m-5 bg-green-600 py-3 rounded-lg items-center`}
      >
        <Text style={tw`text-white text-lg font-semibold`}>Save Destination</Text>
      </TouchableOpacity>
    </View>
  );
}
