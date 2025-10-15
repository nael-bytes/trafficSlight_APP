import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import tw from "twrnc";
import axios from "axios";
import { useUser } from "../../AuthContext/UserContextImproved";
import { LOCALHOST_IP } from "@env";

const API_URL = `${LOCALHOST_IP}/api/saved-destinations`;



export default function AllDestinationsMapScreen({ navigation }) {
  const { user } = useUser();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
 
  const fetchDestinations = async () => {
    try {
      const res = await axios.get(`${API_URL}/${user._id}`);
      setDestinations(res.data);
    } catch (err) {
      console.error("Failed to fetch destinations:", err.message);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchDestinations();
  }, []);

  const getPinColor = (category) => {
    return category === "Home"
      ? "green"
      : category === "Work"
      ? "blue"
      : category === "School"
      ? "orange"
      : "gray";
  };

  return (
    <View style={tw`flex-1`}>
      {loading ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: 14.7,
            longitude: 120.98,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {destinations.map((dest) => (
            <Marker
              key={dest._id}
              coordinate={{
                latitude: dest.location.latitude,
                longitude: dest.location.longitude,
              }}
              title={`${dest.label}`}
              description={`Category: ${dest.category}`}
              pinColor={getPinColor(dest.category)}
            />
          ))}
        </MapView>
      )}

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={tw`absolute top-12 left-4 bg-white p-2 rounded-full shadow`}
      >
        <Ionicons name="arrow-back" size={24} color="black" />
      </TouchableOpacity>
    </View>
  );
}